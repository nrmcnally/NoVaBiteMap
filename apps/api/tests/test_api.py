from __future__ import annotations

import pathlib
import sys
import unittest

API_ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))

try:
    from fastapi.testclient import TestClient
    from app.main import app
except ImportError:  # Allows pure scoring tests before optional API dependencies are installed.
    TestClient = None
    app = None


@unittest.skipIf(TestClient is None, "FastAPI test dependencies are not installed")
class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client_context = TestClient(app)
        cls.client = cls.client_context.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client_context.__exit__(None, None, None)

    def test_health_and_openapi(self):
        self.assertEqual(self.client.get("/health").status_code, 200)
        self.assertEqual(self.client.get("/openapi.json").status_code, 200)

    def test_rankings_gate_species_evidence(self):
        response = self.client.get("/api/opportunities/ranked", params={"species_id": "smallmouth-bass", "max_minutes": 60})
        self.assertEqual(response.status_code, 200)
        results = response.json()
        self.assertGreater(len(results), 0)
        self.assertTrue(all(item["availability_score"] >= 0.35 for item in results))
        self.assertTrue(all(item["location"]["species_evidence"].get("smallmouth-bass") for item in results))
        self.assertTrue(any(item["location"]["id"] == "riverbend-park" for item in results))

    def test_coverage_pass_has_fifty_provenance_backed_locations(self):
        response = self.client.get("/api/locations", params={"limit": 200})
        self.assertEqual(response.status_code, 200)
        locations = response.json()
        self.assertEqual(len(locations), 50)
        self.assertTrue(all(item.get("source") and item.get("source_name") for item in locations))
        self.assertTrue(all(item.get("consumption_advisory", {}).get("source_url") for item in locations))
        ids = {item["id"] for item in locations}
        self.assertTrue({"lake-fairfax", "gravelly-point", "beaverdam-reservoir"}.issubset(ids))
        fountainhead = next(item for item in locations if item["id"] == "fountainhead")
        self.assertEqual(fountainhead["consumption_advisory"]["status"], "active")
        fountainhead_rules = fountainhead["consumption_advisory"]["matching_restrictions"]
        self.assertTrue(any(rule["species_ids"] == ["largemouth-bass"] and rule["severity"] == "do-not-eat" for rule in fountainhead_rules))
        self.assertTrue(any(rule["species_ids"] == ["bluegill"] and rule["severity"] == "two-meals-per-month" for rule in fountainhead_rules))

    def test_advisory_segments_do_not_overgeneralize_whole_rivers(self):
        locations = self.client.get("/api/locations", params={"limit": 200}).json()
        by_id = {item["id"]: item for item in locations}

        bentonville = by_id["bentonville"]["consumption_advisory"]
        self.assertEqual([segment["id"] for segment in bentonville["segments"]], ["shenandoah-mercury"])

        morgans = by_id["morgans-ford"]["consumption_advisory"]
        self.assertEqual([segment["id"] for segment in morgans["segments"]], ["shenandoah-pcb-lower-reaches"])

        self.assertEqual(by_id["catletts-ford"]["consumption_advisory"]["status"], "no-advisory-found")
        self.assertEqual(by_id["occoquan-hand-carry"]["consumption_advisory"]["status"], "jurisdiction-check")
        self.assertEqual(by_id["berrys"]["waterbody"], "Shenandoah River")

        pohick_rules = by_id["pohick-bay"]["consumption_advisory"]["matching_restrictions"]
        channel_rules = [rule for rule in pohick_rules if rule["species_ids"] == ["channel-catfish"]]
        self.assertEqual({rule["size_qualifier"] for rule in channel_rules}, {"18 inches or longer", "shorter than 18 inches"})

    def test_location_alias_search(self):
        response = self.client.get("/api/locations/search", params={"q": "Burke Lake Park"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()[0]["id"], "lake-burke")


if __name__ == "__main__":
    unittest.main()
