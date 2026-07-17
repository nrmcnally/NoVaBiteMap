#!/usr/bin/env python3
"""Build deterministic, non-production candidate-model fixtures and scenarios."""

from __future__ import annotations

import argparse
import json
import math
import sys
import tempfile
from pathlib import Path
from typing import Any

if __package__:
    from scripts.model_review_audit import (
        DEFAULT_BLUEPRINTS,
        DEFAULT_DECISIONS,
        DEFAULT_QUEUE,
        DEFAULT_SOURCES,
        build_outputs as build_model_review_outputs,
        digest,
        json_bytes,
        load_json,
    )
else:
    from model_review_audit import (
        DEFAULT_BLUEPRINTS,
        DEFAULT_DECISIONS,
        DEFAULT_QUEUE,
        DEFAULT_SOURCES,
        build_outputs as build_model_review_outputs,
        digest,
        json_bytes,
        load_json,
    )


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SPECS = (
    ROOT
    / "research"
    / "species"
    / "model-review"
    / "candidate-fixture-specs.json"
)
DEFAULT_OUTPUT = (
    ROOT
    / "research"
    / "species"
    / "model-review"
    / "generated"
    / "candidate-fixtures"
)
ALLOWED_STATUSES = {"candidate-test-only", "blocked-source-timing"}
SUPPORTED_RESPONSES = {
    "blocked-neutral",
    "categorical",
    "constant",
    "piecewise-linear",
}
TOLERANCE = 1e-9


def _gate_passes(gate: dict[str, Any], inputs: dict[str, Any]) -> bool:
    key = gate["input"]
    if key not in inputs or inputs[key] is None:
        return False
    value = inputs[key]
    operator = gate["operator"]
    if operator == "equals":
        return value == gate["value"]
    if operator == "in":
        return value in gate["values"]
    if operator == "range":
        return gate["minimum"] <= value <= gate["maximum"]
    if operator == "at-least":
        return value >= gate["minimum"]
    raise ValueError(f"Unsupported gate operator: {operator}")


def evaluate_spec(spec: dict[str, Any], inputs: dict[str, Any]) -> float:
    """Evaluate one isolated candidate modifier; never evaluates the live score."""

    if spec["status"] == "blocked-source-timing":
        return 1.0
    if not all(_gate_passes(gate, inputs) for gate in spec.get("gates", [])):
        return 1.0

    response = spec["response"]
    response_type = response["type"]
    if response_type == "blocked-neutral":
        return 1.0
    if response_type == "constant":
        return float(response["multiplier"])

    input_key = response["input"]
    if input_key not in inputs or inputs[input_key] is None:
        return 1.0
    input_value = inputs[input_key]

    if response_type == "categorical":
        return float(response["values"].get(str(input_value), 1.0))

    if response_type != "piecewise-linear":
        raise ValueError(f"Unsupported response type: {response_type}")
    if not isinstance(input_value, (int, float)) or isinstance(input_value, bool):
        return 1.0

    anchors = sorted(response["anchors"], key=lambda anchor: anchor[0])
    lower_x, lower_y = anchors[0]
    upper_x, upper_y = anchors[-1]
    outside = response["outsideRange"]
    if input_value < lower_x:
        return float(lower_y) if outside == "clamp" else 1.0
    if input_value > upper_x:
        return float(upper_y) if outside == "clamp" else 1.0
    for left, right in zip(anchors, anchors[1:]):
        left_x, left_y = left
        right_x, right_y = right
        if left_x <= input_value <= right_x:
            if math.isclose(left_x, right_x):
                return float(right_y)
            fraction = (input_value - left_x) / (right_x - left_x)
            return float(left_y + fraction * (right_y - left_y))
    return float(upper_y)


def _slug(value: Any) -> str:
    return (
        str(value)
        .lower()
        .replace(" ", "-")
        .replace("/", "-")
        .replace(".", "p")
    )


def _active_inputs(spec: dict[str, Any]) -> dict[str, Any]:
    return {gate["input"]: gate["testValue"] for gate in spec.get("gates", [])}


def _response_probe(spec: dict[str, Any]) -> tuple[str, Any] | None:
    response = spec["response"]
    if response["type"] == "categorical":
        return response["input"], next(iter(response["values"]))
    if response["type"] == "piecewise-linear":
        return response["input"], response["anchors"][0][0]
    return None


