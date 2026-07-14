from __future__ import annotations

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
