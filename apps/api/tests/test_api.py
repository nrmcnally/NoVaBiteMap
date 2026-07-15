from __future__ import annotations


def test_health_and_openapi(client):
    assert client.get("/health").status_code == 200
    assert client.get("/openapi.json").status_code == 200


def test_locations_list_has_provenance_backed_locations(client):
    locations = client.get("/api/locations", params={"limit": 200}).json()
    assert len(locations) == 196  # curated + region-wide DWR ramps + NHD public-park waters
    assert all(item.get("sourceName") for item in locations)
    ids = {item["id"] for item in locations}
    assert {"lake-fairfax", "gravelly-point", "beaverdam-reservoir", "kellys-ford"}.issubset(ids)


def test_explore_catalog_is_canonical_and_score_consistent(client):
    response = client.get("/api/explore")
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["dataSource"] == "canonical-api"
    assert payload["counts"] == {"species": 20, "locations": 196}
    assert len(payload["species"]) == 20
    burke = next(item for item in payload["locations"] if item["id"] == "lake-burke")
    assert burke["runtimeSource"] == "canonical-api"
    assert burke["consumptionAdvisory"] is not None
    assert "largemouth-bass" in burke["opportunities"]
    explore_score = burke["opportunities"]["largemouth-bass"]["score"]
    detail = client.get("/api/locations/lake-burke/species", params={"live": "false"}).json()
    detail_score = next(item for item in detail["species"] if item["speciesId"] == "largemouth-bass")["opportunity_score"]
    assert explore_score == detail_score


def test_access_status_classifies_public_waters(client):
    locations = client.get("/api/locations", params={"limit": 200}).json()
    by_status = {}
    for item in locations:
        by_status[item.get("accessStatus", "verified")] = by_status.get(item.get("accessStatus", "verified"), 0) + 1
    assert by_status["verified"] >= 80
    assert by_status["listed"] >= 5  # named waters on public parkland
    # DWR-added ramps are verified; NHD park waters are listed
    dwr = next(item for item in locations if item["id"].startswith("dwr-boat-"))
    assert dwr["accessStatus"] == "verified"
    nhd = next(item for item in locations if item["id"].startswith("nhd-"))
    assert nhd["accessStatus"] == "listed"


def test_previously_unevidenced_species_now_documented(client):
    # Tidal-Potomac / reservoir documentation fills the former zero-evidence species.
    for species_id in ("blue-catfish", "northern-snakehead", "white-perch", "muskellunge", "white-crappie"):
        detail = client.get(f"/api/species/{species_id}").json()
        assert len(detail["locations"]) >= 1, f"{species_id} still has no evidenced locations"


def test_rappahannock_watershed_is_now_covered(client):
    rapp = client.get("/api/locations", params={"watershed": "Rappahannock", "limit": 50}).json()
    assert len(rapp) >= 4
    kellys = next(item for item in rapp if item["id"] == "kellys-ford")
    assert "smallmouth-bass" in kellys["evidenceSpeciesIds"]


def test_location_detail_exposes_all_evidenced_species(client):
    detail = client.get("/api/locations/lake-burke").json()
    assert detail["name"] == "Lake Burke"
    assert detail["waterbodyType"] == "lake"
    species_ids = set(detail["evidenceSpeciesIds"])
    assert {"largemouth-bass", "black-crappie", "yellow-perch"}.issubset(species_ids)
    assert detail["consumptionAdvisory"] is not None
    assert detail["runtimeSource"] == "canonical-api"
    assert detail["opportunities"]


def test_vdh_segment_species_reconcile_with_morgans_ford(client):
    detail = client.get("/api/locations/morgans-ford").json()
    species_ids = set(detail["evidenceSpeciesIds"])
    assert {
        "smallmouth-bass",
        "walleye",
        "common-carp",
        "channel-catfish",
        "white-sucker",
        "rock-bass",
        "largemouth-bass",
    }.issubset(species_ids)

    white_sucker = client.get("/api/species/white-sucker")
    assert white_sucker.status_code == 200
    assert any(location["id"] == "morgans-ford" for location in white_sucker.json()["locations"])


def test_ranked_opportunities_gate_species_evidence(client):
    results = client.get(
        "/api/opportunities/ranked", params={"species_id": "smallmouth-bass", "max_minutes": 240}
    ).json()
    assert len(results) > 0
    assert all(item["availability_score"] >= 0.35 for item in results)
    assert any(item["location"]["id"] == "riverbend-park" for item in results)


