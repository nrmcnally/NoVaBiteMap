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

    def test_location_alias_search(self):
        response = self.client.get("/api/locations/search", params={"q": "Burke Lake Park"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()[0]["id"], "lake-burke")


if __name__ == "__main__":
    unittest.main()
