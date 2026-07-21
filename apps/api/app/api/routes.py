from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from difflib import SequenceMatcher
from math import asin, cos, radians, sin, sqrt
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from ..auth.service import create_session_token, hash_password, token_hash, user_for_token, verify_password
from ..core.config import settings
from ..core.database import get_session
from ..models.entities import (
    AlphaFeedback,
    DataIngestionRun,
    FishingLocationRecord,
    HydrologyStation,
    LocationStationAssociation,
    SavedLocation,
    SessionToken,
    SpeciesEvidenceRecord,
    SpeciesRecord,
    StockingRecord,
    User,
    FishingTrip,
)
from ..providers.base import ProviderError
from ..providers.usgs import UsgsWaterProvider
from ..schemas.contracts import (
    AlphaFeedbackCreate,
    FavoriteCreate,
    FavoriteUpdate,
    LoginRequest,
    RegisterRequest,
    ScoreRequest,
    TimelineScoresRequest,
    FishingTripCreate,
    FishingTripReplayUpdate,
)
from ..scoring.activity import build_species_forecast
from ..scoring.engine import score_opportunity
from ..scoring.service import score_species_at_location
from ..scoring.water_temperature import unavailable_temperature_state


def _current_month() -> int:
    return datetime.now().month
from ..services import conditions as conditions_service
from ..services.forecast_capabilities import (
    build_environmental_snapshot,
    build_forecast_capabilities,
)
from ..services import opportunities as opp
from . import serializers

router = APIRouter()
bearer = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------------------
# Search + geo helpers
# ---------------------------------------------------------------------------
def normalize(value: str) -> str:
    return " ".join("".join(c.lower() if c.isalnum() else " " for c in value).split())


def match_score(query: str, *candidates: str) -> float:
    """Conservative fuzzy match over a set of candidate strings for one entity."""
    needle = normalize(query)
    normalized = [normalize(c) for c in candidates if c]
    if not normalized:
        return 0.0
    if needle in normalized:
        return 1.0
    if any(c.startswith(needle) for c in normalized):
        return 0.9
    if any(needle in c or c in needle for c in normalized):
        return 0.78
    best = max((SequenceMatcher(None, needle, c).ratio() for c in normalized), default=0.0)
    return best if best >= 0.72 else 0.0  # conservative gate: unrelated names excluded


def haversine_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 3958.8
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    value = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 2 * radius * asin(sqrt(value))


# ---------------------------------------------------------------------------
# DB fetch helpers
# ---------------------------------------------------------------------------
def get_location(session: Session, location_id: str) -> FishingLocationRecord:
    record = session.get(FishingLocationRecord, location_id)
    if not record:
        raise HTTPException(status_code=404, detail="Location not found")
    return record


def get_species(session: Session, species_id: str) -> SpeciesRecord:
    record = session.get(SpeciesRecord, species_id)
    if not record:
        raise HTTPException(status_code=404, detail="Species not found")
    return record


def _stocking(session: Session, location_id: str) -> StockingRecord | None:
    return session.scalar(select(StockingRecord).where(StockingRecord.location_id == location_id))


def _station_name(session: Session, station_id: str | None) -> str | None:
    if not station_id:
        return None
    station = session.get(HydrologyStation, station_id)
    return station.name if station else None


def _canonical_opportunities(
    session: Session,
    record: FishingLocationRecord,
    *,
    profiles: dict[str, dict] | None = None,
    names: dict[str, SpeciesRecord] | None = None,
) -> dict[str, dict]:
    """Explore-ready scores from the same database engine used by detail pages."""
    scored = opp.score_location_species(session, record, profiles=profiles, names=names)
    opportunities: dict[str, dict] = {}
    for item in scored["species"]:
        species_id = item["speciesId"]
        records = [evidence for evidence in record.evidence if evidence.species_id == species_id]
        if not records:
            continue
        primary = max(records, key=lambda evidence: evidence.availability)
        opportunities[species_id] = {
            "score": item["opportunity_score"],
            "confidence": item["confidence_score"],
            "confidenceLabel": item["confidence_label"],
            "availability": item["availability_score"],
            "quality": item["fishery_quality_score"],
            "activity": item["activity_score"] if item["activity_score"] is not None else record.activity_estimate,
            "accessFit": record.access_fit,
            "evidence": serializers.evidence_out(primary),
        }
    return opportunities


def _runtime_location(
    session: Session,
    record: FishingLocationRecord,
    *,
    profiles: dict[str, dict] | None = None,
    names: dict[str, SpeciesRecord] | None = None,
) -> dict:
    association = opp.get_association(session, record.id)
    payload = serializers.location_detail(
        record,
        stocking=_stocking(session, record.id),
        association=association,
        station_name=_station_name(session, association.station_id if association else None),
    )
    payload["runtimeSource"] = "canonical-api"
    payload["opportunities"] = _canonical_opportunities(
        session, record, profiles=profiles, names=names
    )
    return payload


# ---------------------------------------------------------------------------
# Auth dependency
# ---------------------------------------------------------------------------
def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    session: Session = Depends(get_session),
) -> User:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Authentication required")
    user = user_for_token(session, credentials.credentials)
    if not user:
        raise HTTPException(status_code=401, detail="Session is invalid or expired")
    return user


def require_admin(user: User = Depends(current_user)) -> User:
    """Authorization (not just authentication) for privileged routes. Fails
    closed: with BITEMAP_ADMIN_EMAILS unset, no account is an admin."""
    if not settings.admin_emails or user.email.lower() not in settings.admin_emails:
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return user


# ---------------------------------------------------------------------------
# Species
# ---------------------------------------------------------------------------
@router.get("/species")
def list_species(session: Session = Depends(get_session)) -> list[dict]:
    rows = session.scalars(select(SpeciesRecord).order_by(SpeciesRecord.common_name)).all()
    return [serializers.species_out(r) for r in rows]


