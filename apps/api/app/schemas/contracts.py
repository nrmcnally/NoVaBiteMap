from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=256)
    display_name: str | None = Field(default=None, max_length=120)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)


class FavoriteCreate(BaseModel):
    location_id: str
    nickname: str | None = Field(default=None, max_length=80)
    notes: str | None = Field(default=None, max_length=1000)
    preferred_species_id: str | None = None
    default_access_method: str | None = None


class FavoriteUpdate(BaseModel):
    nickname: str | None = Field(default=None, max_length=80)
    notes: str | None = Field(default=None, max_length=1000)
    preferred_species_id: str | None = None
    default_access_method: str | None = None
    sort_order: int | None = None


class FishingTripCreate(BaseModel):
    location_id: str = Field(min_length=1, max_length=100)
    species_id: str = Field(min_length=1, max_length=100)
    started_at: datetime
    ended_at: datetime
    timezone: str = Field(default="America/New_York", min_length=1, max_length=64)
    angler_count: int = Field(default=1, ge=1, le=20)
    catch_count: int = Field(ge=0, le=1000)
    location_detail: str | None = Field(default=None, max_length=160)
    lure_or_bait: str | None = Field(default=None, max_length=160)
    observed_water_temperature_c: float | None = Field(default=None, ge=-5, le=45)
    observed_clarity: str | None = Field(default=None, pattern="^(clear|stained|muddy|unknown)$")
    notes: str | None = Field(default=None, max_length=2000)
    consent_for_aggregate_analysis: bool = False


class FishingTripReplayUpdate(BaseModel):
    condition_replay_id: str = Field(min_length=36, max_length=36)
    condition_replay_status: str = Field(pattern="^(complete|partial|unavailable)$")
    condition_replay_policy_version: str = Field(min_length=1, max_length=40)
    condition_replay: dict
    condition_replayed_at: datetime


class AlphaFeedbackCreate(BaseModel):
    category: str = Field(pattern="^(incorrect-data|bug|idea|other)$")
    location_id: str | None = Field(default=None, max_length=100)
    page_url: str | None = Field(default=None, max_length=500)
    message: str = Field(min_length=10, max_length=3000)
    contact_ok: bool = False


class EvidenceInput(BaseModel):
    direction: int = Field(ge=-1, le=1)
    authority: float = Field(ge=0, le=1)
    directness: float = Field(ge=0, le=1)
    method_quality: float = Field(ge=0, le=1)
    geographic_precision: float = Field(ge=0, le=1)
    recency: float = Field(ge=0, le=1)
    modeled: bool = False


class QualityInput(BaseModel):
    value: float = Field(ge=0, le=1)
    method_reliability: float = Field(ge=0, le=1)
    recency: float = Field(ge=0, le=1)
    sample_coverage: float = Field(ge=0, le=1)


class ActivityInput(BaseModel):
    suitability: float = Field(ge=0, le=1)
    weight: float = Field(gt=0, le=1)
    available: bool = True


class ScoreRequest(BaseModel):
    evidence: list[EvidenceInput] = Field(default_factory=list)
    quality_metrics: list[QualityInput] = Field(default_factory=list)
    activity_inputs: list[ActivityInput] = Field(default_factory=list)
    access_fit: float = Field(ge=0, le=1)
    incompatible_waterbody: bool = False
    safety_cap: int | None = Field(default=None, ge=0, le=100)
    horizon_factor: float = Field(default=1, ge=0, le=1)
    association_factor: float = Field(default=1, ge=0, le=1)


class TimelineScoresRequest(BaseModel):
    """Bounded batch request for the Explore prediction timeline."""

    anchor_latitude: float = Field(ge=36, le=40.5)
    anchor_longitude: float = Field(ge=-84, le=-74)
    anchor_label: str = Field(default="Northern Virginia regional forecast", max_length=160)
    location_ids: list[str] = Field(min_length=1, max_length=300)
    species_ids: list[str] = Field(default_factory=list, max_length=80)
