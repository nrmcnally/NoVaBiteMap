#!/usr/bin/env python3
"""Build the isolated scientific model-review ledger.

The outputs produced here are review artifacts. They are deliberately stored
outside the production data paths and must never be interpreted as live-scoring
approval.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import tempfile
from collections import Counter
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_QUEUE = ROOT / "research" / "species" / "generated" / "model-translation-queue.json"
DEFAULT_SOURCES = ROOT / "research" / "species" / "generated" / "source-registry.json"
DEFAULT_DECISIONS = ROOT / "research" / "species" / "model-review" / "decisions.json"
DEFAULT_BLUEPRINTS = ROOT / "research" / "species" / "model-review" / "candidate-blueprints.json"
DEFAULT_OUTPUT = ROOT / "research" / "species" / "model-review" / "generated"

ALLOWED_DISPOSITIONS = {
    "production-candidate",
    "evidence-informed-candidate",
    "unavailable-input",
    "context-only",
    "zero-weight",
}
DIRECT_ENDPOINTS = {"feeding-or-foraging", "hook-and-line-catchability"}
PRODUCTION_BLOCK = "blocked-pending-human-source-and-curve-review"


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def json_bytes(value: Any) -> bytes:
    return (json.dumps(value, indent=2, ensure_ascii=False) + "\n").encode("utf-8")


def digest(value: Any) -> str:
    return hashlib.sha256(json_bytes(value)).hexdigest()


def _approval_status(disposition: str) -> str:
    return {
        "production-candidate": PRODUCTION_BLOCK,
        "evidence-informed-candidate": "blocked-pending-source-curve-and-validation-review",
        "unavailable-input": "blocked-runtime-contract",
        "context-only": "non-scoring-context",
        "zero-weight": "zero-weight-retained-for-audit",
    }[disposition]


def _next_action(disposition: str) -> str:
    return {
        "production-candidate": "Human source sign-off, bounded curve design, adversarial tests, and held-out validation.",
        "evidence-informed-candidate": "Complete source-passage review and validate the bounded evidence-informed curve before integration.",
        "unavailable-input": "Wait for the exact runtime input; do not substitute a scientifically different proxy.",
        "context-only": "Use as explanatory biological context, not as a score modifier.",
        "zero-weight": "Preserve the evidence trail and assign no scoring weight.",
    }[disposition]


def build_outputs(
    queue: dict[str, Any],
    sources: dict[str, Any],
    decisions: dict[str, Any],
    blueprint_config: dict[str, Any],
) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []

    score_rules = [
        rule for rule in queue["rules"] if rule["recommendedModelUse"] == "score"
    ]
    rule_by_id = {rule["ruleId"]: rule for rule in score_rules}
    source_by_id = {source["sourceId"]: source for source in sources["sources"]}

    decision_by_rule: dict[str, dict[str, Any]] = {}
    for group in decisions.get("decisionGroups", []):
        disposition = group.get("disposition")
        if disposition not in ALLOWED_DISPOSITIONS:
            errors.append(f"unknown disposition {disposition!r}")
            continue
        if not group.get("rationale"):
            errors.append(f"{disposition}: rationale is required")
        if not group.get("requiredActions"):
            errors.append(f"{disposition}: requiredActions are required")
        for rule_id in group.get("ruleIds", []):
            if rule_id in decision_by_rule:
                errors.append(f"{rule_id}: assigned to more than one decision group")
            decision_by_rule[rule_id] = group

    score_ids = set(rule_by_id)
    decision_ids = set(decision_by_rule)
    for rule_id in sorted(score_ids - decision_ids):
        errors.append(f"{rule_id}: score rule has no review disposition")
    for rule_id in sorted(decision_ids - score_ids):
        errors.append(f"{rule_id}: decision does not reference a score rule")

    cohort_ids = decisions.get("initialValidationCohortRuleIds", [])
    cohort_counts = Counter(cohort_ids)
    for rule_id, count in cohort_counts.items():
        if count > 1:
            errors.append(f"{rule_id}: repeated in initial validation cohort")
        if rule_id not in score_ids:
            errors.append(f"{rule_id}: cohort entry is not a score rule")

    preflights = decisions.get("primarySourcePreflights", {})
    blueprint_by_rule: dict[str, dict[str, Any]] = {}
    for blueprint in blueprint_config.get("rules", []):
        rule_id = blueprint.get("ruleId")
        if rule_id in blueprint_by_rule:
            errors.append(f"{rule_id}: duplicate candidate blueprint")
        blueprint_by_rule[rule_id] = blueprint
    production_ids = {
        rule_id
        for rule_id, group in decision_by_rule.items()
        if group["disposition"] == "production-candidate"
    }
    modelable_ids = {
        rule_id
        for rule_id, group in decision_by_rule.items()
        if group["disposition"]
        in {"production-candidate", "evidence-informed-candidate"}
    }
    if set(blueprint_by_rule) != modelable_ids:
        errors.append(
            "candidate blueprints must exactly match all modelable rule IDs"
        )
    required_blueprint_fields = {
        "evidenceClass",
        "modelConfidence",
        "sourceReviewStatus",
        "inputContract",
        "validRange",
        "integrationMode",
        "curveType",
        "proposedResponse",
        "effectCapTier",
        "missingBehavior",
        "doubleCountingGuard",
        "validationRequirements",
    }
    for tier, envelope in blueprint_config.get("effectCapPolicy", {}).items():
        minimum = envelope.get("minimumMultiplier")
        maximum = envelope.get("maximumMultiplier")
        if not isinstance(minimum, (int, float)) or not isinstance(
            maximum, (int, float)
        ):
            errors.append(f"{tier}: effect cap multipliers must be numeric")
        elif not (0 < minimum <= 1 <= maximum):
            errors.append(f"{tier}: effect cap must contain neutral multiplier 1.0")
    for rule_id, blueprint in blueprint_by_rule.items():
        missing = sorted(required_blueprint_fields - set(blueprint))
        if missing:
            errors.append(f"{rule_id}: blueprint missing {', '.join(missing)}")
        if blueprint.get("effectCapTier") not in blueprint_config.get(
            "effectCapPolicy", {}
        ):
            errors.append(f"{rule_id}: unknown effectCapTier")
        if any(
            marker in blueprint.get("sourceReviewStatus", "")
            for marker in ("pending", "unavailable")
        ) and "neutral" not in (
            blueprint.get("proposedResponse", "").lower()
            + " "
            + blueprint.get("missingBehavior", "").lower()
        ):
            errors.append(
                f"{rule_id}: a source-pending blueprint must remain neutral"
            )
    for rule_id in preflights:
        if rule_id not in score_ids:
            errors.append(f"{rule_id}: source preflight is not attached to a score rule")
    for rule_id in production_ids:
        rule = rule_by_id[rule_id]
        if rule["availability"] in {"unavailable", "unknown"}:
            errors.append(f"{rule_id}: production candidate lacks a runtime input")
        if not (set(rule["endpointCategories"]) & DIRECT_ENDPOINTS):
            errors.append(f"{rule_id}: production candidate lacks a direct endpoint")
        if "no-direct-feeding-or-catchability-endpoint" in rule.get("concerns", []):
            errors.append(f"{rule_id}: production candidate has an endpoint concern")
        if rule_id not in preflights:
            errors.append(f"{rule_id}: production candidate lacks primary-source preflight")

    ledger: list[dict[str, Any]] = []
    for rule in score_rules:
        rule_id = rule["ruleId"]
        group = decision_by_rule.get(rule_id)
        if group is None:
            continue
        disposition = group["disposition"]
        source_records = []
        for source_id in rule["sourceIds"]:
            source = source_by_id.get(source_id)
            if source is None:
                errors.append(f"{rule_id}: unknown source {source_id}")
                continue
            verification = source.get("verificationSummary", {})
            source_records.append(
                {
                    "sourceId": source_id,
                    "citation": source.get("citation"),
                    "url": source.get("url"),
                    "canonicalHumanVerified": bool(verification.get("humanVerified")),
                    "fullTextConfirmedOccurrences": verification.get(
                        "fullTextConfirmedOccurrences", 0
                    ),
                    "abstractOnlyOccurrences": verification.get(
                        "abstractOnlyOccurrences", 0
                    ),
                }
            )
        canonical_human_verified = bool(source_records) and all(
            source["canonicalHumanVerified"] for source in source_records
        )
        preflight = preflights.get(rule_id)
        if preflight and preflight.get("humanApproved"):
            warnings.append(
                f"{rule_id}: humanApproved is true; production approval still requires a separate sign-off record"
            )
        ledger.append(
            {
                "ruleId": rule_id,
                "speciesId": rule["speciesId"],
                "disposition": disposition,
                "reasonCode": group["reasonCode"],
                "rationale": group["rationale"],
                "requiredActions": group["requiredActions"],
                "input": rule["input"],
                "inputKey": rule["inputKey"],
                "runtimeAvailability": rule["availability"],
                "forecastResolution": rule["forecastResolution"],
                "condition": rule["condition"],
                "direction": rule["direction"],
                "strength": rule["strength"],
                "confidence": rule["confidence"],
                "endpointCategories": rule["endpointCategories"],
                "concerns": rule.get("concerns", []),
                "sourceRecords": source_records,
                "canonicalSourcesHumanVerified": canonical_human_verified,
                "primarySourcePreflight": preflight,
                "translationBlueprint": blueprint_by_rule.get(rule_id),
                "inInitialValidationCohort": rule_id in cohort_counts,
                "approvalStatus": _approval_status(disposition),
                "eligibleForLiveScorer": False,
                "nextAction": _next_action(disposition),
            }
        )

    disposition_counts = Counter(item["disposition"] for item in ledger)
    cohort = [item for item in ledger if item["inInitialValidationCohort"]]
    cohort.sort(key=lambda item: cohort_ids.index(item["ruleId"]))
    modelable = [
        item
        for item in ledger
        if item["disposition"]
        in {"production-candidate", "evidence-informed-candidate"}
    ]
    source_review_pending = [
        item
        for item in modelable
        if "pending" in item["translationBlueprint"]["sourceReviewStatus"]
    ]
    source_review_blocked = [
        item
        for item in modelable
        if "unavailable" in item["translationBlueprint"]["sourceReviewStatus"]
    ]

    validation = {
        "schemaVersion": decisions["schemaVersion"],
        "snapshotDate": decisions["snapshotDate"],
        "status": "fail" if errors else ("pass-with-warnings" if warnings else "pass"),
        "errorCount": len(errors),
        "warningCount": len(warnings),
        "errors": errors,
        "warnings": warnings,
        "checks": {
            "scoreRuleCount": len(score_rules),
            "reviewedRuleCount": len(ledger),
            "allScoreRulesAssignedExactlyOnce": not (score_ids ^ decision_ids)
            and len(decision_by_rule) == len(score_ids),
            "productionCandidateCount": len(production_ids),
            "modelableRuleCount": len(modelable),
            "candidateBlueprintCount": len(blueprint_by_rule),
            "sourceReviewPendingCount": len(source_review_pending),
            "sourceReviewBlockedCount": len(source_review_blocked),
            "liveScorerEligibleCount": sum(
                item["eligibleForLiveScorer"] for item in ledger
            ),
            "cohortRuleCount": len(cohort),
        },
    }
    if errors:
        raise ValueError("Model-review configuration is invalid:\n- " + "\n- ".join(errors))

    common = {
        "schemaVersion": decisions["schemaVersion"],
        "snapshotDate": decisions["snapshotDate"],
        "decisionSha256": digest(decisions),
        "candidateBlueprintSha256": digest(blueprint_config),
        "notice": decisions["notice"],
    }
    return {
        "model-review-ledger.json": {
            **common,
            "summary": {
                "scoreRuleCount": len(score_rules),
                "reviewedRuleCount": len(ledger),
                "dispositionCounts": {
                    disposition: disposition_counts[disposition]
                    for disposition in sorted(ALLOWED_DISPOSITIONS)
                },
                "productionApprovedCount": 0,
                "liveScorerEligibleCount": 0,
                "modelableRuleCount": len(modelable),
                "sourceReviewPendingCount": len(source_review_pending),
                "sourceReviewBlockedCount": len(source_review_blocked),
            },
            "effectCapPolicy": blueprint_config["effectCapPolicy"],
            "rules": ledger,
        },
        "initial-validation-cohort.json": {
            **common,
            "cohortRuleCount": len(cohort),
            "productionCandidateCount": sum(
                item["disposition"] == "production-candidate" for item in cohort
            ),
            "evidenceInformedCandidateCount": sum(
                item["disposition"] == "evidence-informed-candidate"
                for item in cohort
            ),
            "rules": cohort,
        },
        "validation-report.json": validation,
    }


def write_or_check(outputs: dict[str, Any], output_dir: Path, check: bool) -> list[str]:
    differences: list[str] = []
    if check:
        for filename, value in outputs.items():
            path = output_dir / filename
            expected = json_bytes(value)
            if not path.exists():
                differences.append(f"missing {path}")
            elif path.read_bytes() != expected:
                differences.append(f"stale {path}")
        if output_dir.exists():
            for path in output_dir.glob("*.json"):
                if path.name not in outputs:
                    differences.append(f"unexpected {path}")
        return differences

    output_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="bitemap-model-review-") as temporary:
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
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument(
        "--check", action="store_true", help="Fail if review outputs are missing or stale."
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    outputs = build_outputs(
        load_json(args.queue.resolve()),
        load_json(args.sources.resolve()),
        load_json(args.decisions.resolve()),
        load_json(args.blueprints.resolve()),
    )
    differences = write_or_check(outputs, args.output.resolve(), args.check)
    ledger = outputs["model-review-ledger.json"]
    summary = ledger["summary"]
    counts = summary["dispositionCounts"]
    print(
        "Model review audit: "
        f"{summary['reviewedRuleCount']} score rules; "
        f"{counts['production-candidate']} production candidates, "
        f"{counts['evidence-informed-candidate']} evidence-informed, "
        f"{counts['unavailable-input']} unavailable-input, "
        f"{counts['context-only']} context-only, "
        f"{counts['zero-weight']} zero-weight."
    )
    print("Production approved: 0. Live-scorer eligible: 0.")
    if differences:
        for difference in differences:
            print(difference, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