@router.get("/explore")
def explore_catalog(session: Session = Depends(get_session)) -> dict:
    """One canonical payload for the map, filters, scores, and saved-spot cards."""
    profiles = opp.load_active_profiles(session)
    names = opp.species_names(session)
    rows = session.scalars(
        select(FishingLocationRecord)
        .where(FishingLocationRecord.public_access == True)  # noqa: E712
        .order_by(FishingLocationRecord.name)
    ).all()
    target_species = [record for record in names.values() if record.id in profiles]
    target_species.sort(key=lambda record: record.common_name)
    species_payload = [
        {
            "id": record.id,
            "name": record.common_name,
            "scientificName": record.scientific_name,
            "short": record.species_code,
            "habitat": record.habitat or "Habitat guidance pending review",
            "targetable": True,
        }
        for record in target_species
    ]
    locations = [
        _runtime_location(session, record, profiles=profiles, names=names)
        for record in rows
    ]
    return {
        "dataSource": "canonical-api",
        "species": species_payload,
        "locations": locations,
        "counts": {"species": len(species_payload), "locations": len(locations)},
    }


@router.get("/species/search")
def search_species(q: str = Query(min_length=1, max_length=100), session: Session = Depends(get_session)) -> list[dict]:
    needle = normalize(q)
    results = []
    for record in session.scalars(select(SpeciesRecord)).all():
        names = [record.common_name, record.species_code, *(record.aliases or [])]
        if any(needle == normalize(n) or normalize(n).startswith(needle) for n in names if n):
            results.append(serializers.species_out(record))
    return results


@router.get("/species/{species_id}")
def species_detail(species_id: str, session: Session = Depends(get_session)) -> dict:
    from collections import defaultdict

    record = get_species(session, species_id)
    profiles = opp.load_active_profiles(session)
    profile = profiles.get(species_id)
    evidence = session.scalars(
        select(SpeciesEvidenceRecord).where(SpeciesEvidenceRecord.species_id == species_id)
    ).all()
    by_location: dict[str, list[SpeciesEvidenceRecord]] = defaultdict(list)
    for ev in evidence:
        by_location[ev.location_id].append(ev)

    locations = []
    for location_id, records in by_location.items():
        loc = session.get(FishingLocationRecord, location_id)
        if not loc:
            continue
        association = opp.get_association(session, location_id)
        scored = score_species_at_location(
            records,
            activity=loc.activity_estimate,
            activity_available=False,
            access_fit=loc.access_fit,
            has_hydrology=association is not None,
            association_factor=association.association_factor if association else 1.0,
            current_month=_current_month(),
        )
        if scored is None:
            continue
        opportunity = scored["opportunity_score"]
        primary = max(records, key=lambda r: r.availability)
        locations.append(
            {
                "id": loc.id,
                "name": loc.name,
                "waterbody": loc.waterbody,
                "waterbodyType": loc.waterbody_type,
                "county": loc.county,
                "watershed": loc.watershed,
                "travelMinutes": loc.travel_minutes,
                "accessStatus": loc.access_status,
                "availability": scored["availability_score"],
                "opportunityScore": opportunity,
                "confidenceScore": scored["confidence_score"],
                "confidenceLabel": scored["confidence_label"],
                "state": "strong" if opportunity >= 70 else "fair" if opportunity >= 55 else "low",
                "evidenceType": primary.evidence_type,
                "modeled": primary.modeled,
                "evidenceSummary": primary.evidence_summary,
                "seasonal": scored["seasonal"],
                "inSeason": scored["inSeason"],
            }
        )
    # Documented waters first (not basin-inferred), then by opportunity.
    locations.sort(key=lambda item: (not item["modeled"], item["opportunityScore"]), reverse=True)
    return {
        **serializers.species_out(record),
        "facts": serializers.fish_facts(profile, record),
        "profileVersion": "1.2" if profile else None,
        "locations": locations,
        "disclaimer": "Species facts are researched reference content, not a guarantee of presence or catch at any specific water.",
    }


@router.get("/species/{species_id}/locations")
def species_locations(
    species_id: str,
    max_minutes: int = Query(default=240, ge=1, le=600),
    confidence_threshold: int = Query(default=0, ge=0, le=100),
    session: Session = Depends(get_session),
) -> list[dict]:
    get_species(session, species_id)
    return _ranked(session, species_id, max_minutes, None, confidence_threshold)


# ---------------------------------------------------------------------------
# Locations
# ---------------------------------------------------------------------------
@router.get("/locations")
def list_locations(
    county: str | None = None,
    access_method: str | None = None,
    waterbody_type: str | None = None,
    watershed: str | None = None,
    public_access: bool = True,
    limit: int = Query(default=50, ge=1, le=300),
    offset: int = Query(default=0, ge=0),
    session: Session = Depends(get_session),
) -> list[dict]:
    stmt = select(FishingLocationRecord)
    if public_access:
        stmt = stmt.where(FishingLocationRecord.public_access == True)  # noqa: E712
    if county:
        stmt = stmt.where(func.lower(FishingLocationRecord.county) == county.lower())
    if waterbody_type:
        stmt = stmt.where(FishingLocationRecord.waterbody_type == waterbody_type)
    if watershed:
        stmt = stmt.where(FishingLocationRecord.watershed == watershed)
    rows = session.scalars(stmt.order_by(FishingLocationRecord.name)).all()
    if access_method:
        rows = [r for r in rows if access_method in (r.access_methods or [])]
    return [serializers.location_summary(r) for r in rows[offset : offset + limit]]


