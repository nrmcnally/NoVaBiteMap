from __future__ import annotations

from typing import Iterable


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def availability_score(evidence: Iterable[dict], incompatible_waterbody: bool = False) -> float:
    positive = 0.0
    negative = 0.0
    modeled_positive = 0.0
    for item in evidence:
        weight = (
            float(item["authority"])
            * float(item["directness"])
            * float(item["method_quality"])
            * float(item["geographic_precision"])
            * float(item["recency"])
        )
        if int(item["direction"]) > 0:
            if item.get("modeled"):
                modeled_positive += weight
            else:
                positive += weight
        elif int(item["direction"]) < 0:
            negative += weight

    # Landscape models cannot create high local presence confidence by themselves.
    positive += min(modeled_positive, 0.25 if positive == 0 else modeled_positive)
    value = positive / (positive + negative + 0.75) if positive else 0.0
    if incompatible_waterbody:
        value = min(value, 0.05)
    return round(clamp(value), 4)


def quality_score(metrics: Iterable[dict]) -> float | None:
    weighted_total = 0.0
    weight_total = 0.0
    for metric in metrics:
        weight = (
            float(metric["method_reliability"])
            * float(metric["recency"])
            * float(metric["sample_coverage"])
        )
        weighted_total += float(metric["value"]) * weight
        weight_total += weight
    if weight_total == 0:
        return None
    return round(clamp(weighted_total / weight_total), 4)


def hourly_activity_score(inputs: Iterable[dict], configured_weight: float = 1.0) -> float | None:
    weighted_total = 0.0
    available_weight = 0.0
    for item in inputs:
        if not item.get("available", True):
            continue
        weight = float(item["weight"])
        weighted_total += float(item["suitability"]) * weight
        available_weight += weight
    if available_weight < configured_weight * 0.45:
        return None
    return round(clamp(weighted_total / available_weight), 4)


def final_opportunity_score(
    availability: float,
    quality: float | None,
    activity: float | None,
    access_fit: float,
    safety_cap: int | None = None,
) -> int:
    quality_value = 0.5 if quality is None else quality
    activity_value = 0.5 if activity is None else activity
    raw = 100 * availability**1.5 * (0.35 * quality_value + 0.50 * activity_value + 0.15 * access_fit)
    score = round(raw)
    if safety_cap is not None:
        score = min(score, safety_cap)
    return max(0, min(100, score))


def confidence_score(
    coverage: float,
    recency: float,
    authority: float,
    agreement: float,
    directness: float,
    horizon_factor: float = 1.0,
    association_factor: float = 1.0,
) -> int:
    base = 0.30 * coverage + 0.25 * recency + 0.20 * authority + 0.15 * agreement + 0.10 * directness
    return round(100 * clamp(base) * clamp(horizon_factor) * clamp(association_factor))


def score_opportunity(payload: dict) -> dict:
    evidence = payload.get("evidence", [])
    availability = availability_score(evidence, payload.get("incompatible_waterbody", False))
    quality = quality_score(payload.get("quality_metrics", []))
    activity = hourly_activity_score(payload.get("activity_inputs", []))
    opportunity = final_opportunity_score(
        availability,
        quality,
        activity,
        float(payload.get("access_fit", 0.0)),
        payload.get("safety_cap"),
    )
    positive = [item for item in evidence if int(item.get("direction", 0)) > 0]
    negative = [item for item in evidence if int(item.get("direction", 0)) < 0]
    coverage = clamp((len(evidence) + len(payload.get("quality_metrics", [])) + len(payload.get("activity_inputs", []))) / 8)
    confidence = confidence_score(
        coverage=coverage,
        recency=sum(float(item.get("recency", 0)) for item in evidence) / max(1, len(evidence)),
        authority=sum(float(item.get("authority", 0)) for item in evidence) / max(1, len(evidence)),
        agreement=1 - min(0.6, len(negative) / max(1, len(positive) + len(negative))),
        directness=sum(float(item.get("directness", 0)) for item in evidence) / max(1, len(evidence)),
        horizon_factor=float(payload.get("horizon_factor", 1)),
        association_factor=float(payload.get("association_factor", 1)),
    )
    return {
        "opportunity_score": opportunity,
        "confidence_score": confidence,
        "confidence_label": "High" if confidence >= 75 else "Moderate" if confidence >= 50 else "Low",
        "availability_score": availability,
        "fishery_quality_score": quality,
        "activity_score": activity,
        "access_fit": payload.get("access_fit"),
        "disclaimer": "Relative fishing opportunity, not a catch probability or guarantee.",
    }

