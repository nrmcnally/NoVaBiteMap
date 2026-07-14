from __future__ import annotations

import pathlib
import sys
import unittest

API_ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))

from app.ingestion.public_data import line_midpoint, sample_date  # noqa: E402


class PublicDataImporterTests(unittest.TestCase):
    def test_line_midpoint_uses_distance_not_vertex_count(self):
        longitude, latitude = line_midpoint([[0, 0], [1, 0], [4, 0]])
        self.assertEqual((longitude, latitude), (2, 0))

    def test_partial_sample_date_is_stable(self):
        self.assertEqual(sample_date({"sample_year": "2014", "sample_month": "", "sample_day": ""}), "2014-01-01")


if __name__ == "__main__":
    unittest.main()