@router.get("/locations/search")
def search_locations(
    q: str = Query(min_length=1, max_length=120),
    limit: int = Query(default=20, ge=1, le=50),
    session: Session = Depends(get_session),
) -> list[dict]:
    rows = session.scalars(select(FishingLocationRecord)).all()
    scored: list[tuple[float, FishingLocationRecord]] = []
    for record in rows:
        aliases = [a.alias for a in record.aliases]
        score = match_score(q, record.name, record.waterbody, record.county, record.watershed or "", *aliases)
        if score > 0:
            scored.append((score, record))
    scored.sort(key=lambda item: item[0], reverse=True)
    return [serializers.location_summary(r) for _, r in scored[:limit]]


@router.get("/locations/nearby")
def nearby_locations(
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
    radius_miles: float = Query(default=25, gt=0, le=200),
    session: Session = Depends(get_session),
) -> list[dict]:
    matches = []
    for record in session.scalars(select(FishingLocationRecord)).all():
        distance = haversine_miles(latitude, longitude, record.latitude, record.longitude)
        if distance <= radius_miles:
            matches.append({**serializers.location_summary(record), "distanceMiles": round(distance, 1)})
    return sorted(matches, key=lambda item: item["distanceMiles"])


@router.get("/locations/{location_id}")
def location_detail(location_id: str, session: Session = Depends(get_session)) -> dict:
    record = get_location(session, location_id)
    return _runtime_location(session, record)


@router.get("/locations/{location_id}/species")
async def location_species(
    location_id: str,
    live: bool = Query(default=True, description="Fetch live NWS/USGS to drive species activity"),
    session: Session = Depends(get_session),
) -> dict:
    """Multi-species 'what's biting here' comparison across every evidenced species."""
    record = get_location(session, location_id)
    weather = None
    hydro_state = None
    temperature_state = None
    if live:
        association = opp.get_association(session, location_id)
        weather_task = asyncio.create_task(
            conditions_service.get_weather(record.latitude, record.longitude)
        )
        hydro_task = (
            asyncio.create_task(
                conditions_service.get_hydrology_state(
                    opp.association_dict(association)
                )
            )
            if association is not None
            else None
        )
        if hydro_task is not None:
            weather, hydro_state = await asyncio.gather(weather_task, hydro_task)
        else:
            weather = await weather_task
        temperature_state = await conditions_service.get_water_temperature_state(
            record.latitude,
            record.longitude,
            record.waterbody_type,
            hydro_state if hydro_state and hydro_state.get("available") else None,
        )
    return opp.score_location_species(
        session,
        record,
        weather=weather,
        hydro_state=hydro_state,
        temperature_state=temperature_state,
    )


@router.get("/locations/{location_id}/conditions")
async def location_conditions(location_id: str, session: Session = Depends(get_session)) -> dict:
    record = get_location(session, location_id)
    weather = await conditions_service.get_weather(record.latitude, record.longitude)
    if not weather.get("available"):
        raise HTTPException(status_code=503, detail=f"{weather.get('reason', 'weather unavailable')}. No fallback was fabricated.")
    return weather


@router.get("/locations/{location_id}/hydrology")
async def location_hydrology(location_id: str, session: Session = Depends(get_session)) -> dict:
    get_location(session, location_id)
    association = opp.get_association(session, location_id)
    if association is None:
        raise HTTPException(status_code=404, detail="No manually verified USGS association for this location")
    state = await conditions_service.get_hydrology_state(opp.association_dict(association))
    if not state.get("available"):
        raise HTTPException(status_code=503, detail=state.get("reason", "hydrology unavailable"))
    return state


async def _environmental_context(record: FishingLocationRecord, association) -> tuple[dict, dict | None, dict, dict | None]:
    association_payload = opp.association_dict(association) if association is not None else None
    weather_task = asyncio.create_task(
        conditions_service.get_weather(record.latitude, record.longitude)
    )
    hydro_task = (
        asyncio.create_task(
            conditions_service.get_hydrology_state(association_payload)
        )
        if association_payload is not None
        else None
    )
    if hydro_task is not None:
        weather, hydrology = await asyncio.gather(weather_task, hydro_task)
    else:
        weather = await weather_task
        hydrology = None
    water_temperature = await conditions_service.get_water_temperature_state(
        record.latitude,
        record.longitude,
        record.waterbody_type,
        hydrology if hydrology and hydrology.get("available") else None,
    )
    return weather, hydrology, water_temperature, association_payload


def _environmental_location(record: FishingLocationRecord) -> dict:
    return {
        "id": record.id,
        "name": record.name,
        "waterbody": record.waterbody,
        "waterbodyType": record.waterbody_type,
        "latitude": record.latitude,
        "longitude": record.longitude,
    }


@router.get("/locations/{location_id}/forecast-capabilities")
async def location_forecast_capabilities(
    location_id: str,
    session: Session = Depends(get_session),
) -> dict:
    record = get_location(session, location_id)
    association = opp.get_association(session, location_id)
    weather, hydrology, water_temperature, association_payload = await _environmental_context(
        record, association
    )
    return build_forecast_capabilities(
        location=_environmental_location(record),
        weather=weather,
        hydrology=hydrology,
        water_temperature=water_temperature,
        association=association_payload,
    )


@router.get("/locations/{location_id}/environmental-snapshot")
async def location_environmental_snapshot(
    location_id: str,
    at: datetime = Query(...),
    session: Session = Depends(get_session),
) -> dict:
    if at.tzinfo is None:
        raise HTTPException(status_code=400, detail="Selected time must include a time-zone offset")
    record = get_location(session, location_id)
    association = opp.get_association(session, location_id)
    weather, hydrology, water_temperature, association_payload = await _environmental_context(
        record, association
    )
    location = _environmental_location(record)
    capabilities = build_forecast_capabilities(
        location=location,
        weather=weather,
        hydrology=hydrology,
        water_temperature=water_temperature,
        association=association_payload,
    )
    if not weather.get("available"):
        raise HTTPException(
            status_code=503,
            detail={
                "message": weather.get("reason", "Hourly weather is unavailable"),
                "capabilities": capabilities,
            },
        )
    try:
        return build_environmental_snapshot(
            selected_at=at,
            location=location,
            weather=weather,
            hydrology=hydrology,
            water_temperature=water_temperature,
            association=association_payload,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=422,
            detail={"message": str(error), "capabilities": capabilities},
        ) from error


