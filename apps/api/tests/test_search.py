from __future__ import annotations

import pathlib
import sys
import unittest

API_ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))

from app.api.routes import location_match  # noqa: E402
from app.data.seed import LOCATIONS  # noqa: E402


class SearchTests(unittest.TestCase):
    def test_exact_alias_scores_first(self):
        burke = next(item for item in LOCATIONS if item["id"] == "lake-burke")
        self.assertEqual(location_match(burke, "Burke Lake Park"), 1.0)

    def test_unrelated_fuzzy_match_is_rejected(self):
        burke = next(item for item in LOCATIONS if item["id"] == "lake-burke")
        self.assertEqual(location_match(burke, "Rappahannock Kellys Ford"), 0.0)

    def test_waterbody_name_matches_access_point(self):
        morgans = next(item for item in LOCATIONS if item["id"] == "morgans-ford")
        self.assertGreater(location_match(morgans, "Shenandoah"), 0)


if __name__ == "__main__":
    unittest.main()

