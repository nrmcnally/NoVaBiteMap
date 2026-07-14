"""High-level opportunity orchestration used by the location and ranked endpoints.

Ties together: DB evidence -> engine availability/quality/confidence (scoring.service)
and the researched per-species activity model (scoring.activity), optionally driven
by live NWS/USGS conditions. Produces the multi-species "what's biting here" payload.
"""
from __future__ import annotations

from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..api import serializers
from ..models.entities import (
    FishingLocationRecord,
    LocationStationAssociation,
    SpeciesEvidenceRecord,
    SpeciesRecord,
    SpeciesScoringProfile,
    StockingRecord,
)
from ..scoring.activity import build_species_forecast
from ..scoring.service import AVAILABILITY_GATE, score_species_at_location

FLOWING = ("river", "stream")


def load_active_profiles(session: Session) -> dict[str, dict]:
    rows = session.scalars(
        select(SpeciesScoringProfile).where(SpeciesScoringProfile.active == True)  # noqa: E712
    ).all()
    return {row.species_id: row.configuration for row in rows}


def species_names(session: Session) -> dict[str, SpeciesRecord]:
    return {row.id: row for row in session.scalars(select(SpeciesRecord)).all()}


def association_dict(assoc: LocationStationAssociation | None) -> dict | None:
    if assoc is None:
        return None
    return {
        "station_id": assoc.station_id,
        "association_factor": assoc.association_factor,
        "relationship_type": assoc.relationship_type,
        "basis": assoc.basis,
        "limitation": assoc.limitation,
    }


def get_association(session: Session, location_id: str) -> LocationStationAssociation | None:
    return session.scalar(
        select(LocationStationAssociation).where(LocationStationAssociation.location_id == location_id)
    )


def _band(offered: bool, opportunity: int) -> str:
    if not offered:
        return "insufficient"
    if opportunity >= 70:
        return "strong"
    if opportunity >= 55:
        return "fair"
    return "low"


def _best_window(hourly: list[dict]) -> str | None:
    """Contiguous run of the strongest hours on the first forecast day."""
    if not hourly:
        return None
    first_day = hourly[0]["dateKey"]
    today = [h for h in hourly if h["dateKey"] == first_day]
    if not today:
        return None
    peak = max(h["activity"] for h in today)
    if peak <= 0:
        return None
    threshold = peak * 0.85
    run: list[dict] = []
    best_run: list[dict] = []
    for hour in today:
        if hour["activity"] >= threshold:
            run.append(hour)
            if len(run) > len(best_run):
                best_run = run[:]
        else:
            run = []
    if not best_run:
        return None
    start = best_run[0]["hour"]
    end = best_run[-1]["hour"] + 1
    return f"{_fmt_hour(start)}–{_fmt_hour(end)}"


def _fmt_hour(hour24: int) -> str:
    suffix = "AM" if hour24 < 12 else "PM"
    hour12 = hour24 % 12 or 12
    return f"{hour12}:00 {suffix}"


def _species_activity(profile, location, availability, quality, weather, hydro_state):
    """Returns (activity_value, available, best_window, forecast|None)."""
    if not weather or not weather.get("available") or not profile:
        return location.activity_estimate, False, location.best_window, None
    water_temp = hydro_state.get("waterTempF") if hydro_state else None
    forecast = build_species_forecast(
        profile,
        weather["periods"],
        waterbody_type=location.waterbody_type,
        latitude=location.latitude,
        longitude=location.longitude,
        availability=availability,
        quality=quality,
        access_fit=location.access_fit,
        base_confidence=70,
        hydrology=hydro_state if hydro_state and hydro_state.get("available") else None,
        alerts=weather.get("alerts", []),
        water_temp_f=water_temp,
    )
    hourly = forecast["hourly"]
    if not hourly:
        return location.activity_estimate, False, location.best_window, forecast
    first_day = hourly[0]["dateKey"]
    today = [h for h in hourly if h["dateKey"] == first_day] or hourly
    representative = max(h["activity"] for h in today)
    return representative, True, _best_window(hourly), forecast


def score_location_species(
    session: Session,
    location: FishingLocationRecord,
    *,
    weather: dict | None = None,
    hydro_state: dict | None = None,
    profiles: dict[str, dict] | None = None,
    names: dict[str, SpeciesRecord] | None = None,
) -> dict:
    profiles = profiles if profiles is not None else load_active_profiles(session)
    names = names if names is not None else species_names(session)
    association = get_association(session, location.id)
    has_hydrology = association is not None
    association_factor = association.association_factor if association else 1.0
    stocking = session.scalar(select(StockingRecord).where(StockingRecord.location_id == location.id))
    stocked_ids = set(stocking.species_ids or []) if stocking else set()

    grouped: dict[str, list[SpeciesEvidenceRecord]] = defaultdict(list)
    for record in location.evidence:
        grouped[record.species_id].append(record)

    offered: list[dict] = []
    insufficient: list[dict] = []
    live = False

    for species_id, records in grouped.items():
        species = names.get(species_id)
        profile = profiles.get(species_id)
        # Preview availability (activity-independent) to decide the gate cheaply.
        from ..scoring.engine import combine_availability
        from ..scoring.service import evidence_dict

        availability_preview = combine_availability(evidence_dict(r) for r in records)
        quality_preview = None
        if availability_preview < AVAILABILITY_GATE:
            insufficient.append(
                {
                    "speciesId": species_id,
                    "name": species.common_name if species else species_id,
                    "availabilityScore": availability_preview,
                    "reason": "Evidence does not clear the availability gate; not confirmed here.",
                    "evidenceType": records[0].evidence_type,
                }
            )
            continue

        activity, activity_available, best_window, _forecast = _species_activity(
            profile, location, availability_preview, quality_preview, weather, hydro_state
        )
        live = live or activity_available
        scored = score_species_at_location(
            records,
            activity=activity,
            activity_available=activity_available,
            access_fit=location.access_fit,
            has_hydrology=has_hydrology,
            association_factor=association_factor,
        )
        if scored is None:
            continue
        scored.update(
            {
                "speciesId": species_id,
                "name": species.common_name if species else species_id,
                "scientificName": species.scientific_name if species else None,
                "bestWindow": best_window,
                "state": _band(True, scored["opportunity_score"]),
                "activityLive": activity_available,
                "fishFacts": serializers.fish_facts(profile, species),
                "stocked": species_id in stocked_ids,
                "stockingCategory": stocking.category if (stocking and species_id in stocked_ids) else None,
                "stockingPlanUrl": stocking.plan_url if (stocking and species_id in stocked_ids) else None,
            }
        )
        offered.append(scored)

    offered.sort(key=lambda item: item["opportunity_score"], reverse=True)
    return {
        "location": {
            "id": location.id,
            "name": location.name,
            "waterbody": location.waterbody,
            "waterbodyType": location.waterbody_type,
            "county": location.county,
        },
        "liveConditions": live,
        "hydrologyAvailable": bool(hydro_state and hydro_state.get("available")),
        "species": offered,
        "insufficient": insufficient,
        "disclaimer": "Relative fishing-opportunity estimates, not catch guarantees. Low opportunity is a conditions estimate, not proof a species will not bite.",
    }
