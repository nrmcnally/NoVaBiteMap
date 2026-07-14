from __future__ import annotations

import pathlib
import sys
import unittest

API_ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))

from app.scoring.engine import (  # noqa: E402
    availability_score,
    confidence_score,
    final_opportunity_score,
    hourly_activity_score,
    quality_score,
)


class AvailabilityTests(unittest.TestCase):
    def test_no_evidence_returns_zero(self):
        self.assertEqual(availability_score([]), 0)

    def test_modeled_only_evidence_is_capped(self):
        score = availability_score([
            {"direction": 1, "authority": 1, "directness": 1, "method_quality": 1, "geographic_precision": 1, "recency": 1, "modeled": True},
            {"direction": 1, "authority": 1, "directness": 1, "method_quality": 1, "geographic_precision": 1, "recency": 1, "modeled": True},
        ])
        self.assertLessEqual(score, 0.25)

    def test_direct_absence_reduces_presence(self):
        presence = {"direction": 1, "authority": 1, "directness": 1, "method_quality": 1, "geographic_precision": 1, "recency": 1}
        absence = {**presence, "direction": -1}
        self.assertLess(availability_score([presence, absence]), availability_score([presence]))

    def test_incompatible_waterbody_caps_score(self):
        evidence = [{"direction": 1, "authority": 1, "directness": 1, "method_quality": 1, "geographic_precision": 1, "recency": 1}]
        self.assertLessEqual(availability_score(evidence, incompatible_waterbody=True), 0.05)


class ComponentTests(unittest.TestCase):
    def test_quality_is_weighted_and_missing_is_none(self):
        self.assertIsNone(quality_score([]))
        score = quality_score([
            {"value": 0.8, "method_reliability": 1, "recency": 1, "sample_coverage": 1},
            {"value": 0.2, "method_reliability": 0.5, "recency": 1, "sample_coverage": 1},
        ])
        self.assertAlmostEqual(score, 0.6, places=2)

    def test_activity_requires_45_percent_coverage(self):
        self.assertIsNone(hourly_activity_score([{"suitability": 1, "weight": 0.44, "available": True}]))
        self.assertEqual(hourly_activity_score([{"suitability": 0.7, "weight": 0.45, "available": True}]), 0.7)

    def test_weather_cannot_override_weak_presence(self):
        low_presence = final_opportunity_score(0.2, 1.0, 1.0, 1.0)
        strong_presence = final_opportunity_score(0.9, 0.5, 0.5, 0.5)
        self.assertLess(low_presence, strong_presence)

    def test_safety_cap_is_applied_last(self):
        self.assertEqual(final_opportunity_score(1, 1, 1, 1, safety_cap=35), 35)

    def test_confidence_is_separate_and_horizon_sensitive(self):
        today = confidence_score(1, 1, 1, 1, 1)
        day_five = confidence_score(1, 1, 1, 1, 1, horizon_factor=0.72)
        self.assertEqual(today, 100)
        self.assertEqual(day_five, 72)


if __name__ == "__main__":
    unittest.main()

