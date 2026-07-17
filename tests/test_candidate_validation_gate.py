import copy
import json
from pathlib import Path

import pytest

from scripts.candidate_validation_gate import build_outputs, validate_observation


ROOT = Path(__file__).resolve().parents[1]
MODEL_REVIEW = ROOT / "research" / "species" / "model-review"
QUEUE = ROOT / "research" / "species" / "generated" / "model-translation-queue.json"
SOURCES = ROOT / "research" / "species" / "generated" / "source-registry.json"
DECISIONS = MODEL_REVIEW / "decisions.json"
BLUEPRINTS = MODEL_REVIEW / "candidate-blueprints.json"
SPECS = MODEL_REVIEW / "candidate-fixture-specs.json"
PLAN = MODEL_REVIEW / "candidate-validation-plan.json"
OBSERVATIONS = MODEL_REVIEW / "validation-observations.json"


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def inputs():
    return [
        load(QUEUE),
        load(SOURCES),
        load(DECISIONS),
        load(BLUEPRINTS),
        load(SPECS),
        load(PLAN),
        load(OBSERVATIONS),
    ]


def outputs():
    return build_outputs(*inputs())


def test_every_curve_has_an_adversarial_review_without_human_approval():
    ledger = outputs()["curve-review-ledger.json"]
    assert ledger["modelVersion"] == "candidate-v0.2.0"
    assert ledger["reviewedCurveCount"] == 22
    assert ledger["reducedMagnitudeCount"] == 6
    assert ledger["blockedCurveCount"] == 1
    assert all(rule["adversarialFinding"] for rule in ledger["rules"])
    assert all(not rule["humanApproved"] for rule in ledger["rules"])
    assert all(not rule["productionApproved"] for rule in ledger["rules"])


def test_comparison_cohort_is_small_direct_and_still_offline_only():
    cohort = outputs()["comparison-cohort.json"]
    assert cohort["cohortRuleCount"] == 2
    assert {rule["speciesId"] for rule in cohort["rules"]} == {
        "northern-snakehead",
        "walleye",
    }
    assert all(rule["offlineValidationSelected"] for rule in cohort["rules"])
    assert all(not rule["liveShadowEligible"] for rule in cohort["rules"])
    assert all(not rule["productionEligible"] for rule in cohort["rules"])


def test_readiness_is_honestly_blocked_without_independent_observations():
    report = outputs()["validation-readiness-report.json"]
    assert report["status"] == (
        "blocked-awaiting-preregistration-and-independent-observations"
    )
    assert report["independentObservationCount"] == 0
    assert report["preRegistrationApproved"] is False
    assert report["humanApproved"] is False
    assert report["liveScorerEligibleCount"] == 0


def test_observation_contract_rejects_catch_only_and_incidental_records():
    invalid = {
        "observationId": "test-1",
        "occurredAtStart": "2026-06-01T06:00:00-04:00",
        "occurredAtEnd": "2026-06-01T08:00:00-04:00",
        "receivedAt": "2026-06-01T09:00:00-04:00",
        "spotId": "spot-1",
        "waterbodyId": "water-1",
        "speciesId": "northern-snakehead",
        "targetedSpecies": False,
        "anglerCount": 1,
        "effortMinutes": 120,
        "catchCount": 0,
        "zeroCatchExplicit": False,
        "sourceType": "scraped-third-party-report",
        "modelVersion": "candidate-v0.2.0",
        "conditionReplayId": "replay-1",
        "consentForAggregateAnalysis": False,
    }
    errors = validate_observation(invalid, {"northern-snakehead", "walleye"})
    assert any("incidental" in error for error in errors)
    assert any("zero catch" in error for error in errors)
    assert any("sourceType" in error for error in errors)
    assert any("consent" in error for error in errors)


def test_observations_cannot_enter_before_preregistration():
    values = inputs()
    observation_store = copy.deepcopy(values[-1])
    observation_store["observations"] = [
        {
            "observationId": "test-valid-shape",
            "occurredAtStart": "2026-06-01T06:00:00-04:00",
            "occurredAtEnd": "2026-06-01T08:00:00-04:00",
            "receivedAt": "2026-06-01T09:00:00-04:00",
            "spotId": "spot-1",
            "waterbodyId": "water-1",
            "speciesId": "northern-snakehead",
            "targetedSpecies": True,
            "anglerCount": 1,
            "effortMinutes": 120,
            "catchCount": 0,
            "zeroCatchExplicit": True,
            "sourceType": "first-party-alpha-trip-log",
            "modelVersion": "candidate-v0.2.0",
            "conditionReplayId": "replay-1",
            "consentForAggregateAnalysis": True,
        }
    ]
    with pytest.raises(ValueError, match="preregistration approval"):
        build_outputs(*values[:-1], observation_store)


def test_validation_artifacts_are_not_referenced_by_runtime_code():
    forbidden = (
        "candidate-validation-plan",
        "validation-observations",
        "comparison-cohort",
        "curve-review-ledger",
    )
    for runtime_root in (ROOT / "app", ROOT / "apps" / "api" / "app"):
        for path in runtime_root.rglob("*"):
            if path.suffix not in {".py", ".ts", ".tsx", ".js", ".mjs"}:
                continue
            text = path.read_text(encoding="utf-8")
            assert not any(token in text for token in forbidden), path
