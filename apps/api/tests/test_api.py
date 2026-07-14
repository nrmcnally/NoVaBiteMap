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


def test_species_detail_lists_locations_with_evidence(client):
    detail = client.get("/api/species/largemouth-bass").json()
    assert detail["id"] == "largemouth-bass"
    assert len(detail["locations"]) > 0
    assert detail["locations"] == sorted(detail["locations"], key=lambda i: i["availability"], reverse=True)


def test_data_source_status_is_derived_from_real_counts_and_runs(client):
    status = client.get("/api/data-sources/status").json()
    counts = status["counts"]
    assert counts["locations"] == 196
    assert counts["species"] == 20
    assert counts["hydrologyAssociations"] == 19
    assert counts["stockingRecords"] == 13
    assert counts["modeledEvidence"] == 38
    assert counts["locationsWithEvidence"] == 78
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


def test_access_only_location_offers_no_species(client):
    # Huntsman Lake is a small Fairfax park lake with no agency species documentation.
    payload = client.get("/api/locations/huntsman-lake/species", params={"live": "false"}).json()
    assert payload["species"] == []
    assert payload["insufficient"] == []
