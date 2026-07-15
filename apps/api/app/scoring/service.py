"""Database-backed scoring: turns stored SpeciesEvidenceRecords into the four
scored components + measured confidence + explainable factors.

This replaces the previous path that read seed literals and used hardcoded
confidence constants. Availability/quality are combined by the engine; confidence
is derived from the actual evidence (count, recency, authority, hydrology coverage).
"""
from __future__ import annotations

from datetime import datetime, timezone

from ..models.entities import SpeciesEvidenceRecord
from .engine import (
    clamp,
    combine_availability,
    combine_quality,
    confidence_score,
    final_opportunity_score,
)

MODEL_VERSION = "evidence-scorer-0.2"
SCORING_PROFILE_VERSION = "1.0"

AVAILABILITY_GATE = 0.35

_AUTHORITY_BY_TYPE = {
    "official listing": 0.90,
    "agency survey": 0.85,
    "stocking": 0.92,
    "modeled": 0.70,
}


def _recency(observed_at: datetime | None) -> float:
    if observed_at is None:
        return 0.5
    if observed_at.tzinfo is None:
        observed_at = observed_at.replace(tzinfo=timezone.utc)
    years = (datetime.now(timezone.utc) - observed_at).days / 365.25
    return clamp(1 - years / 8)  # ~8-year horizon to fully decay


def _authority(record: SpeciesEvidenceRecord) -> float:
    return _AUTHORITY_BY_TYPE.get(record.evidence_type, 0.75)


def _directness(record: SpeciesEvidenceRecord) -> float:
    return 0.40 if record.modeled else 0.82


def evidence_dict(record: SpeciesEvidenceRecord) -> dict:
    return {
        "availability": record.availability,
        "quality": record.quality,
        "evidence_confidence": record.evidence_confidence,
        "modeled": record.modeled,
        "presence_status": record.presence_status,
    }


def score_species_at_location(
    records: list[SpeciesEvidenceRecord],
    *,
    activity: float | None,
    activity_available: bool,
    access_fit: float,
    has_hydrology: bool,
    horizon_factor: float = 1.0,
    association_factor: float = 1.0,
    safety_cap: int | None = None,
    current_month: int | None = None,
) -> dict | None:
    """Score one species at one location from its evidence records. Returns None
    when evidence does not clear the availability gate (species not offered).

    current_month (1-12) gates seasonal-run species: an anadromous spawner is
    near-absent outside its run window, so its opportunity collapses off-season."""
    if not records:
        return None

    availability = combine_availability(evidence_dict(r) for r in records)
    if availability < AVAILABILITY_GATE:
        return None
    quality = combine_quality(evidence_dict(r) for r in records)

    primary = max(records, key=lambda r: r.availability)
    seasonal = primary.seasonal
    in_season = True
    if seasonal and current_month is not None:
        in_season = current_month in (seasonal.get("months") or [])
        if not in_season:
            availability = round(availability * 0.2, 4)  # out of the run window

    opportunity = final_opportunity_score(
        availability,
        quality,
        activity,
        access_fit,
        safety_cap,
    )

    n = len(records)
    coverage = clamp(
        0.30
        + 0.15 * min(n, 3)
        + (0.15 if quality is not None else 0.0)
        + (0.10 if has_hydrology else 0.0)
        + (0.10 if activity_available else 0.0)
    )
    recency = sum(_recency(r.observed_at) for r in records) / n
    authority = sum(_authority(r) for r in records) / n
    directness = sum(_directness(r) for r in records) / n
    absent = sum(1 for r in records if r.presence_status == "absent")
    agreement = clamp(
        sum(r.evidence_confidence for r in records) / n - 0.15 * absent
    )
    confidence = confidence_score(
        coverage=coverage,
        recency=recency,
        authority=authority,
        agreement=agreement,
        directness=directness,
        horizon_factor=horizon_factor,
        association_factor=association_factor,
    )

    factors = _factors(records, availability, quality, activity, activity_available, has_hydrology)

    return {
        "availability_score": availability,
        "fishery_quality_score": quality,
        "activity_score": None if activity is None else round(activity, 3),
        "opportunity_score": opportunity,
        "confidence_score": confidence,
        "confidence_label": "High" if confidence >= 75 else "Moderate" if confidence >= 50 else "Low",
        "evidence_type": primary.evidence_type,
        "evidence_summary": primary.evidence_summary,
        "last_evidence": primary.last_evidence,
        "technique": primary.technique,
        "depth": primary.depth,
        "source_name": primary.source_name,
        "source_url": primary.source_url,
        "modeled": bool(primary.modeled),
        "seasonal": seasonal,
        "inSeason": in_season,
        "factors": factors,
        "model_version": MODEL_VERSION,
        "scoring_profile_version": SCORING_PROFILE_VERSION,
        "safety_cap": safety_cap,
    }


def _factors(
    records: list[SpeciesEvidenceRecord],
    availability: float,
    quality: float | None,
    activity: float | None,
    activity_available: bool,
    has_hydrology: bool,
) -> dict:
    positive: list[str] = []
    negative: list[str] = []
    for record in records:
        positive.extend(record.positive or [])
        negative.extend(record.negative or [])
    if quality is None:
        negative.append("No structured long-term fishery-quality metric is attached.")
    if not activity_available:
        negative.append("Hourly activity is a seasonal estimate; live conditions have not been refreshed.")
    if not has_hydrology:
        negative.append("No verified USGS gage association, so flow context is limited.")
    if any(r.modeled for r in records) and availability <= 0.56:
        negative.append("Some evidence is nearby-reach / modeled, not confirmed at this access point.")
    # De-duplicate while preserving order.
    def _dedupe(items: list[str]) -> list[str]:
        seen: set[str] = set()
        out: list[str] = []
        for item in items:
            if item not in seen:
                seen.add(item)
                out.append(item)
        return out

    return {"positive": _dedupe(positive), "negative": _dedupe(negative)}