def build_scenarios(spec: dict[str, Any], model_version: str) -> list[dict[str, Any]]:
    rule_id = spec["ruleId"]
    fixture_id = f"{rule_id}@{model_version}"
    if spec["status"] == "blocked-source-timing":
        inputs = {"season": "summer", "solarPeriod": "late-day"}
        return [
            {
                "scenarioId": f"{rule_id}:blocked-neutral",
                "fixtureId": fixture_id,
                "inputs": inputs,
                "expectedMultiplier": 1.0,
                "reason": "Unverified peak timing keeps the fixture neutral.",
            }
        ]

    scenarios: list[dict[str, Any]] = []
    base = _active_inputs(spec)
    probe = _response_probe(spec)
    if probe:
        base[probe[0]] = probe[1]

    for gate in spec.get("gates", []):
        missing = dict(base)
        missing.pop(gate["input"], None)
        scenarios.append(
            {
                "scenarioId": f"{rule_id}:missing-gate-{_slug(gate['input'])}",
                "fixtureId": fixture_id,
                "inputs": missing,
                "expectedMultiplier": 1.0,
                "reason": "A missing scope gate must be neutral.",
            }
        )
        failed = dict(base)
        failed[gate["input"]] = gate["testFailValue"]
        scenarios.append(
            {
                "scenarioId": f"{rule_id}:failed-gate-{_slug(gate['input'])}",
                "fixtureId": fixture_id,
                "inputs": failed,
                "expectedMultiplier": 1.0,
                "reason": "An out-of-scope gate must be neutral.",
            }
        )

    response = spec["response"]
    response_type = response["type"]
    if response_type in {"categorical", "piecewise-linear"}:
        missing = _active_inputs(spec)
        scenarios.append(
            {
                "scenarioId": f"{rule_id}:missing-response-input",
                "fixtureId": fixture_id,
                "inputs": missing,
                "expectedMultiplier": 1.0,
                "reason": "A missing response input must be neutral.",
            }
        )

    if response_type == "categorical":
        input_key = response["input"]
        for category in response["values"]:
            inputs = _active_inputs(spec)
            inputs[input_key] = category
            scenarios.append(
                {
                    "scenarioId": f"{rule_id}:category-{_slug(category)}",
                    "fixtureId": fixture_id,
                    "inputs": inputs,
                    "expectedMultiplier": evaluate_spec(spec, inputs),
                    "reason": "Verified categorical response value.",
                }
            )
        unknown = _active_inputs(spec)
        unknown[input_key] = "unmapped-category"
        scenarios.append(
            {
                "scenarioId": f"{rule_id}:unknown-category",
                "fixtureId": fixture_id,
                "inputs": unknown,
                "expectedMultiplier": 1.0,
                "reason": "An unmapped category must be neutral.",
            }
        )
        ignored = response.get("ignoredCorrelatedInputs", [])
        if ignored:
            correlated = _active_inputs(spec)
            first_category = next(iter(response["values"]))
            correlated[input_key] = first_category
            for ignored_key in ignored:
                correlated[ignored_key] = 999
            scenarios.append(
                {
                    "scenarioId": f"{rule_id}:correlated-inputs-ignored",
                    "fixtureId": fixture_id,
                    "inputs": correlated,
                    "expectedMultiplier": evaluate_spec(spec, correlated),
                    "reason": "Correlated light inputs cannot stack with the selected representation.",
                }
            )

    elif response_type == "piecewise-linear":
        input_key = response["input"]
        anchors = sorted(response["anchors"], key=lambda anchor: anchor[0])
        for value, _ in anchors:
            inputs = _active_inputs(spec)
            inputs[input_key] = value
            scenarios.append(
                {
                    "scenarioId": f"{rule_id}:anchor-{_slug(value)}",
                    "fixtureId": fixture_id,
                    "inputs": inputs,
                    "expectedMultiplier": evaluate_spec(spec, inputs),
                    "reason": "Candidate anchor must remain exact.",
                }
            )
        for left, right in zip(anchors, anchors[1:]):
            midpoint = (left[0] + right[0]) / 2
            inputs = _active_inputs(spec)
            inputs[input_key] = midpoint
            scenarios.append(
                {
                    "scenarioId": f"{rule_id}:midpoint-{_slug(midpoint)}",
                    "fixtureId": fixture_id,
                    "inputs": inputs,
                    "expectedMultiplier": evaluate_spec(spec, inputs),
                    "reason": "Piecewise interpolation must be deterministic.",
                }
            )
        for label, value in (
            ("below-range", anchors[0][0] - 1),
            ("above-range", anchors[-1][0] + 1),
        ):
            inputs = _active_inputs(spec)
            inputs[input_key] = value
            scenarios.append(
                {
                    "scenarioId": f"{rule_id}:{label}",
                    "fixtureId": fixture_id,
                    "inputs": inputs,
                    "expectedMultiplier": evaluate_spec(spec, inputs),
                    "reason": f"Outside-range behavior is {response['outsideRange']}.",
                }
            )

    elif response_type == "constant":
        inputs = _active_inputs(spec)
        scenarios.append(
            {
                "scenarioId": f"{rule_id}:all-gates-active",
                "fixtureId": fixture_id,
                "inputs": inputs,
                "expectedMultiplier": evaluate_spec(spec, inputs),
                "reason": "The exact severe condition activates the capped guardrail.",
            }
        )
    return scenarios


