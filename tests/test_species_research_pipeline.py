import json
from pathlib import Path

from scripts.species_research_pipeline import (
    ResearchPipeline,
    endpoint_category,
    normalize_current_status,
    normalize_doi,
    normalize_model_use,
    normalize_recommendation,
    normalize_research_status,
    runtime_input,
)


ROOT = Path(__file__).resolve().parents[1]
ARCHIVES = ROOT / "research" / "species" / "raw" / "archives"
OVERRIDES = ROOT / "research" / "species" / "config" / "source-overrides.json"
EXPECTED_SPECIES = ROOT / "research" / "species" / "config" / "expected-species.json"
SCORED_PROFILES = ROOT / "app" / "lib" / "generated" / "species-profiles.json"
COMMUNITY_PROFILES = ROOT / "app" / "lib" / "community-fish-profiles.json"


def build_outputs():
    return ResearchPipeline(ARCHIVES, OVERRIDES).run()


def test_normalizers_handle_batch_schema_drift():
    assert normalize_doi("https://doi.org/10.1111/JFB.70189") == "10.1111/jfb.70189"
    assert normalize_model_use("context") == "context-only"
    assert normalize_model_use("rejected") == "zero-weight"
    assert normalize_research_status("PARTIAL") == "partial"
    assert normalize_research_status("complete-for-batch") == "partial"
    assert normalize_current_status("fish-guide-only") == "guide-only"
    assert normalize_recommendation("Proposed for bite scoring") == (
        "proposed-for-bite-scoring"
    )


def test_runtime_input_matrix_separates_available_and_unavailable_inputs():
    assert runtime_input("time of day") == {
        "inputKey": "light-and-diel",
        "availability": "available",
        "forecastResolution": "hourly",
    }
    assert runtime_input("fish total length mm")["availability"] == "unavailable"
    assert runtime_input("water temperature")["availability"] == "modeled"
    assert runtime_input("tidal stage")["availability"] == "conditional"
    assert runtime_input("recentStocking") == {
        "inputKey": "recent-stocking-event",
        "availability": "unavailable",
        "forecastResolution": "not-currently-ingested",
    }


def test_documented_absence_is_not_mislabeled_as_catchability_evidence():
    assert endpoint_category(
        {
            "whatWasMeasured": "Evidence-gap assessment",
            "evidenceType": "systematic review",
            "variable": "hook-and-line catchability",
            "observedEffect": "No qualifying experiment was located.",
        }
    ) == "evidence-gap"
    assert endpoint_category(
        {
            "whatWasMeasured": "Catch per angler-hour",
            "evidenceType": "field creel study",
            "variable": "time of day",
            "observedEffect": "Catch rate peaked near dusk.",
        }
    ) == "hook-and-line-catchability"


def test_real_archives_generate_a_link_complete_canonical_library():
    outputs = build_outputs()
    validation = outputs["validation-report.json"]
    coverage = outputs["coverage-matrix.json"]
    species_library = outputs["species-research.json"]
    sources = outputs["source-registry.json"]
    evidence = outputs["evidence-library.json"]
    translation = outputs["model-translation-queue.json"]

    assert validation["errorCount"] == 0
    expected_species_ids = set(
        json.loads(EXPECTED_SPECIES.read_text(encoding="utf-8"))["speciesIds"]
    )
    assert coverage["totals"]["archives"] == 14
    assert coverage["totals"]["species"] == 37
    assert coverage["totals"]["uniqueSources"] > 350
    assert coverage["totals"]["evidenceRecords"] > 500
    assert translation["scoreRuleCount"] > 60
    assert {item["speciesId"] for item in species_library["species"]} == (
        expected_species_ids
    )

    source_ids = {source["sourceId"] for source in sources["sources"]}
    evidence_ids = {item["evidenceId"] for item in evidence["evidence"]}
    rule_ids = {rule["ruleId"] for rule in translation["rules"]}

    for item in evidence["evidence"]:
        assert item["sourceId"] in source_ids
    for rule in translation["rules"]:
        assert set(rule["evidenceIds"]) <= evidence_ids
        assert rule["scientificReviewStatus"] != "production-approved"
    for species in species_library["species"]:
        assert set(species["sourceIds"]) <= source_ids
        assert set(species["evidenceIds"]) <= evidence_ids
        assert set(species["candidateRuleIds"]) <= rule_ids


def test_deep_research_catalog_remains_covered_when_regional_guide_additions_are_present():
    expected_species_ids = set(
        json.loads(EXPECTED_SPECIES.read_text(encoding="utf-8"))["speciesIds"]
    )
    profile_species_ids = set()
    for path in (SCORED_PROFILES, COMMUNITY_PROFILES):
        value = json.loads(path.read_text(encoding="utf-8"))
        profile_species_ids.update(item["speciesId"] for item in value["profiles"])
    assert expected_species_ids <= profile_species_ids
    assert profile_species_ids - expected_species_ids == {
        "american-shad",
        "hickory-shad",
        "longnose-gar",
        "saugeye",
    }


def test_reviewed_source_override_is_auditable():
    outputs = build_outputs()
    sources = outputs["source-registry.json"]["sources"]
    occurrence = None
    canonical_source = None
    for source in sources:
        for candidate in source["occurrences"]:
            if (
                candidate["archiveId"] == "batch-5"
                and candidate["speciesId"] == "striped-bass"
                and candidate["localSourceId"] == "S11"
            ):
                occurrence = candidate
                canonical_source = source
                break
    assert occurrence is not None
    assert canonical_source is not None
    assert occurrence["correction"]["changes"]
    assert "Joseph A. Mihursky" in canonical_source["authorsOrAgency"]
    assert canonical_source["url"] == "https://repository.library.noaa.gov/view/noaa/2955"


def test_manifest_semantic_drift_is_preserved_as_warning():
    outputs = build_outputs()
    diagnostics = outputs["validation-report.json"]["diagnostics"]
    warning_keys = {(item.get("archiveId"), item["code"]) for item in diagnostics}
    assert ("batch-9", "manifest.zero-weight-mixed-semantics") in warning_keys
    assert ("batch-10", "manifest.zero-weight-mixed-semantics") in warning_keys
    assert ("batch-11", "manifest.zero-weight-mixed-semantics") in warning_keys
    assert (
        "batch-7",
        "source.search-or-listing-page-not-source-record",
    ) in warning_keys
    assert (
        "bitemap-largemouth-bass-research-archive",
        "archive.missing-validation-report",
    ) in warning_keys


def test_pilot_archives_map_nested_safe_to_implement_rules():
    outputs = build_outputs()
    species = {
        item["speciesId"]: item
        for item in outputs["species-research.json"]["species"]
    }
    for species_id in ("channel-catfish", "largemouth-bass", "smallmouth-bass"):
        assert species[species_id]["promotionRecommendation"] == "bite-scored"
