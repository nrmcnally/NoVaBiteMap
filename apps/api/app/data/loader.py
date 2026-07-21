"""Idempotent loader: reads the canonical seed export (generated from the audited
TypeScript dataset by scripts/export-seed.mts) and upserts it into the database.

Run standalone:  python -m app.data.loader
Every run records a DataIngestionRun so the administrator data-health screen shows
real history. Re-running with an unchanged export is a no-op ("skipped").
"""
from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..core.database import SessionLocal
from ..models.entities import (
    DataIngestionRun,
    DataSource,
    FishingLocationAlias,
    FishingLocationRecord,
    HydrologyStation,
    LocationStationAssociation,
    SpeciesEvidenceRecord,
    SpeciesRecord,
    SpeciesScoringProfile,
    StockingRecord,
    Waterbody,
    WaterbodyAlias,
)

SEED_SOURCE_NAME = "BiteMap canonical seed export"

# Species aliases (search sugar) carried over from the curated dataset.
SPECIES_ALIASES: dict[str, list[str]] = {
    "smallmouth-bass": ["smallie", "smallmouth", "smb", "bronzeback"],
    "largemouth-bass": ["largemouth", "bucketmouth", "lmb", "bass"],
    "spotted-bass": ["spot", "spotted", "spb"],
    "bluegill": ["bream", "brim", "sunny", "bg"],
    "redbreast-sunfish": ["redbreast", "robin", "rbs"],
    "black-crappie": ["crappie", "speck", "calico", "bcp"],
    "white-crappie": ["crappie", "wcp"],
    "channel-catfish": ["channel cat", "channel", "ccf"],
    "blue-catfish": ["blue cat", "blue", "bcf"],
    "flathead-catfish": ["flathead", "shovelhead", "fcf"],
    "rainbow-trout": ["rainbow", "bow", "rbt"],
    "brown-trout": ["brown", "bnt"],
    "brook-trout": ["brookie", "brook", "native", "bkt"],
    "common-carp": ["carp", "common"],
    "northern-snakehead": ["snakehead", "frankenfish", "nsh"],
    "walleye": ["wall-eye", "eyes", "wae"],
    "yellow-perch": ["perch", "yellow", "ring perch", "yep"],
    "white-perch": ["white", "whp"],
    "striped-bass": ["striper", "rockfish", "rock", "stb"],
    "muskellunge": ["musky", "muskie", "mus"],
}

# Best-effort watershed tagging from waterbody / location names.
WATERSHED_RULES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"shenandoah", re.I), "Shenandoah"),
    (re.compile(r"potomac", re.I), "Potomac"),
    (re.compile(r"occoquan|bull run|beaverdam|pohick|belmont|marumsco|silver lake|lake ridge|rocky pen", re.I), "Occoquan"),
    (re.compile(r"rappahannock|hunting run|motts run|hazel|rapidan", re.I), "Rappahannock"),
    (re.compile(r"goose creek|broad run|cedar run|bull run", re.I), "Occoquan"),
]

WATERBODY_ALIASES: dict[str, list[str]] = {
    "occoquan-reservoir": ["Occoquan", "Fountainhead Reservoir"],
    "potomac-river": ["Potomac"],
    "lake-burke": ["Burke Lake"],
    "wheatlands-lake": ["Lake Frederick"],
}


def seed_export_path() -> Path:
    return Path(__file__).with_name("seed_export.json")


def species_profiles_path() -> Path:
    return Path(__file__).with_name("species_profiles.json")


def _slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def _watershed_for(*names: str) -> str | None:
    haystack = " ".join(n for n in names if n)
    for pattern, watershed in WATERSHED_RULES:
        if pattern.search(haystack):
            return watershed
    return None


def _parse_date(text: str | None) -> datetime | None:
    if not text:
        return None
    match = re.search(r"(\d{4})-(\d{2})-(\d{2})", text)
    if match:
        y, m, d = (int(part) for part in match.groups())
        try:
            return datetime(y, m, d, tzinfo=timezone.utc)
        except ValueError:
            return None
    year = re.search(r"\b(19|20)\d{2}\b", text)
    if year:
        return datetime(int(year.group()), 1, 1, tzinfo=timezone.utc)
    return None


def _checksum(payload: dict) -> str:
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()


@dataclass
class LoadResult:
    status: str
    records_seen: int
    records_created: int
    records_updated: int
    checksum: str
    run_id: int | None = None


def _last_success_checksum(session: Session) -> str | None:
    run = session.scalar(
        select(DataIngestionRun)
        .where(DataIngestionRun.source_name == SEED_SOURCE_NAME, DataIngestionRun.status == "success")
        .order_by(DataIngestionRun.started_at.desc())
    )
    return run.checksum if run else None


