#!/usr/bin/env python3
"""Audit candidate curve review, comparison-cohort, and validation readiness."""

from __future__ import annotations

import argparse
import json
import sys
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any

if __package__:
    from scripts.candidate_model_fixtures import build_outputs as build_fixture_outputs
    from scripts.model_review_audit import (
        DEFAULT_BLUEPRINTS,
        DEFAULT_DECISIONS,
        DEFAULT_QUEUE,
        DEFAULT_SOURCES,
        digest,
        json_bytes,
        load_json,
    )
else:
    from candidate_model_fixtures import build_outputs as build_fixture_outputs
    from model_review_audit import (
        DEFAULT_BLUEPRINTS,
        DEFAULT_DECISIONS,
        DEFAULT_QUEUE,
        DEFAULT_SOURCES,
        digest,
        json_bytes,
        load_json,
    )


ROOT = Path(__file__).resolve().parents[1]
MODEL_REVIEW = ROOT / "research" / "species" / "model-review"
DEFAULT_SPECS = MODEL_REVIEW / "candidate-fixture-specs.json"
DEFAULT_PLAN = MODEL_REVIEW / "candidate-validation-plan.json"
DEFAULT_OBSERVATIONS = MODEL_REVIEW / "validation-observations.json"
DEFAULT_OUTPUT = MODEL_REVIEW / "generated" / "candidate-validation"
ALLOWED_OUTCOMES = {
    "retain-test-only",
    "retain-test-only-with-reduced-magnitude",
    "blocked-neutral",
}
REQUIRED_OBSERVATION_FIELDS = {
    "observationId",
    "occurredAtStart",
    "occurredAtEnd",
    "receivedAt",
    "spotId",
    "waterbodyId",
    "speciesId",
    "targetedSpecies",
    "anglerCount",
    "effortMinutes",
    "catchCount",
    "zeroCatchExplicit",
    "sourceType",
    "modelVersion",
    "conditionReplayId",
    "consentForAggregateAnalysis",
}
ALLOWED_SOURCE_TYPES = {"first-party-alpha-trip-log", "agency-open-row-data"}


def _response_multipliers(response: dict[str, Any]) -> list[float]:
    response_type = response["type"]
    if response_type == "categorical":
        return [float(value) for value in response["values"].values()]
    if response_type == "piecewise-linear":
        return [float(anchor[1]) for anchor in response["anchors"]]
    if response_type == "constant":
        return [float(response["multiplier"])]
    return [1.0]


def _parse_timestamp(value: Any) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def validate_observation(
    observation: dict[str, Any], selected_species: set[str]
) -> list[str]:
    observation_id = observation.get("observationId", "<missing-id>")
    errors: list[str] = []
    missing = sorted(REQUIRED_OBSERVATION_FIELDS - set(observation))
    if missing:
        errors.append(f"{observation_id}: missing {', '.join(missing)}")
        return errors
    if observation["speciesId"] not in selected_species:
        errors.append(f"{observation_id}: species is outside the comparison cohort")
    if observation["targetedSpecies"] is not True:
        errors.append(f"{observation_id}: incidental catches cannot validate this cohort")
    if not isinstance(observation["anglerCount"], int) or observation["anglerCount"] <= 0:
        errors.append(f"{observation_id}: anglerCount must be a positive integer")
    if not isinstance(observation["effortMinutes"], int) or observation["effortMinutes"] <= 0:
        errors.append(f"{observation_id}: effortMinutes must be a positive integer")
    if not isinstance(observation["catchCount"], int) or observation["catchCount"] < 0:
        errors.append(f"{observation_id}: catchCount must be a nonnegative integer")
    if observation["catchCount"] == 0 and observation["zeroCatchExplicit"] is not True:
        errors.append(f"{observation_id}: zero catch must be recorded explicitly")
    if observation["catchCount"] > 0 and observation["zeroCatchExplicit"] is not False:
        errors.append(f"{observation_id}: a positive catch cannot be marked zero-catch")
    if observation["sourceType"] not in ALLOWED_SOURCE_TYPES:
        errors.append(f"{observation_id}: unsupported sourceType")
    if observation["consentForAggregateAnalysis"] is not True:
        errors.append(f"{observation_id}: aggregate-analysis consent is required")
    if observation["modelVersion"] != "candidate-v0.2.0":
        errors.append(f"{observation_id}: modelVersion must match the locked candidate")
    if not isinstance(observation["conditionReplayId"], str) or not observation["conditionReplayId"]:
        errors.append(f"{observation_id}: conditionReplayId is required")
    start = _parse_timestamp(observation["occurredAtStart"])
    end = _parse_timestamp(observation["occurredAtEnd"])
    received = _parse_timestamp(observation["receivedAt"])
    if not start or not end or not received:
        errors.append(f"{observation_id}: timestamps must be ISO-8601 with offsets")
    elif not start < end <= received:
        errors.append(f"{observation_id}: timestamps must satisfy start < end <= received")
    return errors


