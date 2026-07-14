from __future__ import annotations

import pathlib
import sys

API_ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))

from app.scoring.engine import (  # noqa: E402
    availability_score,
    combine_availability,
    combine_quality,
    confidence_score,
    final_opportunity_score,
    hourly_activity_score,
    quality_score,
)


# --- primitive engine (POST /score contract) --------------------------------
def test_no_evidence_returns_zero():
    assert availability_score([]) == 0


def test_modeled_only_evidence_is_capped():
    score = availability_score([
        {"direction": 1, "authority": 1, "directness": 1, "method_quality": 1, "geographic_precision": 1, "recency": 1, "modeled": True},
        {"direction": 1, "authority": 1, "directness": 1, "method_quality": 1, "geographic_precision": 1, "recency": 1, "modeled": True},
    ])
    assert score <= 0.25


def test_incompatible_waterbody_caps_score():
    evidence = [{"direction": 1, "authority": 1, "directness": 1, "method_quality": 1, "geographic_precision": 1, "recency": 1}]
    assert availability_score(evidence, incompatible_waterbody=True) <= 0.05


def test_quality_is_weighted_and_missing_is_none():
    assert quality_score([]) is None
    score = quality_score([
        {"value": 0.8, "method_reliability": 1, "recency": 1, "sample_coverage": 1},
        {"value": 0.2, "method_reliability": 0.5, "recency": 1, "sample_coverage": 1},
    ])
    assert abs(score - 0.6) < 0.01


def test_activity_requires_45_percent_coverage():
    assert hourly_activity_score([{"suitability": 1, "weight": 0.44, "available": True}]) is None
    assert hourly_activity_score([{"suitability": 0.7, "weight": 0.45, "available": True}]) == 0.7


def test_weather_cannot_override_weak_presence():
    low_presence = final_opportunity_score(0.2, 1.0, 1.0, 1.0)
    strong_presence = final_opportunity_score(0.9, 0.5, 0.5, 0.5)
    assert low_presence < strong_presence


def test_safety_cap_is_applied_last():
    assert final_opportunity_score(1, 1, 1, 1, safety_cap=35) == 35


def test_confidence_is_separate_and_horizon_sensitive():
    assert confidence_score(1, 1, 1, 1, 1) == 100
    assert confidence_score(1, 1, 1, 1, 1, horizon_factor=0.72) == 72


# --- DB-backed combination (scoring.service path) ---------------------------
def test_single_record_availability_passes_through_unchanged():
    # A curated single record must not regress under the noisy-OR combination.
    assert combine_availability([{"availability": 0.86, "modeled": False, "presence_status": "present"}]) == 0.86


def test_multiple_records_corroborate_upward():
    combined = combine_availability([
        {"availability": 0.6, "modeled": False, "presence_status": "present"},
        {"availability": 0.5, "modeled": False, "presence_status": "present"},
    ])
    assert combined > 0.6  # independent corroboration raises confidence


def test_modeled_only_combination_is_capped():
    combined = combine_availability([
        {"availability": 0.5, "modeled": True, "presence_status": "present"},
        {"availability": 0.5, "modeled": True, "presence_status": "present"},
    ])
    assert combined <= 0.56


def test_absence_record_pulls_availability_down():
    presence_only = combine_availability([{"availability": 0.8, "modeled": False, "presence_status": "present"}])
    with_absence = combine_availability([
        {"availability": 0.8, "modeled": False, "presence_status": "present"},
        {"availability": 0.0, "modeled": False, "presence_status": "absent"},
    ])
    assert with_absence < presence_only


def test_combine_quality_confidence_weighted():
    assert combine_quality([{"quality": None, "evidence_confidence": 0.9}]) is None
    q = combine_quality([
        {"quality": 0.8, "evidence_confidence": 0.9},
        {"quality": 0.4, "evidence_confidence": 0.3},
    ])
    assert 0.6 < q < 0.75  # weighted toward the higher-confidence record