@router.get("/locations/{location_id}/forecast")
async def location_forecast(
    location_id: str,
    species_id: str | None = None,
    wading: bool = False,
    session: Session = Depends(get_session),
) -> dict:
    """Species-specific multi-day forecast driven by live NWS + USGS + activity model."""
    record = get_location(session, location_id)
    profiles = opp.load_active_profiles(session)
    evidence = session.scalars(
        select(SpeciesEvidenceRecord).where(SpeciesEvidenceRecord.location_id == location_id)
    ).all()
    by_species: dict[str, list[SpeciesEvidenceRecord]] = {}
    for ev in evidence:
        by_species.setdefault(ev.species_id, []).append(ev)
    if not by_species:
        raise HTTPException(status_code=404, detail="No species evidence at this location to forecast")

    target = species_id or max(by_species, key=lambda sid: max(e.availability for e in by_species[sid]))
    if target not in by_species:
        raise HTTPException(status_code=404, detail="Species not evidenced at this location")
    records = by_species[target]

    association = opp.get_association(session, location_id)
    weather_task = asyncio.create_task(
        conditions_service.get_weather(record.latitude, record.longitude)
    )
    hydro_task = (
        asyncio.create_task(
            conditions_service.get_hydrology_state(opp.association_dict(association))
        )
        if association is not None
        else None
    )
    if hydro_task is not None:
        weather, hydro_state = await asyncio.gather(weather_task, hydro_task)
    else:
        weather = await weather_task
        hydro_state = None
    if not weather.get("available"):
        raise HTTPException(status_code=503, detail=f"{weather.get('reason', 'weather unavailable')}. Forecast needs live weather.")
    temperature_state = await conditions_service.get_water_temperature_state(
        record.latitude,
        record.longitude,
        record.waterbody_type,
        hydro_state if hydro_state and hydro_state.get("available") else None,
    )

    scored = score_species_at_location(
        records,
        activity=record.activity_estimate,
        activity_available=True,
        access_fit=record.access_fit,
        has_hydrology=association is not None,
        association_factor=association.association_factor if association else 1.0,
    )
    profile = profiles.get(target)
    if profile is None:
        raise HTTPException(status_code=404, detail="No scoring profile for this species")
    forecast = build_species_forecast(
        profile,
        weather["periods"],
        waterbody_type=record.waterbody_type,
        latitude=record.latitude,
        longitude=record.longitude,
        availability=scored["availability_score"],
        quality=scored["fishery_quality_score"],
        access_fit=record.access_fit,
        base_confidence=scored["confidence_score"],
        hydrology=hydro_state if hydro_state and hydro_state.get("available") else None,
        alerts=weather.get("alerts", []),
        water_temperature=temperature_state,
        wading_selected=wading,
        association_factor=association.association_factor if association else 1.0,
    )
    return {
        "location": {"id": record.id, "name": record.name, "waterbody": record.waterbody},
        "speciesId": target,
        "scores": scored,
        "waterTempStatus": forecast["waterTempStatus"],
        "waterTemperature": forecast["waterTemperature"],
        "forecast": forecast,
    }


# ---------------------------------------------------------------------------
# Opportunities
# ---------------------------------------------------------------------------
def _ranked(session, species_id, max_minutes, access_method, confidence_threshold) -> list[dict]:
    profiles = opp.load_active_profiles(session)
    names = opp.species_names(session)
    evidence_rows = session.scalars(
        select(SpeciesEvidenceRecord).where(SpeciesEvidenceRecord.species_id == species_id)
    ).all()
    results = []
    for ev in evidence_rows:
        location = session.get(FishingLocationRecord, ev.location_id)
        if location is None:
            continue
        if location.travel_minutes is not None and location.travel_minutes > max_minutes:
            continue
        if access_method and access_method not in (location.access_methods or []):
            continue
        records = [
            r for r in location.evidence if r.species_id == species_id
        ]
        association = opp.get_association(session, location.id)
        scored = score_species_at_location(
            records,
            activity=location.activity_estimate,
            activity_available=False,
            access_fit=location.access_fit,
            has_hydrology=association is not None,
            association_factor=association.association_factor if association else 1.0,
        )
        if scored is None or scored["confidence_score"] < confidence_threshold:
            continue
        results.append(
            {
                "location": serializers.location_summary(location),
                "speciesId": species_id,
                **{k: scored[k] for k in (
                    "availability_score", "fishery_quality_score", "activity_score",
                    "opportunity_score", "confidence_score", "confidence_label",
                    "evidence_type", "evidence_summary", "modeled",
                )},
                "bestWindow": location.best_window,
                "scoreBasis": "Agency evidence plus estimated seasonal activity; live conditions are separate.",
            }
        )
    results.sort(key=lambda item: item["opportunity_score"], reverse=True)
    return results


@router.get("/opportunities/ranked")
def ranked_opportunities(
    species_id: str,
    max_minutes: int = Query(default=60, ge=1, le=240),
    access_method: str | None = None,
    confidence_threshold: int = Query(default=0, ge=0, le=100),
    session: Session = Depends(get_session),
) -> list[dict]:
    get_species(session, species_id)
    return _ranked(session, species_id, max_minutes, access_method, confidence_threshold)


@router.post("/opportunities/score")
def calculate_opportunity(payload: ScoreRequest) -> dict:
    return score_opportunity(payload.model_dump())


