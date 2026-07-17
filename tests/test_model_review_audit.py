import json
from pathlib import Path

from scripts.model_review_audit import PRODUCTION_BLOCK, build_outputs


ROOT = Path(__file__).resolve().parents[1]
QUEUE = ROOT / "research" / "species" / "generated" / "model-translation-queue.json"
SOURCES = ROOT / "research" / "species" / "generated" / "source-registry.json"
DECISIONS = ROOT / "research" / "species" / "model-review" / "decisions.json"
BLUEPRINTS = ROOT / "research" / "species" / "model-review" / "candidate-blueprints.json"


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def outputs():
    return build_outputs(
        load(QUEUE), load(SOURCES), load(DECISIONS), load(BLUEPRINTS)
    )


def test_every_score_rule_is_reviewed_exactly_once():
    queue = load(QUEUE)
    score_ids = {
        rule["ruleId"]
        for rule in queue["rules"]
        if rule["recommendedModelUse"] == "score"
    }
    ledger = outputs()["model-review-ledger.json"]
    reviewed_ids = [rule["ruleId"] for rule in ledger["rules"]]

    assert len(reviewed_ids) == 61
    assert len(reviewed_ids) == len(set(reviewed_ids))
    assert set(reviewed_ids) == score_ids


def test_review_dispositions_match_the_scientific_triage():
    ledger = outputs()["model-review-ledger.json"]
    assert ledger["summary"]["dispositionCounts"] == {
        "context-only": 8,
        "evidence-informed-candidate": 20,
        "production-candidate": 2,
        "unavailable-input": 26,
        "zero-weight": 5,
    }
    assert ledger["summary"]["productionApprovedCount"] == 0
    assert ledger["summary"]["liveScorerEligibleCount"] == 0
    assert ledger["summary"]["modelableRuleCount"] == 22
    assert ledger["summary"]["sourceReviewPendingCount"] == 0
    assert ledger["summary"]["sourceReviewBlockedCount"] == 1
    assert all(not rule["eligibleForLiveScorer"] for rule in ledger["rules"])


def test_production_candidates_remain_blocked_and_have_bounded_blueprints():
    ledger = outputs()["model-review-ledger.json"]
    candidates = [
        rule
        for rule in ledger["rules"]
        if rule["disposition"] == "production-candidate"
    ]
    assert {rule["speciesId"] for rule in candidates} == {
        "northern-snakehead",
        "walleye",
    }
    for rule in candidates:
        assert rule["approvalStatus"] == PRODUCTION_BLOCK
        assert rule["primarySourcePreflight"]["status"] == (
            "primary-source-preflight-complete"
        )
        assert rule["primarySourcePreflight"]["humanApproved"] is False
        assert rule["translationBlueprint"]["sourceReviewStatus"].startswith(
            "primary-"
        )
        assert rule["translationBlueprint"]["validRange"]
        assert rule["translationBlueprint"]["proposedResponse"]
        assert rule["translationBlueprint"]["effectCapTier"]
        assert rule["translationBlueprint"]["missingBehavior"]
        assert rule["translationBlueprint"]["doubleCountingGuard"]


def test_initial_validation_cohort_is_source_preflighted_but_not_approved():
    cohort = outputs()["initial-validation-cohort.json"]
    assert cohort["cohortRuleCount"] == 6
    assert cohort["productionCandidateCount"] == 2
    assert cohort["evidenceInformedCandidateCount"] == 4
    for rule in cohort["rules"]:
        assert rule["primarySourcePreflight"]["status"] == (
            "primary-source-preflight-complete"
        )
        assert rule["primarySourcePreflight"]["humanApproved"] is False
        assert rule["eligibleForLiveScorer"] is False


def test_all_modelable_rules_have_bounded_nonproduction_blueprints():
    ledger = outputs()["model-review-ledger.json"]
    modelable = [
        rule
        for rule in ledger["rules"]
        if rule["disposition"]
        in {"production-candidate", "evidence-informed-candidate"}
    ]
    assert len(modelable) == 22
    for rule in modelable:
        blueprint = rule["translationBlueprint"]
        assert blueprint["validRange"]
        assert blueprint["proposedResponse"]
        assert blueprint["missingBehavior"]
        assert blueprint["doubleCountingGuard"]
        assert blueprint["validationRequirements"]
        assert rule["eligibleForLiveScorer"] is False


def test_temperature_blueprints_calibrate_instead_of_stacking():
    ledger = outputs()["model-review-ledger.json"]
    temperature_rules = [
        rule
        for rule in ledger["rules"]
        if rule["disposition"]
        in {"production-candidate", "evidence-informed-candidate"}
        and rule["inputKey"] == "water-temperature"
    ]
    assert temperature_rules
    for rule in temperature_rules:
        mode = rule["translationBlueprint"]["integrationMode"]
        assert mode in {
            "calibrate-existing-water-temperature-factor",
            "bounded-secondary-thermal-modifier",
        }


def test_source_timing_resolution_activates_only_the_verified_rule():
    ledger = outputs()["model-review-ledger.json"]
    unresolved = [
        rule
        for rule in ledger["rules"]
        if rule["translationBlueprint"]
        and "unavailable" in rule["translationBlueprint"]["sourceReviewStatus"]
    ]
    assert {rule["speciesId"] for rule in unresolved} == {"fallfish"}
    for rule in unresolved:
        blueprint = rule["translationBlueprint"]
        assert "neutral" in (
            blueprint["proposedResponse"] + " " + blueprint["missingBehavior"]
        ).lower()

    blacknose = next(
        rule for rule in ledger["rules"] if rule["speciesId"] == "blacknose-dace"
    )
    assert blacknose["translationBlueprint"]["sourceReviewStatus"] == (
        "primary-full-text-ocr-claim-confirmed"
    )
    assert blacknose["primarySourcePreflight"]["status"] == (
        "primary-source-preflight-complete"
    )


def test_unavailable_rules_do_not_invent_runtime_proxies():
    ledger = outputs()["model-review-ledger.json"]
    unavailable = [
        rule for rule in ledger["rules"] if rule["disposition"] == "unavailable-input"
    ]
    assert len(unavailable) == 26
    assert all(rule["approvalStatus"] == "blocked-runtime-contract" for rule in unavailable)
    assert all("do not substitute" in rule["nextAction"].lower() for rule in unavailable)