def build_outputs(
    queue: dict[str, Any],
    sources: dict[str, Any],
    decisions: dict[str, Any],
    blueprints: dict[str, Any],
    specs: dict[str, Any],
    plan: dict[str, Any],
    observation_store: dict[str, Any],
) -> dict[str, Any]:
    errors: list[str] = []
    fixture_outputs = build_fixture_outputs(
        queue, sources, decisions, blueprints, specs
    )
    fixtures = fixture_outputs["candidate-model-fixtures.json"]
    fixture_by_rule = {rule["ruleId"]: rule for rule in fixtures["rules"]}
    if plan.get("modelVersion") != specs.get("modelVersion"):
        errors.append("validation plan and fixture model versions must match")
    if plan.get("reviewerAssertion", {}).get("humanApproved") is not False:
        errors.append("AI-assisted review cannot set humanApproved true")
    if plan.get("reviewerAssertion", {}).get("productionApproved") is not False:
        errors.append("engineering review cannot approve production")

    review_by_rule: dict[str, dict[str, Any]] = {}
    for review in plan.get("curveReviews", []):
        rule_id = review.get("ruleId")
        if rule_id in review_by_rule:
            errors.append(f"{rule_id}: duplicate curve review")
        review_by_rule[rule_id] = review
        if review.get("reviewOutcome") not in ALLOWED_OUTCOMES:
            errors.append(f"{rule_id}: invalid review outcome")
        if not review.get("adversarialFinding") or not review.get("primaryRisk"):
            errors.append(f"{rule_id}: curve review requires finding and risk")
    if set(review_by_rule) != set(fixture_by_rule):
        errors.append("curve reviews must exactly cover all fixture rules")

    revision_ids: set[str] = set()
    for revision in plan.get("magnitudeRevisions", []):
        rule_id = revision.get("ruleId")
        if rule_id in revision_ids:
            errors.append(f"{rule_id}: duplicate magnitude revision")
        revision_ids.add(rule_id)
        fixture = fixture_by_rule.get(rule_id)
        if fixture and revision.get("expectedResponse") != fixture["response"]:
            errors.append(f"{rule_id}: magnitude revision does not match fixture")
        review = review_by_rule.get(rule_id, {})
        if review.get("reviewOutcome") != "retain-test-only-with-reduced-magnitude":
            errors.append(f"{rule_id}: revised curve must record reduced-magnitude outcome")
    reduced_ids = {
        rule_id
        for rule_id, review in review_by_rule.items()
        if review.get("reviewOutcome") == "retain-test-only-with-reduced-magnitude"
    }
    if revision_ids != reduced_ids:
        errors.append("magnitude revision ledger must match all reduced curves")

    cohort_entries = plan.get("comparisonCohort", [])
    cohort_ids = [entry.get("ruleId") for entry in cohort_entries]
    if len(cohort_ids) != len(set(cohort_ids)):
        errors.append("comparison cohort contains duplicate rules")
    selected_from_reviews = {
        rule_id
        for rule_id, review in review_by_rule.items()
        if review.get("comparisonCohortSelected") is True
    }
    if set(cohort_ids) != selected_from_reviews:
        errors.append("comparison cohort must match curve-review selections")
    if not 1 <= len(cohort_ids) <= 3:
        errors.append("comparison cohort must remain deliberately small (1-3 rules)")

    cohort_rules: list[dict[str, Any]] = []
    for entry in cohort_entries:
        rule_id = entry["ruleId"]
        fixture = fixture_by_rule.get(rule_id)
        if fixture is None:
            errors.append(f"{rule_id}: comparison rule has no fixture")
            continue
        if fixture["status"] != "candidate-test-only":
            errors.append(f"{rule_id}: blocked fixture cannot enter comparison cohort")
        if fixture["disposition"] != "production-candidate":
            errors.append(f"{rule_id}: initial comparison cohort requires production-candidate disposition")
        if not fixture["sourceReviewStatus"].startswith("primary-"):
            errors.append(f"{rule_id}: comparison rule lacks primary-source review")
        if fixture["productionImportAllowed"] or fixture["eligibleForLiveScorer"]:
            errors.append(f"{rule_id}: comparison selection cannot enable production")
        cohort_rules.append(
            {
                **entry,
                "fixtureId": fixture["fixtureId"],
                "speciesId": fixture["speciesId"],
                "inputKey": fixture["inputKey"],
                "forecastResolution": fixture["forecastResolution"],
                "sourceReviewStatus": fixture["sourceReviewStatus"],
                "maximumAbsoluteModifier": round(
                    max(
                        abs(value - 1.0)
                        for value in _response_multipliers(fixture["response"])
                    ),
                    6,
                ),
                "offlineValidationSelected": True,
                "liveShadowEligible": False,
                "productionEligible": False,
            }
        )

    selected_species = {rule["speciesId"] for rule in cohort_rules}
    observations = observation_store.get("observations", [])
    observation_ids: set[str] = set()
    for observation in observations:
        observation_id = observation.get("observationId")
        if observation_id in observation_ids:
            errors.append(f"{observation_id}: duplicate validation observation")
        observation_ids.add(observation_id)
        errors.extend(validate_observation(observation, selected_species))
    preregistration = plan.get("preRegistration", {})
    if observations and preregistration.get("approved") is not True:
        errors.append("observations cannot be accepted before preregistration approval")

    approval = plan.get("humanApprovalGate", {})
    if approval.get("approved") is not False:
        errors.append("human approval must remain false before held-out validation")
    status = (
        "blocked-awaiting-preregistration-and-independent-observations"
        if not observations
        else "blocked-awaiting-held-out-analysis-and-human-signoff"
    )

    curve_ledger: list[dict[str, Any]] = []
    for rule_id, fixture in fixture_by_rule.items():
        review = review_by_rule[rule_id]
        curve_ledger.append(
            {
                "ruleId": rule_id,
                "fixtureId": fixture["fixtureId"],
                "speciesId": fixture["speciesId"],
                "reviewOutcome": review["reviewOutcome"],
                "adversarialFinding": review["adversarialFinding"],
                "primaryRisk": review["primaryRisk"],
                "sourceReviewStatus": fixture["sourceReviewStatus"],
                "maximumAbsoluteModifier": round(
                    max(
                        abs(value - 1.0)
                        for value in _response_multipliers(fixture["response"])
                    ),
                    6,
                ),
                "comparisonCohortSelected": review["comparisonCohortSelected"],
                "humanApproved": False,
                "productionApproved": False,
            }
        )

    if errors:
        raise ValueError("Candidate validation gate is invalid:\n- " + "\n- ".join(errors))
    common = {
        "schemaVersion": plan["schemaVersion"],
        "reviewVersion": plan["reviewVersion"],
        "modelVersion": plan["modelVersion"],
        "snapshotDate": plan["snapshotDate"],
        "planSha256": digest(plan),
        "observationStoreSha256": digest(observation_store),
        "notice": plan["notice"],
    }
    return {
        "curve-review-ledger.json": {
            **common,
            "reviewedCurveCount": len(curve_ledger),
            "reducedMagnitudeCount": len(revision_ids),
            "blockedCurveCount": sum(
                rule["reviewOutcome"] == "blocked-neutral" for rule in curve_ledger
            ),
            "rules": curve_ledger,
        },
        "comparison-cohort.json": {
            **common,
            "cohortRuleCount": len(cohort_rules),
            "rules": cohort_rules,
            "observationContract": plan["observationContract"],
            "validationStages": plan["validationStages"],
        },
        "validation-readiness-report.json": {
            **common,
            "status": status,
            "errorCount": 0,
            "independentObservationCount": len(observations),
            "comparisonCohortRuleCount": len(cohort_rules),
            "preRegistrationApproved": preregistration.get("approved") is True,
            "humanApproved": False,
            "productionApproved": False,
            "liveShadowEligibleCount": 0,
            "liveScorerEligibleCount": 0,
            "nextRequiredActions": preregistration["requiredBeforeObservationCollection"],
        },
    }


