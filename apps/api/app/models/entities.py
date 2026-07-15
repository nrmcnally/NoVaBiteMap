from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Identity, sessions, favorites
# ---------------------------------------------------------------------------
class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(512))
    display_name: Mapped[str | None] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    favorites: Mapped[list["SavedLocation"]] = relationship(cascade="all, delete-orphan")
    sessions: Mapped[list["SessionToken"]] = relationship(cascade="all, delete-orphan")


class SessionToken(Base):
    __tablename__ = "session_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class SavedLocation(Base):
    __tablename__ = "saved_locations"
    __table_args__ = (UniqueConstraint("user_id", "location_id", name="uq_saved_user_location"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    location_id: Mapped[str] = mapped_column(String(100), index=True)
    nickname: Mapped[str | None] = mapped_column(String(80))
    notes: Mapped[str | None] = mapped_column(Text)
    preferred_species_id: Mapped[str | None] = mapped_column(String(100))
    default_access_method: Mapped[str | None] = mapped_column(String(20))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


# ---------------------------------------------------------------------------
# Provenance and ingestion auditing
# ---------------------------------------------------------------------------
class DataSource(Base):
    __tablename__ = "data_sources"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True)
    provider: Mapped[str] = mapped_column(String(100), index=True)
    source_url: Mapped[str] = mapped_column(Text)
    license_name: Mapped[str | None] = mapped_column(String(200))
    dataset_version: Mapped[str | None] = mapped_column(String(100))
    retrieved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class DataIngestionRun(Base):
    """One row per ingestion attempt. Backs the administrator data-health screen."""

    __tablename__ = "data_ingestion_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    source_name: Mapped[str] = mapped_column(String(200), index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(20), default="running")  # running|success|failed|skipped
    records_seen: Mapped[int] = mapped_column(Integer, default=0)
    records_created: Mapped[int] = mapped_column(Integer, default=0)
    records_updated: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text)
    checksum: Mapped[str | None] = mapped_column(String(64))
    dataset_version: Mapped[str | None] = mapped_column(String(100))


# ---------------------------------------------------------------------------
# Waterbodies, locations, access
# ---------------------------------------------------------------------------
class Waterbody(Base):
    __tablename__ = "waterbodies"

    id: Mapped[str] = mapped_column(String(120), primary_key=True)  # slug
    official_name: Mapped[str] = mapped_column(String(200), index=True)
    waterbody_type: Mapped[str] = mapped_column(String(20))
    watershed: Mapped[str | None] = mapped_column(String(120), index=True)
    state: Mapped[str] = mapped_column(String(4), default="VA")

    aliases: Mapped[list["WaterbodyAlias"]] = relationship(cascade="all, delete-orphan")


