from __future__ import annotations

from difflib import SequenceMatcher
from math import asin, cos, radians, sin, sqrt

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..auth.service import create_session_token, hash_password, token_hash, user_for_token, verify_password
from ..core.database import get_session
from ..data.seed import LOCATIONS, SPECIES
from ..ingestion.service import ingest_dwr_access
from ..models.entities import SavedLocation, SessionToken, User
from ..providers.base import ProviderError
from ..providers.nws import NwsProvider
from ..providers.usgs import UsgsWaterProvider
from ..schemas.contracts import FavoriteCreate, FavoriteUpdate, LoginRequest, RegisterRequest, ScoreRequest
from ..scoring.engine import confidence_score, final_opportunity_score, score_opportunity

router = APIRouter()
bearer = HTTPBearer(auto_error=False)


def normalize(value: str) -> str:
    return " ".join("".join(character.lower() if character.isalnum() else " " for character in value).split())


def location_match(location: dict, query: str) -> float:
    needle = normalize(query)
    candidates = [location["name"], location["waterbody"], location["county"], *location.get("aliases", [])]
    normalized = [normalize(candidate) for candidate in candidates]
    if needle in normalized:
        return 1.0
    if any(candidate.startswith(needle) for candidate in normalized):
        return 0.9
    contained = [candidate for candidate in normalized if needle in candidate or candidate in needle]
    if contained:
        return 0.78
    ratios = [SequenceMatcher(None, needle, candidate).ratio() for candidate in normalized]
    best = max(ratios, default=0)
    # Conservative fuzzy gate: unrelated names remain excluded.
    return best if best >= 0.72 else 0.0


def haversine_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 3958.8
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    value = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 2 * radius * asin(sqrt(value))


def get_location(location_id: str) -> dict:
    location = next((item for item in LOCATIONS if item["id"] == location_id), None)
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    return location