def write_or_check(outputs: dict[str, Any], output_dir: Path, check: bool) -> list[str]:
    differences: list[str] = []
    if check:
        for filename, value in outputs.items():
            path = output_dir / filename
            if not path.exists():
                differences.append(f"missing {path}")
            elif path.read_bytes() != json_bytes(value):
                differences.append(f"stale {path}")
        if output_dir.exists():
            for path in output_dir.glob("*.json"):
                if path.name not in outputs:
                    differences.append(f"unexpected {path}")
        return differences
    output_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="bitemap-validation-gate-") as temporary:
        temporary_dir = Path(temporary)
        for filename, value in outputs.items():
            (temporary_dir / filename).write_bytes(json_bytes(value))
        for filename in outputs:
            (temporary_dir / filename).replace(output_dir / filename)
    return differences


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--queue", type=Path, default=DEFAULT_QUEUE)
    parser.add_argument("--sources", type=Path, default=DEFAULT_SOURCES)
    parser.add_argument("--decisions", type=Path, default=DEFAULT_DECISIONS)
    parser.add_argument("--blueprints", type=Path, default=DEFAULT_BLUEPRINTS)
    parser.add_argument("--specs", type=Path, default=DEFAULT_SPECS)
    parser.add_argument("--plan", type=Path, default=DEFAULT_PLAN)
    parser.add_argument("--observations", type=Path, default=DEFAULT_OBSERVATIONS)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--check", action="store_true")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    outputs = build_outputs(
        load_json(args.queue.resolve()),
        load_json(args.sources.resolve()),
        load_json(args.decisions.resolve()),
        load_json(args.blueprints.resolve()),
        load_json(args.specs.resolve()),
        load_json(args.plan.resolve()),
        load_json(args.observations.resolve()),
    )
    differences = write_or_check(outputs, args.output.resolve(), args.check)
    readiness = outputs["validation-readiness-report.json"]
    print(
        "Candidate validation gate: "
        f"{readiness['comparisonCohortRuleCount']} comparison rules; "
        f"{readiness['independentObservationCount']} independent observations; "
        f"status {readiness['status']}."
    )
    print("Human approved: no. Production approved: no. Live-scorer eligible: 0.")
    if differences:
        for difference in differences:
            print(difference, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