class WaterbodyAlias(Base):
    __tablename__ = "waterbody_aliases"
    __table_args__ = (UniqueConstraint("waterbody_id", "alias", name="uq_waterbody_alias"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    waterbody_id: Mapped[str] = mapped_column(ForeignKey("waterbodies.id", ondelete="CASCADE"), index=True)
    alias: Mapped[str] = mapped_column(String(200), index=True)


class FishingLocationRecord(Base):
    __tablename__ = "fishing_locations"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    waterbody: Mapped[str] = mapped_column(String(200), index=True)
    waterbody_id: Mapped[str | None] = mapped_column(ForeignKey("waterbodies.id"), index=True)
    waterbody_type: Mapped[str] = mapped_column(String(20), default="lake")
    watershed: Mapped[str | None] = mapped_column(String(120), index=True)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    county: Mapped[str] = mapped_column(String(100), index=True)
    state: Mapped[str] = mapped_column(String(4), default="VA")
    public_access: Mapped[bool] = mapped_column(Boolean, default=True)
    access_status: Mapped[str] = mapped_column(String(20), default="verified")  # verified|listed|unverified
    access_methods: Mapped[list] = mapped_column(JSON, default=list)  # shore|wade|kayak|boat
    distance_miles: Mapped[float | None] = mapped_column(Float)
    travel_minutes: Mapped[int | None] = mapped_column(Integer)
    activity_estimate: Mapped[float] = mapped_column(Float, default=0.5)
    access_fit: Mapped[float] = mapped_column(Float, default=0.84)
    best_window: Mapped[str | None] = mapped_column(String(120))
    flow_status: Mapped[str | None] = mapped_column(String(200))
    notice: Mapped[str | None] = mapped_column(Text)
    access_authority: Mapped[str | None] = mapped_column(String(200))
    access_source_url: Mapped[str | None] = mapped_column(Text)
    source_reviewed: Mapped[str | None] = mapped_column(String(80))
    details: Mapped[dict] = mapped_column(JSON, default=dict)  # presentation-only: advisory, amenities
    source_id: Mapped[int | None] = mapped_column(ForeignKey("data_sources.id"))

    aliases: Mapped[list["FishingLocationAlias"]] = relationship(cascade="all, delete-orphan")
    evidence: Mapped[list["SpeciesEvidenceRecord"]] = relationship(cascade="all, delete-orphan")


class FishingLocationAlias(Base):
    __tablename__ = "fishing_location_aliases"
    __table_args__ = (UniqueConstraint("location_id", "alias", name="uq_location_alias"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    location_id: Mapped[str] = mapped_column(ForeignKey("fishing_locations.id", ondelete="CASCADE"), index=True)
    alias: Mapped[str] = mapped_column(String(200), index=True)


# ---------------------------------------------------------------------------
# Species, scoring profiles, evidence
# ---------------------------------------------------------------------------
class SpeciesRecord(Base):
    __tablename__ = "species"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    common_name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    scientific_name: Mapped[str] = mapped_column(String(160))
    species_code: Mapped[str] = mapped_column(String(20), unique=True)
    habitat: Mapped[str | None] = mapped_column(Text)
    aliases: Mapped[list] = mapped_column(JSON, default=list)


class SpeciesScoringProfile(Base):
    """Versioned per-species activity configuration (temp bands, spawn, diel, waterbody fit)."""

    __tablename__ = "species_scoring_profiles"
    __table_args__ = (UniqueConstraint("species_id", "version", name="uq_species_profile_version"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    species_id: Mapped[str] = mapped_column(ForeignKey("species.id", ondelete="CASCADE"), index=True)
    version: Mapped[str] = mapped_column(String(20), default="1.0")
    configuration: Mapped[dict] = mapped_column(JSON, default=dict)
    effective_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class SpeciesEvidenceRecord(Base):
    __tablename__ = "species_evidence"

    id: Mapped[int] = mapped_column(primary_key=True)
    location_id: Mapped[str] = mapped_column(ForeignKey("fishing_locations.id", ondelete="CASCADE"), index=True)
    species_id: Mapped[str] = mapped_column(ForeignKey("species.id"), index=True)
    evidence_type: Mapped[str] = mapped_column(String(80))  # official listing|agency survey|stocking|modeled
    presence_status: Mapped[str] = mapped_column(String(20), default="present")  # present|absent
    modeled: Mapped[bool] = mapped_column(Boolean, default=False)
    # Curated agency-informed signals (retained as the encoded expert judgement).
    availability: Mapped[float] = mapped_column(Float, default=0.0)
    quality: Mapped[float | None] = mapped_column(Float)
    evidence_confidence: Mapped[float] = mapped_column(Float, default=0.5)
    evidence_summary: Mapped[str | None] = mapped_column(Text)
    last_evidence: Mapped[str | None] = mapped_column(String(200))
    observed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    technique: Mapped[str | None] = mapped_column(Text)
    depth: Mapped[str | None] = mapped_column(Text)
    positive: Mapped[list] = mapped_column(JSON, default=list)
    negative: Mapped[list] = mapped_column(JSON, default=list)
    # Present for seasonal-run species (anadromous spawning runs): {months:[...], label}.
    seasonal: Mapped[dict | None] = mapped_column(JSON)
    sampling_method: Mapped[str | None] = mapped_column(String(160))
    source_name: Mapped[str | None] = mapped_column(String(200))
    source_url: Mapped[str | None] = mapped_column(Text)
    source_id: Mapped[int | None] = mapped_column(ForeignKey("data_sources.id"))
    notes: Mapped[str | None] = mapped_column(Text)


# ---------------------------------------------------------------------------
# Stocking and hydrology
# ---------------------------------------------------------------------------
class StockingRecord(Base):
    """DWR designated stocked-water record (designation-level, not a dated stocking event)."""

    __tablename__ = "stocking_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    location_id: Mapped[str] = mapped_column(ForeignKey("fishing_locations.id", ondelete="CASCADE"), index=True)
    category: Mapped[str | None] = mapped_column(String(80))
    designation: Mapped[str | None] = mapped_column(String(200))
    species_ids: Mapped[list] = mapped_column(JSON, default=list)
    source_url: Mapped[str | None] = mapped_column(Text)
    plan_url: Mapped[str | None] = mapped_column(Text)
    reviewed: Mapped[str | None] = mapped_column(String(80))


class HydrologyStation(Base):
    __tablename__ = "hydrology_stations"

    id: Mapped[str] = mapped_column(String(20), primary_key=True)  # USGS station id
    name: Mapped[str] = mapped_column(String(200))
    monitor_url: Mapped[str | None] = mapped_column(Text)
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    parameters: Mapped[list] = mapped_column(JSON, default=list)


class LocationStationAssociation(Base):
    __tablename__ = "location_station_associations"
    __table_args__ = (
        UniqueConstraint("location_id", "station_id", name="uq_location_station"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    location_id: Mapped[str] = mapped_column(ForeignKey("fishing_locations.id", ondelete="CASCADE"), index=True)
    station_id: Mapped[str] = mapped_column(ForeignKey("hydrology_stations.id"), index=True)
    relationship_type: Mapped[str] = mapped_column(String(30), default="connected-reach")  # same-waterbody|connected-reach
    association_factor: Mapped[float] = mapped_column(Float, default=0.85)
    distance_miles: Mapped[float | None] = mapped_column(Float)
    basis: Mapped[str | None] = mapped_column(Text)
    limitation: Mapped[str | None] = mapped_column(Text)
    verified: Mapped[bool] = mapped_column(Boolean, default=True)