@router.post("/opportunities/timeline")
async def timeline_opportunities(
    payload: TimelineScoresRequest,
    session: Session = Depends(get_session),
) -> dict:
    """Precompute Explore scores once so timeline scrubbing is an O(1) lookup.

    This intentionally uses one disclosed regional NWS anchor. It runs the same
    reviewed Python species model as spot details, but does not pretend the
    regional pass includes location-specific hydrology or water temperature.
    """
    weather = await conditions_service.get_weather(
        payload.anchor_latitude,
        payload.anchor_longitude,
    )
    if not weather.get("available"):
        raise HTTPException(
            status_code=503,
            detail=(
                f"{weather.get('reason', 'weather unavailable')}. "
                "Timeline scores require provider-backed forecast periods."
            ),
        )
    periods = weather.get("periods", [])
    if not periods:
        raise HTTPException(status_code=503, detail="NWS returned no forecast periods")

    requested_location_ids = list(dict.fromkeys(payload.location_ids))
    requested_species_ids = set(payload.species_ids)
    records = session.scalars(
        select(FishingLocationRecord)
        .options(selectinload(FishingLocationRecord.evidence))
        .where(
            FishingLocationRecord.id.in_(requested_location_ids),
            FishingLocationRecord.public_access == True,  # noqa: E712
        )
    ).all()
    records_by_id = {record.id: record for record in records}
    associations = session.scalars(
        select(LocationStationAssociation).where(
            LocationStationAssociation.location_id.in_(requested_location_ids)
        )
    ).all()
    associations_by_location: dict[str, LocationStationAssociation] = {}
    for association in associations:
        associations_by_location.setdefault(association.location_id, association)

    profiles = opp.load_active_profiles(session)
    period_index = {
        period.get("startTime"): index
        for index, period in enumerate(periods)
        if period.get("startTime")
    }
    day_keys = list(
        dict.fromkeys(
            datetime.fromisoformat(period["startTime"]).strftime("%Y-%m-%d")
            for period in periods
            if period.get("startTime")
        )
    )[:5]
    unavailable_temperature = unavailable_temperature_state(
        "Regional Explore matrix does not apply location-specific water temperature."
    )
    matrix: dict[str, dict[str, dict]] = {}

    for location_id in requested_location_ids:
        record = records_by_id.get(location_id)
        if record is None:
            continue
        association = associations_by_location.get(location_id)
        grouped: dict[str, list[SpeciesEvidenceRecord]] = {}
        for evidence in record.evidence:
            if requested_species_ids and evidence.species_id not in requested_species_ids:
                continue
            if evidence.species_id not in profiles:
                continue
            grouped.setdefault(evidence.species_id, []).append(evidence)

        location_scores: dict[str, dict] = {}
        for species_id, evidence_records in grouped.items():
            scored = score_species_at_location(
                evidence_records,
                activity=record.activity_estimate,
                activity_available=True,
                access_fit=record.access_fit,
                has_hydrology=association is not None,
                association_factor=association.association_factor if association else 1.0,
            )
            if scored is None:
                continue
            forecast = build_species_forecast(
                profiles[species_id],
                periods,
                waterbody_type=record.waterbody_type,
                latitude=record.latitude,
                longitude=record.longitude,
                availability=scored["availability_score"],
                quality=scored["fishery_quality_score"],
                access_fit=record.access_fit,
                base_confidence=scored["confidence_score"],
                hydrology=None,
                alerts=weather.get("alerts", []),
                water_temperature=unavailable_temperature,
                association_factor=association.association_factor if association else 1.0,
            )
            hourly = forecast["hourly"]
            days_by_key = {day["dateKey"]: day for day in forecast["days"]}
            daily_scores: list[int | None] = []
            daily_best_period_indexes: list[int | None] = []
            for day_key in day_keys:
                day = days_by_key.get(day_key)
                daily_scores.append(day["score"] if day else None)
                candidates = [row for row in hourly if row["dateKey"] == day_key]
                best = max(candidates, key=lambda row: row["score"]) if candidates else None
                daily_best_period_indexes.append(
                    period_index.get(best["startTime"]) if best else None
                )
            location_scores[species_id] = {
                "baseScore": scored["opportunity_score"],
                "confidence": scored["confidence_score"],
                "confidenceLabel": scored["confidence_label"],
                "hourlyScores": [row["score"] for row in hourly],
                "dailyScores": daily_scores,
                "dailyBestPeriodIndexes": daily_best_period_indexes,
            }
        if location_scores:
            matrix[location_id] = location_scores

    return {
        "contractVersion": "timeline-score-matrix-v0.1.0",
        "engine": "canonical-api",
        "provider": weather.get("provider", "National Weather Service"),
        "retrievedAt": weather.get("retrieved_at"),
        "forecastUpdatedAt": weather.get("forecast_updated_at"),
        "anchor": {
            "lat": payload.anchor_latitude,
            "lng": payload.anchor_longitude,
            "label": payload.anchor_label,
        },
        "basis": (
            "One disclosed regional NWS anchor; canonical evidence and reviewed "
            "species model per access point. Location-specific hydrology and water "
            "temperature are reserved for spot details."
        ),
        "periods": [
            {
                "startTime": period.get("startTime"),
                "temperature": period.get("temperature"),
                "temperatureUnit": period.get("temperatureUnit"),
                "shortForecast": period.get("shortForecast"),
                "windSpeed": period.get("windSpeed"),
                "windDirection": period.get("windDirection"),
                "windGust": period.get("windGust"),
                "isDaytime": period.get("isDaytime"),
                "precipitationProbability": period.get("precipitationProbability"),
            }
            for period in periods
        ],
        "alerts": weather.get("alerts", []),
        "dayKeys": day_keys,
        "locations": matrix,
    }


# ---------------------------------------------------------------------------
# Hydrology passthrough
# ---------------------------------------------------------------------------
@router.get("/hydrology/{station_id}")
async def hydrology(station_id: str) -> dict:
    if not station_id.isdigit() or not 8 <= len(station_id) <= 15:
        raise HTTPException(status_code=400, detail="A valid USGS station id is required")
    try:
        return await UsgsWaterProvider().get_latest_observations(station_id)
    except ProviderError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