def _response_multipliers(response: dict[str, Any]) -> list[float]:
    if response["type"] == "categorical":
        return [float(value) for value in response["values"].values()]
    if response["type"] == "piecewise-linear":
        return [float(anchor[1]) for anchor in response["anchors"]]
    if response["type"] == "constant":
        return [float(response["multiplier"])]
    return [1.0]


def _value_multiplier(spec: dict[str, Any], value: Any) -> float:
    inputs = _active_inputs(spec)
    response = spec["response"]
    inputs[response["input"]] = value
    return evaluate_spec(spec, inputs)


def build_outputs(
    queue: dict[str, Any],
    sources: dict[str, Any],
    decisions: dict[str, Any],
    blueprints: dict[str, Any],
    specs: dict[str, Any],
) -> dict[str, Any]:
    errors: list[str] = []
    model_review = build_model_review_outputs(queue, sources, decisions, blueprints)
    ledger = model_review["model-review-ledger.json"]
    modelable = {
        rule["ruleId"]: rule
        for rule in ledger["rules"]
        if rule["disposition"]
        in {"production-candidate", "evidence-informed-candidate"}
    }
    spec_by_rule: dict[str, dict[str, Any]] = {}
    for spec in specs.get("rules", []):
        rule_id = spec.get("ruleId")
        if rule_id in spec_by_rule:
            errors.append(f"{rule_id}: duplicate fixture spec")
        spec_by_rule[rule_id] = spec
    if set(spec_by_rule) != set(modelable):
        missing = sorted(set(modelable) - set(spec_by_rule))
        extra = sorted(set(spec_by_rule) - set(modelable))
        if missing:
            errors.append(f"missing fixture specs: {', '.join(missing)}")
        if extra:
            errors.append(f"unexpected fixture specs: {', '.join(extra)}")

    fixture_rules: list[dict[str, Any]] = []
    all_scenarios: list[dict[str, Any]] = []
    for rule_id, spec in spec_by_rule.items():
        ledger_rule = modelable.get(rule_id)
        if ledger_rule is None:
            continue
        status = spec.get("status")
        if status not in ALLOWED_STATUSES:
            errors.append(f"{rule_id}: unsupported fixture status {status}")
        response = spec.get("response", {})
        response_type = response.get("type")
        if response_type not in SUPPORTED_RESPONSES:
            errors.append(f"{rule_id}: unsupported response type {response_type}")
            continue
        source_status = ledger_rule["translationBlueprint"]["sourceReviewStatus"]
        if status == "blocked-source-timing":
            if response_type != "blocked-neutral":
                errors.append(f"{rule_id}: blocked fixture must use blocked-neutral")
            if "unavailable" not in source_status:
                errors.append(f"{rule_id}: blocked timing must be explicit in source review")
        elif "pending" in source_status or "unavailable" in source_status:
            errors.append(f"{rule_id}: unresolved source cannot activate a fixture")

        cap_tier = ledger_rule["translationBlueprint"]["effectCapTier"]
        cap = blueprints["effectCapPolicy"][cap_tier]
        for multiplier in _response_multipliers(response):
            if not (
                cap["minimumMultiplier"] - TOLERANCE
                <= multiplier
                <= cap["maximumMultiplier"] + TOLERANCE
            ):
                errors.append(
                    f"{rule_id}: multiplier {multiplier} exceeds {cap_tier} cap"
                )

        for assertion in spec.get("orderingAssertions", []):
            if "lower" in assertion:
                lower = _value_multiplier(spec, assertion["lower"])
                higher = _value_multiplier(spec, assertion["higher"])
                if not lower < higher:
                    errors.append(
                        f"{rule_id}: ordering failed {assertion['lower']} < {assertion['higher']}"
                    )
            elif "equal" in assertion:
                values = [_value_multiplier(spec, value) for value in assertion["equal"]]
                if not all(math.isclose(values[0], value) for value in values[1:]):
                    errors.append(f"{rule_id}: equality assertion failed")
            else:
                errors.append(f"{rule_id}: malformed ordering assertion")

        scenarios = build_scenarios(spec, specs["modelVersion"])
        for scenario in scenarios:
            actual = evaluate_spec(spec, scenario["inputs"])
            if not math.isclose(actual, scenario["expectedMultiplier"], abs_tol=TOLERANCE):
                errors.append(f"{scenario['scenarioId']}: expected {scenario['expectedMultiplier']}, got {actual}")
        all_scenarios.extend(scenarios)
        fixture_rules.append(
            {
                "fixtureId": f"{rule_id}@{specs['modelVersion']}",
                "ruleId": rule_id,
                "speciesId": ledger_rule["speciesId"],
                "status": status,
                "productionImportAllowed": False,
                "eligibleForLiveScorer": False,
                "disposition": ledger_rule["disposition"],
                "inputKey": ledger_rule["inputKey"],
                "forecastResolution": ledger_rule["forecastResolution"],
                "sourceReviewStatus": source_status,
                "sourceRecords": ledger_rule["sourceRecords"],
                "evidenceClass": ledger_rule["translationBlueprint"]["evidenceClass"],
                "modelConfidence": ledger_rule["translationBlueprint"]["modelConfidence"],
                "inputContract": ledger_rule["translationBlueprint"]["inputContract"],
                "validRange": ledger_rule["translationBlueprint"]["validRange"],
                "integrationMode": ledger_rule["translationBlueprint"]["integrationMode"],
                "correlationGroup": spec["correlationGroup"],
                "combinationPolicy": "never-multiply-with-another-member-of-this-correlation-group",
                "effectCap": {"tier": cap_tier, **cap},
                "missingMultiplier": specs["neutralMultiplier"],
                "gates": spec.get("gates", []),
                "response": response,
                "orderingAssertions": spec.get("orderingAssertions", []),
                "validationRequirements": ledger_rule["translationBlueprint"]["validationRequirements"],
                "goldenScenarioIds": [scenario["scenarioId"] for scenario in scenarios],
            }
        )

    scenario_ids = [scenario["scenarioId"] for scenario in all_scenarios]
    if len(scenario_ids) != len(set(scenario_ids)):
        errors.append("golden scenario IDs must be unique")
    blocked = [rule for rule in fixture_rules if rule["status"] != "candidate-test-only"]
    validation = {
        "schemaVersion": specs["schemaVersion"],
        "modelVersion": specs["modelVersion"],
        "snapshotDate": specs["snapshotDate"],
        "status": "fail" if errors else "pass",
        "errorCount": len(errors),
        "errors": errors,
        "checks": {
            "modelableRuleCount": len(modelable),
            "fixtureRuleCount": len(fixture_rules),
            "activeTestOnlyFixtureCount": len(fixture_rules) - len(blocked),
            "blockedFixtureCount": len(blocked),
            "goldenScenarioCount": len(all_scenarios),
            "allProductionImportsDisabled": all(
                not rule["productionImportAllowed"] for rule in fixture_rules
            ),
            "allLiveScorerEligibilityDisabled": all(
                not rule["eligibleForLiveScorer"] for rule in fixture_rules
            ),
        },
    }
    if errors:
        raise ValueError("Candidate fixture configuration is invalid:\n- " + "\n- ".join(errors))

    common = {
        "schemaVersion": specs["schemaVersion"],
        "modelVersion": specs["modelVersion"],
        "snapshotDate": specs["snapshotDate"],
        "specSha256": digest(specs),
        "modelReviewLedgerSha256": digest(ledger),
        "notice": specs["notice"],
    }
    return {
        "candidate-model-fixtures.json": {
            **common,
            "fixtureCount": len(fixture_rules),
            "activeTestOnlyFixtureCount": len(fixture_rules) - len(blocked),
            "blockedFixtureCount": len(blocked),
            "rules": fixture_rules,
        },
        "golden-scenarios.json": {
            **common,
            "scenarioCount": len(all_scenarios),
            "scenarios": all_scenarios,
        },
        "fixture-validation-report.json": validation,
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
    with tempfile.TemporaryDirectory(prefix="bitemap-candidate-fixtures-") as temporary:
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
    )
    differences = write_or_check(outputs, args.output.resolve(), args.check)
    fixtures = outputs["candidate-model-fixtures.json"]
    scenarios = outputs["golden-scenarios.json"]
    print(
        "Candidate fixture audit: "
        f"{fixtures['fixtureCount']} fixtures "
        f"({fixtures['activeTestOnlyFixtureCount']} active test-only, "
        f"{fixtures['blockedFixtureCount']} blocked); "
        f"{scenarios['scenarioCount']} golden scenarios."
    )
    print("Production imports: disabled. Live-scorer eligibility: disabled.")
    if differences:
        for difference in differences:
            print(difference, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