def test_location_alias_search(client):
    results = client.get("/api/locations/search", params={"q": "Burke Lake Park"}).json()
    assert results[0]["id"] == "lake-burke"


def test_species_search_alias(client):
    results = client.get("/api/species/search", params={"q": "smallie"}).json()
    assert any(item["id"] == "smallmouth-bass" for item in results)


def test_species_detail_ranks_waters_by_opportunity(client):
    detail = client.get("/api/species/largemouth-bass").json()
    assert detail["id"] == "largemouth-bass"
    assert len(detail["locations"]) > 0
    # Each water carries an opportunity score + confidence; documented waters rank
    # ahead of basin-inferred, then by opportunity.
    for loc in detail["locations"]:
        assert "opportunityScore" in loc and "confidenceLabel" in loc
    keys = [(not loc["modeled"], loc["opportunityScore"]) for loc in detail["locations"]]
    assert keys == sorted(keys, reverse=True)
    # Reference content is present on the facts.
    assert detail["facts"]["family"]
    assert detail["facts"]["nativeStatus"] in {"native", "introduced", "invasive"}


def test_data_source_status_is_derived_from_real_counts_and_runs(client):
    status = client.get("/api/data-sources/status").json()
    counts = status["counts"]
    assert counts["locations"] == 196
    assert counts["species"] == 37
    assert counts["hydrologyAssociations"] == 19
    assert counts["stockingRecords"] == 13
    assert counts["modeledEvidence"] == 135
    assert counts["locationsWithEvidence"] == 163
    assert status["lastSuccessfulIngestion"] is not None
    assert status["lastSuccessfulIngestion"]["status"] == "success"


def test_species_detail_includes_researched_fish_facts(client):
    detail = client.get("/api/species/smallmouth-bass").json()
    facts = detail["facts"]
    assert facts is not None
    assert facts["preferredTempF"][0] and facts["preferredTempF"][1]
    assert facts["citationLengthInches"] == 20  # VA DWR trophy size chart
    assert len(facts["baits"]) >= 4
    assert facts["identification"]
    assert facts["dielPattern"] in {"crepuscular", "diurnal", "nocturnal", "flexible"}


def test_multispecies_entries_carry_fish_facts(client):
    payload = client.get("/api/locations/lake-burke/species", params={"live": "false"}).json()
    assert all(s.get("fishFacts") for s in payload["species"])
    lm = next(s for s in payload["species"] if s["speciesId"] == "largemouth-bass")
    assert lm["fishFacts"]["typicalSizeInches"][1] > lm["fishFacts"]["typicalSizeInches"][0]


def test_multispecies_panel_ranks_and_separates_insufficient(client):
    payload = client.get("/api/locations/lake-burke/species", params={"live": "false"}).json()
    assert payload["location"]["id"] == "lake-burke"
    species = payload["species"]
    assert len(species) >= 3
    scores = [s["opportunity_score"] for s in species]
    assert scores == sorted(scores, reverse=True)
    assert all(s["state"] in {"strong", "fair", "low"} for s in species)
    assert all("factors" in s and "positive" in s["factors"] for s in species)


def test_community_species_are_visible_but_not_bite_scored(client):
    payload = client.get("/api/locations/front-royal/species", params={"live": "false"}).json()
    scored_ids = {item["speciesId"] for item in payload["species"]}
    community_ids = {item["speciesId"] for item in payload["community"]}
    assert "white-sucker" in community_ids
    assert "rock-bass" in community_ids
    assert "white-sucker" not in scored_ids
    assert all("reviewed bite-scoring profile" in item["reason"] for item in payload["community"])


def test_likely_present_is_flagged_modeled_not_a_survey(client):
    # Walney Pond has no direct documentation, so its species are honest
    # "likely present" inference (subwatershed survey records / downstream
    # connectivity / same-waterbody), clearly flagged modeled with the basis in
    # the summary — never presented as a survey of this exact water.
    payload = client.get("/api/locations/walney-pond/species", params={"live": "false"}).json()
    assert len(payload["species"]) >= 1
    markers = ("subwatershed", "downstream", "same water", "likely present")
    for s in payload["species"]:
        assert s["modeled"] is True
        summary = (s["evidence_summary"] or "").lower()
        assert any(m in summary for m in markers)
    # Documented waters are NOT modeled.
    burke = client.get("/api/locations/lake-burke/species", params={"live": "false"}).json()
    assert any(not s["modeled"] for s in burke["species"])
