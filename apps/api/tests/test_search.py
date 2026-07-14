from __future__ import annotations

import pathlib
import sys

API_ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))

from app.api.routes import match_score  # noqa: E402


def test_exact_alias_scores_first():
    assert match_score("Burke Lake Park", "Lake Burke", "Lake Burke", "Fairfax", "", "Burke Lake", "Burke Lake Park") == 1.0


def test_unrelated_fuzzy_match_is_rejected():
    assert match_score("Rappahannock Kellys Ford", "Lake Burke", "Lake Burke", "Fairfax") == 0.0


def test_waterbody_name_matches_access_point():
    assert match_score("Shenandoah", "Morgan's Ford", "Main Stem Shenandoah River", "Warren") > 0


def test_prefix_beats_fuzzy():
    prefix = match_score("occo", "Occoquan Regional Park", "Occoquan River", "Fairfax")
    assert prefix >= 0.9