# ---------------------------------------------------------------------------
# Auth + favorites
# ---------------------------------------------------------------------------
def favorite_dict(favorite: SavedLocation) -> dict:
    return {
        "id": favorite.id,
        "location_id": favorite.location_id,
        "nickname": favorite.nickname,
        "notes": favorite.notes,
        "preferred_species_id": favorite.preferred_species_id,
        "default_access_method": favorite.default_access_method,
        "sort_order": favorite.sort_order,
        "created_at": favorite.created_at,
        "updated_at": favorite.updated_at,
    }


def fishing_trip_dict(trip: FishingTrip) -> dict:
    return {
        "id": trip.id,
        "location_id": trip.location_id,
        "species_id": trip.species_id,
        "started_at": trip.started_at,
        "ended_at": trip.ended_at,
        "timezone": trip.timezone,
        "angler_count": trip.angler_count,
        "effort_minutes": trip.effort_minutes,
        "catch_count": trip.catch_count,
        "zero_catch_explicit": trip.zero_catch_explicit,
        "location_detail": trip.location_detail,
        "lure_or_bait": trip.lure_or_bait,
        "observed_water_temperature_c": trip.observed_water_temperature_c,
        "observed_clarity": trip.observed_clarity,
        "notes": trip.notes,
        "consent_for_aggregate_analysis": trip.consent_for_aggregate_analysis,
        "source_type": trip.source_type,
        "candidate_cohort": trip.candidate_cohort,
        "calibration_eligible": trip.calibration_eligible,
        "validation_eligible": trip.validation_eligible,
        "condition_replay_id": trip.condition_replay_id,
        "condition_replay_status": trip.condition_replay_status,
        "condition_replay_policy_version": trip.condition_replay_policy_version,
        "condition_replay": trip.condition_replay,
        "condition_replayed_at": trip.condition_replayed_at,
        "created_at": trip.created_at,
        "updated_at": trip.updated_at,
    }


def alpha_feedback_dict(
    feedback: AlphaFeedback,
    *,
    user: User | None = None,
    location: FishingLocationRecord | None = None,
) -> dict:
    result = {
        "id": feedback.id,
        "location_id": feedback.location_id,
        "category": feedback.category,
        "page_url": feedback.page_url,
        "message": feedback.message,
        "contact_ok": feedback.contact_ok,
        "status": feedback.status,
        "created_at": feedback.created_at,
    }
    if user is not None:
        result["user_email"] = user.email
        result["user_display_name"] = user.display_name
    if location is not None:
        result["location_name"] = location.name
    return result


