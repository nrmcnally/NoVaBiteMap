from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


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


class DataSource(Base):
    __tablename__ = "data_sources"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True)
    provider: Mapped[str] = mapped_column(String(100), index=True)
    source_url: Mapped[str] = mapped_column(Text)
    license_name: Mapped[str | None] = mapped_column(String(200))
    dataset_version: Mapped[str | None] = mapped_column(String(100))
    retrieved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class FishingLocationRecord(Base):
    __tablename__ = "fishing_locations"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    waterbody: Mapped[str] = mapped_column(String(200), index=True)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    county: Mapped[str] = mapped_column(String(100), index=True)
    public_access: Mapped[bool] = mapped_column(Boolean, default=True)
    source_id: Mapped[int | None] = mapped_column(ForeignKey("data_sources.id"))


class SpeciesRecord(Base):
    __tablename__ = "species"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    common_name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    scientific_name: Mapped[str] = mapped_column(String(160))
    species_code: Mapped[str] = mapped_column(String(20), unique=True)


class SpeciesEvidenceRecord(Base):
    __tablename__ = "species_evidence"

    id: Mapped[int] = mapped_column(primary_key=True)
    location_id: Mapped[str] = mapped_column(ForeignKey("fishing_locations.id"), index=True)
    species_id: Mapped[str] = mapped_column(ForeignKey("species.id"), index=True)
    evidence_type: Mapped[str] = mapped_column(String(80))
    presence_status: Mapped[str] = mapped_column(String(20))
    confidence: Mapped[float] = mapped_column(Float)
    observed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    source_id: Mapped[int | None] = mapped_column(ForeignKey("data_sources.id"))
    sampling_method: Mapped[str | None] = mapped_column(String(160))
    notes: Mapped[str | None] = mapped_column(Text)