def load_seed(session: Session | None = None, *, force: bool = False) -> LoadResult:
    owns_session = session is None
    session = session or SessionLocal()
    run = DataIngestionRun(source_name=SEED_SOURCE_NAME, status="running", started_at=datetime.now(timezone.utc))
    session.add(run)
    session.commit()
    try:
        payload = json.loads(seed_export_path().read_text(encoding="utf-8"))
        profiles_payload = (
            json.loads(species_profiles_path().read_text(encoding="utf-8"))
            if species_profiles_path().exists()
            else {"profiles": [], "meta": {}}
        )
        checksum = _checksum({"seed": payload, "profiles": profiles_payload})
        locations = payload["locations"]
        species = payload["species"]
        stations = payload.get("stations", [])
        seen = len(locations) + len(species)

        existing = session.scalar(select(FishingLocationRecord).limit(1))
        if not force and existing is not None and _last_success_checksum(session) == checksum:
            run.status = "skipped"
            run.completed_at = datetime.now(timezone.utc)
            run.records_seen = seen
            run.checksum = checksum
            run.dataset_version = payload.get("meta", {}).get("schemaVersion")
            session.commit()
            return LoadResult("skipped", seen, 0, 0, checksum, run.id)

        created, updated = _upsert_all(session, payload, profiles_payload)

        run.status = "success"
        run.completed_at = datetime.now(timezone.utc)
        run.records_seen = seen
        run.records_created = created
        run.records_updated = updated
        run.checksum = checksum
        run.dataset_version = payload.get("meta", {}).get("schemaVersion")
        session.commit()
        return LoadResult("success", seen, created, updated, checksum, run.id)
    except Exception as error:
        session.rollback()
        run.status = "failed"
        run.completed_at = datetime.now(timezone.utc)
        run.error_message = f"{type(error).__name__}: {error}"
        session.commit()
        raise
    finally:
        if owns_session:
            session.close()