@router.post("/auth/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, session: Session = Depends(get_session)) -> dict:
    user = User(
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        display_name=payload.display_name.strip() if payload.display_name else None,
    )
    session.add(user)
    try:
        session.commit()
    except IntegrityError as error:
        session.rollback()
        raise HTTPException(status_code=409, detail="An account with this email already exists") from error
    session.refresh(user)
    token = create_session_token(session, user)
    return {"access_token": token, "token_type": "bearer", "user": {"id": user.id, "email": user.email, "display_name": user.display_name}}


@router.post("/auth/login")
def login(payload: LoginRequest, session: Session = Depends(get_session)) -> dict:
    user = session.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_session_token(session, user)
    return {"access_token": token, "token_type": "bearer", "user": {"id": user.id, "email": user.email, "display_name": user.display_name}}


@router.post("/auth/logout", status_code=204, response_class=Response)
def logout(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    session: Session = Depends(get_session),
) -> Response:
    if credentials:
        record = session.scalar(select(SessionToken).where(SessionToken.token_hash == token_hash(credentials.credentials)))
        if record:
            session.delete(record)
            session.commit()
    return Response(status_code=204)


@router.get("/users/me")
def me(user: User = Depends(current_user)) -> dict:
    return {"id": user.id, "email": user.email, "display_name": user.display_name}


@router.delete("/users/me", status_code=204, response_class=Response)
def delete_account(user: User = Depends(current_user), session: Session = Depends(get_session)) -> Response:
    session.delete(user)
    session.commit()
    return Response(status_code=204)


@router.post("/users/me/feedback", status_code=201)
def create_alpha_feedback(
    payload: AlphaFeedbackCreate,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
) -> dict:
    if payload.location_id:
        get_location(session, payload.location_id)
    feedback = AlphaFeedback(
        id=str(uuid.uuid4()),
        user_id=user.id,
        location_id=payload.location_id,
        category=payload.category,
        page_url=payload.page_url.strip() if payload.page_url else None,
        message=payload.message.strip(),
        contact_ok=payload.contact_ok,
    )
    session.add(feedback)
    session.commit()
    session.refresh(feedback)
    return alpha_feedback_dict(feedback)


@router.get("/users/me/favorites")
def list_favorites(user: User = Depends(current_user), session: Session = Depends(get_session)) -> list[dict]:
    records = list(session.scalars(select(SavedLocation).where(SavedLocation.user_id == user.id).order_by(SavedLocation.sort_order, SavedLocation.id)))
    return [favorite_dict(record) for record in records]


@router.post("/users/me/favorites", status_code=201)
def create_favorite(payload: FavoriteCreate, user: User = Depends(current_user), session: Session = Depends(get_session)) -> dict:
    get_location(session, payload.location_id)
    if payload.preferred_species_id:
        get_species(session, payload.preferred_species_id)
    favorite = SavedLocation(
        user_id=user.id,
        location_id=payload.location_id,
        nickname=payload.nickname,
        notes=payload.notes,
        preferred_species_id=payload.preferred_species_id,
        default_access_method=payload.default_access_method,
    )
    session.add(favorite)
    try:
        session.commit()
    except IntegrityError as error:
        session.rollback()
        raise HTTPException(status_code=409, detail="Location is already saved") from error
    session.refresh(favorite)
    return favorite_dict(favorite)


@router.patch("/users/me/favorites/{favorite_id}")
def update_favorite(
    favorite_id: int,
    payload: FavoriteUpdate,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
) -> dict:
    favorite = session.scalar(select(SavedLocation).where(SavedLocation.id == favorite_id, SavedLocation.user_id == user.id))
    if not favorite:
        raise HTTPException(status_code=404, detail="Favorite not found")
    if payload.preferred_species_id:
        get_species(session, payload.preferred_species_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(favorite, field, value)
    session.commit()
    session.refresh(favorite)
    return favorite_dict(favorite)


@router.delete("/users/me/favorites/{favorite_id}", status_code=204, response_class=Response)
def delete_favorite(favorite_id: int, user: User = Depends(current_user), session: Session = Depends(get_session)) -> Response:
    favorite = session.scalar(select(SavedLocation).where(SavedLocation.id == favorite_id, SavedLocation.user_id == user.id))
    if not favorite:
        raise HTTPException(status_code=404, detail="Favorite not found")
    session.delete(favorite)
    session.commit()
    return Response(status_code=204)


@router.get("/users/me/fishing-trips")
def list_fishing_trips(
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
) -> list[dict]:
    records = session.scalars(
        select(FishingTrip)
        .where(FishingTrip.user_id == user.id)
        .order_by(FishingTrip.started_at.desc())
    ).all()
    return [fishing_trip_dict(record) for record in records]


@router.post("/users/me/fishing-trips", status_code=201)
def create_fishing_trip(
    payload: FishingTripCreate,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
) -> dict:
    get_location(session, payload.location_id)
    get_species(session, payload.species_id)
    evidenced = session.scalar(
        select(SpeciesEvidenceRecord.id).where(
            SpeciesEvidenceRecord.location_id == payload.location_id,
            SpeciesEvidenceRecord.species_id == payload.species_id,
            SpeciesEvidenceRecord.presence_status == "present",
        )
    )
    if not evidenced:
        raise HTTPException(status_code=400, detail="Species is not evidenced at this BiteMap spot")
    if payload.started_at.tzinfo is None or payload.ended_at.tzinfo is None:
        raise HTTPException(status_code=400, detail="Trip times must include a time-zone offset")
    try:
        ZoneInfo(payload.timezone)
    except ZoneInfoNotFoundError as error:
        raise HTTPException(status_code=400, detail="Unknown time zone") from error
    started_at = payload.started_at.astimezone(timezone.utc)
    ended_at = payload.ended_at.astimezone(timezone.utc)
    if ended_at <= started_at:
        raise HTTPException(status_code=400, detail="Trip end time must be after its start time")
    effort_minutes = round((ended_at - started_at).total_seconds() / 60)
    if effort_minutes < 1 or effort_minutes > 10_080:
        raise HTTPException(status_code=400, detail="Trip length must be between 1 minute and 7 days")
    if ended_at > datetime.now(timezone.utc) + timedelta(minutes=15):
        raise HTTPException(status_code=400, detail="Trip end time cannot be in the future")
    candidate_cohort = payload.species_id in {"northern-snakehead", "walleye"}
    trip = FishingTrip(
        id=str(uuid.uuid4()),
        user_id=user.id,
        location_id=payload.location_id,
        species_id=payload.species_id,
        started_at=started_at,
        ended_at=ended_at,
        timezone=payload.timezone,
        angler_count=payload.angler_count,
        effort_minutes=effort_minutes,
        catch_count=payload.catch_count,
        zero_catch_explicit=payload.catch_count == 0,
        location_detail=payload.location_detail.strip() if payload.location_detail else None,
        lure_or_bait=payload.lure_or_bait.strip() if payload.lure_or_bait else None,
        observed_water_temperature_c=payload.observed_water_temperature_c,
        observed_clarity=payload.observed_clarity,
        notes=payload.notes.strip() if payload.notes else None,
        consent_for_aggregate_analysis=payload.consent_for_aggregate_analysis,
        candidate_cohort=candidate_cohort,
        calibration_eligible=bool(
            payload.consent_for_aggregate_analysis
            and effort_minutes >= 15
        ),
        validation_eligible=False,
    )
    session.add(trip)
    session.commit()
    session.refresh(trip)
    return fishing_trip_dict(trip)


@router.patch("/users/me/fishing-trips/{trip_id}/condition-replay")
def update_fishing_trip_condition_replay(
    trip_id: str,
    payload: FishingTripReplayUpdate,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
) -> dict:
    trip = session.scalar(
        select(FishingTrip).where(
            FishingTrip.id == trip_id,
            FishingTrip.user_id == user.id,
        )
    )
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    replay = payload.condition_replay
    if (
        replay.get("replayId") != payload.condition_replay_id
        or replay.get("policyVersion") != payload.condition_replay_policy_version
        or replay.get("status") != payload.condition_replay_status
        or replay.get("generatedBy") != "bitemap-server"
    ):
        raise HTTPException(status_code=400, detail="Condition replay envelope is inconsistent")
    replay_window = replay.get("tripWindow")
    if not isinstance(replay_window, dict) or replay_window.get("locationId") != trip.location_id:
        raise HTTPException(status_code=400, detail="Condition replay does not match this trip")
    try:
        replay_start = datetime.fromisoformat(str(replay_window.get("startedAt")).replace("Z", "+00:00"))
        replay_end = datetime.fromisoformat(str(replay_window.get("endedAt")).replace("Z", "+00:00"))
    except (TypeError, ValueError) as error:
        raise HTTPException(status_code=400, detail="Condition replay interval is invalid") from error
    if (
        replay_start.astimezone(timezone.utc) != trip.started_at.astimezone(timezone.utc)
        or replay_end.astimezone(timezone.utc) != trip.ended_at.astimezone(timezone.utc)
    ):
        raise HTTPException(status_code=400, detail="Condition replay interval does not match this trip")
    prohibited = {
        "speciesid",
        "catchcount",
        "zerocatchexplicit",
        "lureorbait",
        "notes",
        "consentforaggregateanalysis",
        "calibrationeligible",
        "validationeligible",
        "observedwatertemperaturec",
        "observedclarity",
    }
    replay_keys = {
        "".join(character.lower() for character in key if character.isalnum())
        for key in _nested_dict_keys(replay)
    }
    if replay_keys & prohibited:
        raise HTTPException(status_code=400, detail="Condition replay contains trip-outcome fields")
    if payload.condition_replayed_at.tzinfo is None:
        raise HTTPException(status_code=400, detail="Condition replay time must include a time-zone offset")
    trip.condition_replay_id = payload.condition_replay_id
    trip.condition_replay_status = payload.condition_replay_status
    trip.condition_replay_policy_version = payload.condition_replay_policy_version
    trip.condition_replay = replay
    trip.condition_replayed_at = payload.condition_replayed_at.astimezone(timezone.utc)
    # Reconstruction is context only; it can never promote a trip into validation.
    trip.validation_eligible = False
    session.commit()
    session.refresh(trip)
    return fishing_trip_dict(trip)


@router.delete("/users/me/fishing-trips/{trip_id}", status_code=204, response_class=Response)
def delete_fishing_trip(
    trip_id: str,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
) -> Response:
    trip = session.scalar(
        select(FishingTrip).where(
            FishingTrip.id == trip_id,
            FishingTrip.user_id == user.id,
        )
    )
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    session.delete(trip)
    session.commit()
    return Response(status_code=204)


def _nested_dict_keys(value: object) -> set[str]:
    if isinstance(value, dict):
        return set(value) | {
            nested_key
            for nested_value in value.values()
            for nested_key in _nested_dict_keys(nested_value)
        }
    if isinstance(value, list):
        return {
            nested_key
            for item in value
            for nested_key in _nested_dict_keys(item)
        }
    return set()


# ---------------------------------------------------------------------------
# Data health (derived from real ingestion runs + DB counts)
# ---------------------------------------------------------------------------
@router.get("/admin/feedback")
def list_alpha_feedback(
    _: User = Depends(require_admin),
    session: Session = Depends(get_session),
) -> list[dict]:
    rows = session.execute(
        select(AlphaFeedback, User, FishingLocationRecord)
        .join(User, User.id == AlphaFeedback.user_id)
        .outerjoin(FishingLocationRecord, FishingLocationRecord.id == AlphaFeedback.location_id)
        .order_by(AlphaFeedback.created_at.desc())
        .limit(200)
    ).all()
    return [
        alpha_feedback_dict(feedback, user=user, location=location)
        for feedback, user, location in rows
    ]


@router.get("/data-sources/status")
def data_source_status(session: Session = Depends(get_session)) -> dict:
    location_count = session.scalar(select(func.count()).select_from(FishingLocationRecord)) or 0
    species_count = session.scalar(select(func.count()).select_from(SpeciesRecord)) or 0
    evidence_count = session.scalar(select(func.count()).select_from(SpeciesEvidenceRecord)) or 0
    stocking_count = session.scalar(select(func.count()).select_from(StockingRecord)) or 0
    assoc_count = session.scalar(select(func.count()).select_from(LocationStationAssociation)) or 0
    modeled_count = session.scalar(
        select(func.count()).select_from(SpeciesEvidenceRecord).where(SpeciesEvidenceRecord.modeled == True)  # noqa: E712
    ) or 0
    locations_with_evidence = session.scalar(
        select(func.count(func.distinct(SpeciesEvidenceRecord.location_id)))
    ) or 0

    runs = session.scalars(
        select(DataIngestionRun).order_by(DataIngestionRun.started_at.desc()).limit(20)
    ).all()
    last_success = next((r for r in runs if r.status == "success"), None)
    last_failure = next((r for r in runs if r.status == "failed"), None)

    def run_out(run: DataIngestionRun | None) -> dict | None:
        if run is None:
            return None
        return {
            "sourceName": run.source_name,
            "status": run.status,
            "startedAt": run.started_at.isoformat() if run.started_at else None,
            "completedAt": run.completed_at.isoformat() if run.completed_at else None,
            "recordsSeen": run.records_seen,
            "recordsCreated": run.records_created,
            "recordsUpdated": run.records_updated,
            "error": run.error_message,
            "datasetVersion": run.dataset_version,
        }

    return {
        "counts": {
            "locations": location_count,
            "species": species_count,
            "speciesEvidence": evidence_count,
            "locationsWithEvidence": locations_with_evidence,
            "locationsMissingEvidence": location_count - locations_with_evidence,
            "stockingRecords": stocking_count,
            "hydrologyAssociations": assoc_count,
            "modeledEvidence": modeled_count,
        },
        "lastSuccessfulIngestion": run_out(last_success),
        "lastFailedIngestion": run_out(last_failure),
        "recentRuns": [run_out(r) for r in runs],
        "liveProviders": [
            {"provider": "National Weather Service", "mode": "on-demand", "cache": "15-minute"},
            {"provider": "USGS Water Services", "mode": "on-demand", "cache": "15-minute"},
            {
                "provider": "Open-Meteo",
                "mode": "water-temperature thermal history",
                "cache": "6-hour",
            },
        ],
    }


@router.post("/admin/ingestion/reseed")
def run_reseed(_: User = Depends(require_admin), session: Session = Depends(get_session)) -> dict:
    from ..data.loader import load_seed

    result = load_seed(force=True)
    return {
        "status": result.status,
        "recordsSeen": result.records_seen,
        "recordsCreated": result.records_created,
        "recordsUpdated": result.records_updated,
        "runId": result.run_id,
    }
