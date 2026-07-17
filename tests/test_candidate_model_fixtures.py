import json
from pathlib import Path

from scripts.candidate_model_fixtures import build_outputs, evaluate_spec


ROOT = Path(__file__).resolve().parents[1]
QUEUE = ROOT / "research" / "species" / "generated" / "model-translation-queue.json"
SOURCES = ROOT / "research" / "species" / "generated" / "source-registry.json"
DECISIONS = ROOT / "research" / "species" / "model-review" / "decisions.json"
BLUEPRINTS = ROOT / "research" / "species" / "model-review" / "candidate-blueprints.json"
SPECS = ROOT / "research" / "species" / "model-review" / "candidate-fixture-specs.json"


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def outputs():
    return build_outputs(
        load(QUEUE), load(SOURCES), load(DECISIONS), load(BLUEPRINTS), load(SPECS)
    )


def test_all_modelable_rules_have_versioned_nonproduction_fixtures():
    fixtures = outputs()["candidate-model-fixtures.json"]
    assert fixtures["modelVersion"] == "candidate-v0.2.0"
    assert fixtures["fixtureCount"] == 22
    assert fixtures["activeTestOnlyFixtureCount"] == 21
    assert fixtures["blockedFixtureCount"] == 1
    assert all(not rule["productionImportAllowed"] for rule in fixtures["rules"])
    assert all(not rule["eligibleForLiveScorer"] for rule in fixtures["rules"])


def test_fallfish_is_explicitly_blocked_and_neutral():
    specs = load(SPECS)
    fallfish = next(rule for rule in specs["rules"] if rule["ruleId"] == "rule-batch-8-fallfish-01")
    assert fallfish["status"] == "blocked-source-timing"
    assert evaluate_spec(
        fallfish, {"season": "summer", "solarPeriod": "late-day"}
    ) == 1.0


def test_every_golden_scenario_matches_the_isolated_evaluator():
    built = outputs()
    specs = {rule["ruleId"]: rule for rule in load(SPECS)["rules"]}
    scenarios = built["golden-scenarios.json"]["scenarios"]
    assert len(scenarios) >= 140
    for scenario in scenarios:
        rule_id = scenario["fixtureId"].split("@", 1)[0]
        assert evaluate_spec(specs[rule_id], scenario["inputs"]) == scenario["expectedMultiplier"]


def test_effects_stay_inside_the_declared_engineering_caps():
    fixtures = outputs()["candidate-model-fixtures.json"]
    for rule in fixtures["rules"]:
        cap = rule["effectCap"]
        for scenario_id in rule["goldenScenarioIds"]:
            scenario = next(
                item
                for item in outputs()["golden-scenarios.json"]["scenarios"]
                if item["scenarioId"] == scenario_id
            )
            assert cap["minimumMultiplier"] <= scenario["expectedMultiplier"]
            assert scenario["expectedMultiplier"] <= cap["maximumMultiplier"]


def test_known_correlated_rules_share_a_nonstacking_group():
    fixtures = outputs()["candidate-model-fixtures.json"]["rules"]
    by_id = {rule["ruleId"]: rule for rule in fixtures}
    channel_ids = [
        "rule-bitemap-channel-catfish-deep-verified-research-archive-channel-catfish-01",
        "rule-bitemap-channel-catfish-deep-verified-research-archive-channel-catfish-02",
        "rule-bitemap-channel-catfish-deep-verified-research-archive-channel-catfish-03",
    ]
    snakehead_ids = [
        "rule-batch-6-northern-snakehead-01",
        "rule-batch-6-northern-snakehead-02",
    ]
    assert {by_id[rule_id]["correlationGroup"] for rule_id in channel_ids} == {
        "channel-catfish-thermal"
    }
    assert {by_id[rule_id]["correlationGroup"] for rule_id in snakehead_ids} == {
        "northern-snakehead-diel-tide"
    }
    assert all(
        rule["combinationPolicy"].startswith("never-multiply") for rule in fixtures
    )


def test_candidate_artifacts_are_not_referenced_by_runtime_code():
    forbidden = ("candidate-fixture-specs", "candidate-model-fixtures", "golden-scenarios")
    runtime_roots = [ROOT / "app", ROOT / "apps" / "api" / "app"]
    for runtime_root in runtime_roots:
        for path in runtime_root.rglob("*"):
            if path.suffix not in {".py", ".ts", ".tsx", ".js", ".mjs"}:
                continue
            text = path.read_text(encoding="utf-8")
            assert not any(token in text for token in forbidden), path