def get_species(species_id: str) -> dict:
    item = next((species for species in SPECIES if species["id"] == species_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Species not found")
    return item


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


@router.get("/species")
def list_species() -> list[dict]:
    return SPECIES


@router.get("/species/search")
def search_species(q: str = Query(min_length=1, max_length=100)) -> list[dict]:
    needle = normalize(q)
    results = []
    for species in SPECIES:
        names = [species["common_name"], species["code"], *species.get("aliases", [])]
        if any(needle == normalize(name) or normalize(name).startswith(needle) for name in names):
            results.append(species)
    return results


@router.get("/species/{species_id}")
def species_detail(species_id: str) -> dict:
    item = dict(get_species(species_id))
    item["locations"] = [
        {"id": location["id"], "name": location["name"], "evidence": location["species_evidence"][species_id]}
        for location in LOCATIONS
        if species_id in location["species_evidence"]
    ]
    return item


@router.get("/locations")
def list_locations(
    county: str | None = None,
    access_method: str | None = None,
    public_access: bool = True,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> list[dict]:
    results = [location for location in LOCATIONS if not public_access or location["public_access"]]
    if county:
        results = [location for location in results if normalize(location["county"]) == normalize(county)]
    if access_method:
        results = [location for location in results if access_method in location["access"]]
    return results[offset : offset + limit]


@router.get("/locations/search")
def search_locations(q: str = Query(min_length=1, max_length=120), limit: int = Query(default=20, ge=1, le=50)) -> list[dict]:
    scored = [(location_match(location, q), location) for location in LOCATIONS]
    return [location for score, location in sorted(scored, key=lambda item: item[0], reverse=True) if score > 0][:limit]


@router.get("/locations/nearby")
def nearby_locations(
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
    radius_miles: float = Query(default=25, gt=0, le=200),
) -> list[dict]:
    matches = []
    for location in LOCATIONS:
        distance = haversine_miles(latitude, longitude, location["latitude"], location["longitude"])
        if distance <= radius_miles:
            matches.append({**location, "distance_miles": round(distance, 1)})
    return sorted(matches, key=lambda item: item["distance_miles"])


@router.get("/locations/{location_id}")
def location_detail(location_id: str) -> dict:
    return get_location(location_id)


@router.get("/locations/{location_id}/species")
def location_species(location_id: str) -> dict:
    return get_location(location_id)["species_evidence"]


@router.get("/locations/{location_id}/conditions")
async def location_conditions(location_id: str) -> dict:
    location = get_location(location_id)
    try:
        return await NwsProvider().get_hourly_forecast(location["latitude"], location["longitude"])
    except ProviderError as error:
        raise HTTPException(status_code=503, detail=f"{error}. No fallback observation was fabricated.") from error


@router.get("/hydrology/{station_id}")
async def hydrology(station_id: str) -> dict:
    if not station_id.isdigit() or not 8 <= len(station_id) <= 15:
        raise HTTPException(status_code=400, detail="A valid USGS station id is required")
    try:
        return await UsgsWaterProvider().get_latest_observations(station_id)
    except ProviderError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@router.get("/opportunities/ranked")
def ranked_opportunities(
    species_id: str,
    max_minutes: int = Query(default=60, ge=1, le=240),
    access_method: str | None = None,
    confidence_threshold: int = Query(default=0, ge=0, le=100),
) -> list[dict]:
    get_species(species_id)
    results = []
    for location in LOCATIONS:
        evidence = location["species_evidence"].get(species_id)
        if not evidence or evidence["availability"] < 0.35 or location["travel_minutes"] > max_minutes:
            continue
        if access_method and access_method not in location["access"]:
            continue
        access_fit = 0.94 if not access_method or access_method in location["access"] else 0.2
        score = final_opportunity_score(
            evidence["availability"], evidence.get("quality"), location["activity_estimate"], access_fit
        )
        confidence = confidence_score(
            coverage=0.72 if evidence.get("quality") is not None else 0.58,
            recency=0.78,
            authority=0.92,
            agreement=0.86,
            directness=evidence["evidence_confidence"],
            association_factor=0.72,
        )
        if confidence < confidence_threshold:
            continue
        results.append({
            "location": location,
            "species_id": species_id,
            "availability_score": evidence["availability"],
            "fishery_quality_score": evidence.get("quality"),
            "activity_score": location["activity_estimate"],
            "opportunity_score": score,
            "confidence_score": confidence,
            "confidence_label": "High" if confidence >= 75 else "Moderate" if confidence >= 50 else "Low",
            "evidence_type": evidence["evidence_type"],
            "explanation": evidence["summary"],
            "score_basis": "Agency evidence plus estimated seasonal activity; live conditions are separate.",
        })
    return sorted(results, key=lambda item: item["opportunity_score"], reverse=True)


@router.post("/opportunities/score")
def calculate_opportunity(payload: ScoreRequest) -> dict:
    return score_opportunity(payload.model_dump())


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


@router.get("/users/me/favorites")
def list_favorites(user: User = Depends(current_user), session: Session = Depends(get_session)) -> list[dict]:
    records = list(session.scalars(select(SavedLocation).where(SavedLocation.user_id == user.id).order_by(SavedLocation.sort_order, SavedLocation.id)))
    return [favorite_dict(record) for record in records]


@router.post("/users/me/favorites", status_code=201)
def create_favorite(payload: FavoriteCreate, user: User = Depends(current_user), session: Session = Depends(get_session)) -> dict:
    get_location(payload.location_id)
    if payload.preferred_species_id:
        get_species(payload.preferred_species_id)
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


@router.get("/data-sources/status")
def data_source_status() -> list[dict]:
    def records_for(source_name: str) -> int:
        return sum(1 for location in LOCATIONS if location.get("source_name") == source_name)

    return [
        {"provider": "Virginia DWR access", "status": "healthy", "records": records_for("Virginia Department of Wildlife Resources"), "freshness": "seed reviewed 2026-07-13"},
        {"provider": "Fairfax County Park Authority", "status": "healthy", "records": records_for("Fairfax County Park Authority"), "freshness": "reviewed 2026-07-13"},
        {"provider": "National Park Service", "status": "healthy", "records": records_for("National Park Service"), "freshness": "reviewed 2026-07-13"},
        {"provider": "NOVA Parks", "status": "healthy", "records": records_for("NOVA Parks"), "freshness": "reviewed 2026-07-13"},
        {"provider": "Virginia and Prince William parks", "status": "healthy", "records": records_for("Virginia State Parks") + records_for("Prince William County Parks"), "freshness": "reviewed 2026-07-13"},
        {"provider": "National Weather Service", "status": "on_demand", "freshness": "live request per selected location"},
        {"provider": "USGS Water Services", "status": "association_required", "freshness": "no automatic nearest-gage fallback"},
        {"provider": "USGS Aquatic GAP", "status": "pipeline_ready", "dataset_version": "2.0 (December 2024)"},
    ]


@router.post("/admin/ingestion/dwr-access")
async def run_dwr_ingestion(_: User = Depends(current_user)) -> dict:
    result = await ingest_dwr_access(["Fairfax", "Fauquier", "Frederick", "Loudoun", "Stafford", "Clarke", "Warren"])
    return result.__dict__