def _upsert_all(session: Session, payload: dict, profiles_payload: dict) -> tuple[int, int]:
    created = 0
    updated = 0

    # --- data source -------------------------------------------------------
    source = session.scalar(select(DataSource).where(DataSource.name == SEED_SOURCE_NAME))
    if source is None:
        source = DataSource(
            name=SEED_SOURCE_NAME,
            provider="BiteMap NOVA",
            source_url="app/lib/data.ts",
            license_name="Aggregated public agency data (see docs/DATA_LICENSES.md)",
            dataset_version=payload.get("meta", {}).get("schemaVersion"),
        )
        session.add(source)
    source.retrieved_at = datetime.now(timezone.utc)
    session.flush()

    # --- species -----------------------------------------------------------
    for item in payload["species"]:
        record = session.get(SpeciesRecord, item["id"])
        aliases = SPECIES_ALIASES.get(item["id"], [])
        if record is None:
            session.add(
                SpeciesRecord(
                    id=item["id"],
                    common_name=item["name"],
                    scientific_name=item["scientificName"],
                    species_code=item.get("short", item["id"][:20]),
                    habitat=item.get("habitat"),
                    aliases=aliases,
                )
            )
            created += 1
        else:
            record.common_name = item["name"]
            record.scientific_name = item["scientificName"]
            record.species_code = item.get("short", record.species_code)
            record.habitat = item.get("habitat")
            record.aliases = aliases
            updated += 1
    session.flush()

    # --- species scoring profiles -----------------------------------------
    profiles = profiles_payload.get("profiles", [])
    version = str(profiles_payload.get("meta", {}).get("version", "1.0"))
    for profile in profiles:
        species_id = profile["speciesId"]
        if session.get(SpeciesRecord, species_id) is None:
            continue
        existing = session.scalar(
            select(SpeciesScoringProfile).where(
                SpeciesScoringProfile.species_id == species_id,
                SpeciesScoringProfile.version == version,
            )
        )
        if existing is None:
            session.add(
                SpeciesScoringProfile(
                    species_id=species_id,
                    version=version,
                    configuration=profile,
                    effective_at=datetime.now(timezone.utc),
                    active=True,
                )
            )
        else:
            existing.configuration = profile
            existing.active = True
    session.flush()

    # --- hydrology stations ------------------------------------------------
    for station in payload.get("stations", []):
        record = session.get(HydrologyStation, station["stationId"])
        if record is None:
            session.add(
                HydrologyStation(
                    id=station["stationId"],
                    name=station["stationName"],
                    monitor_url=station.get("monitorUrl"),
                    parameters=["discharge", "gageHeight", "waterTemperature"],
                )
            )
        else:
            record.name = station["stationName"]
            record.monitor_url = station.get("monitorUrl")
    session.flush()

    # --- waterbodies (derived from distinct location waterbodies) ----------
    waterbody_ids: dict[str, str] = {}
    handled_waterbodies: set[str] = set()
    for loc in payload["locations"]:
        name = loc["waterbody"]
        wb_id = _slug(name)
        waterbody_ids[loc["id"]] = wb_id
        if wb_id in handled_waterbodies:
            continue
        handled_waterbodies.add(wb_id)
        if session.get(Waterbody, wb_id) is None:
            session.add(
                Waterbody(
                    id=wb_id,
                    official_name=name,
                    waterbody_type=loc["waterbodyType"],
                    watershed=_watershed_for(name, loc["name"], loc["county"]),
                    state="VA",
                )
            )
            for alias in WATERBODY_ALIASES.get(wb_id, []):
                session.add(WaterbodyAlias(waterbody_id=wb_id, alias=alias))
    session.flush()

    # --- locations + children (delete-and-replace children for idempotency)
    for loc in payload["locations"]:
        loc_id = loc["id"]
        wb_id = waterbody_ids[loc["id"]]
        watershed = _watershed_for(loc["waterbody"], loc["name"], loc["county"])
        details = {
            "consumptionAdvisory": loc.get("consumptionAdvisory"),
            "accessConditions": loc.get("accessConditions", []),
        }
        record = session.get(FishingLocationRecord, loc_id)
        if record is None:
            record = FishingLocationRecord(id=loc_id)
            session.add(record)
            created += 1
        else:
            updated += 1
        record.name = loc["name"]
        record.waterbody = loc["waterbody"]
        record.waterbody_id = wb_id
        record.waterbody_type = loc["waterbodyType"]
        record.watershed = watershed
        record.latitude = loc["lat"]
        record.longitude = loc["lng"]
        record.county = loc["county"]
        record.state = "VA"
        record.public_access = loc.get("publicAccess", True)
        record.access_status = loc.get("accessStatus", "verified")
        record.access_methods = loc.get("access", [])
        record.distance_miles = loc.get("distanceMiles")
        record.travel_minutes = loc.get("travelMinutes")
        record.activity_estimate = loc.get("activityEstimate", 0.5)
        record.access_fit = loc.get("accessFit", 0.84)
        record.best_window = loc.get("bestWindow")
        record.flow_status = loc.get("flowStatus")
        record.notice = loc.get("notice")
        record.access_authority = loc.get("accessAuthority")
        record.access_source_url = loc.get("accessSourceUrl")
        record.source_reviewed = loc.get("sourceReviewed")
        record.details = details
        record.source_id = source.id
        session.flush()

        # Replace children.
        session.execute(delete(FishingLocationAlias).where(FishingLocationAlias.location_id == loc_id))
        for alias in loc.get("aliases", []):
            session.add(FishingLocationAlias(location_id=loc_id, alias=alias))

        session.execute(delete(SpeciesEvidenceRecord).where(SpeciesEvidenceRecord.location_id == loc_id))
        for ev in loc.get("evidence", []):
            source_name = ev.get("sourceName")
            modeled = ev.get("evidenceType") == "modeled" or (source_name or "").lower().find("aquatic gap") >= 0
            conf = ev.get("evidenceConfidence", 0.5)
            session.add(
                SpeciesEvidenceRecord(
                    location_id=loc_id,
                    species_id=ev["speciesId"],
                    evidence_type=ev.get("evidenceType", "official listing"),
                    presence_status="present",
                    modeled=modeled,
                    availability=ev.get("availability", 0.0),
                    quality=ev.get("quality"),
                    evidence_confidence=conf,
                    evidence_summary=ev.get("evidenceSummary"),
                    last_evidence=ev.get("lastEvidence"),
                    observed_at=_parse_date(ev.get("lastEvidence")),
                    technique=ev.get("technique"),
                    depth=ev.get("depth"),
                    positive=ev.get("positive", []),
                    negative=ev.get("negative", []),
                    seasonal=ev.get("seasonal"),
                    sampling_method=ev.get("evidenceType"),
                    source_name=source_name,
                    source_url=ev.get("sourceUrl"),
                    source_id=source.id,
                )
            )

        session.execute(delete(StockingRecord).where(StockingRecord.location_id == loc_id))
        stocking = loc.get("stocking")
        if stocking:
            session.add(
                StockingRecord(
                    location_id=loc_id,
                    category=stocking.get("category"),
                    designation=stocking.get("designation"),
                    species_ids=stocking.get("speciesIds", []),
                    source_url=stocking.get("sourceUrl"),
                    plan_url=stocking.get("planUrl"),
                    reviewed=loc.get("sourceReviewed"),
                )
            )

        session.execute(delete(LocationStationAssociation).where(LocationStationAssociation.location_id == loc_id))
        hydro = loc.get("hydrology")
        if hydro:
            # Guarantee the station row exists even if it wasn't in the export list.
            if session.get(HydrologyStation, hydro["stationId"]) is None:
                session.add(
                    HydrologyStation(
                        id=hydro["stationId"],
                        name=hydro["stationName"],
                        monitor_url=hydro.get("monitorUrl"),
                        parameters=["discharge", "gageHeight", "waterTemperature"],
                    )
                )
                session.flush()
            session.add(
                LocationStationAssociation(
                    location_id=loc_id,
                    station_id=hydro["stationId"],
                    relationship_type=hydro.get("associationType", "connected-reach"),
                    association_factor=hydro.get("associationFactor", 0.85),
                    basis=hydro.get("basis"),
                    limitation=hydro.get("limitation"),
                    verified=True,
                )
            )
        session.flush()

    return created, updated


def main() -> None:
    result = load_seed()
    print(
        f"[seed] {result.status}: seen={result.records_seen} created={result.records_created} "
        f"updated={result.records_updated} run={result.run_id}"
    )


if __name__ == "__main__":
    main()
