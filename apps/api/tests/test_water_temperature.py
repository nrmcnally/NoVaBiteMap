from __future__ import annotations

import pathlib
import sys

API_ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))

from app.scoring.water_temperature import (  # noqa: E402
    build_water_temperature_state,
    equilibrium_water_temperature_c,
    modeled_daily_temperatures,
    temperature_reading_for_date,
)


def _air_days(start_day: int = 1, count: int = 30, temperature_c: float = 20.0):
    return [
        {"date": f"2026-05-{day:02d}", "temperatureC": temperature_c}
        for day in range(start_day, start_day + count)
    ]


def test_equilibrium_curve_warms_monotonically_and_stays_physical():
    cold = equilibrium_water_temperature_c(2)
    mild = equilibrium_water_temperature_c(12)
    warm = equilibrium_water_temperature_c(25)
    assert 0 <= cold < mild < warm <= 35


def test_thermal_memory_dampens_a_one_day_air_temperature_jump():
    days = _air_days(count=20, temperature_c=10)
    days[-1]["temperatureC"] = 32
    modeled = modeled_daily_temperatures(days, "stream")
    previous = modeled["2026-05-19"]
    jumped = modeled["2026-05-20"]
    assert jumped > previous
    assert jumped < 82  # water does not instantly become the 89.6 F air temperature


def test_regional_stream_estimate_is_labeled_and_broadly_bounded():
    state = build_water_temperature_state(
        _air_days(),
        "stream",
        as_of_date="2026-05-25",
    )
    assert state["status"] == "estimated-regional"
    assert state["modelVersion"]
    assert state["rangeF"][0] < state["valueF"] < state["rangeF"][1]
    assert state["confidence"] < 0.7
    assert temperature_reading_for_date(state, "2026-05-28")["status"] == "estimated-regional"


def test_observation_wins_today_and_future_days_are_bias_corrected_estimates():
    state = build_water_temperature_state(
        _air_days(),
        "stream",
        observed_temp_f=61.0,
        observed_at="2026-05-25T12:00:00-04:00",
        association_factor=0.9,
        as_of_date="2026-05-25",
    )
    assert state["status"] == "observed"
    assert state["valueF"] == 61.0
    assert state["daily"]["2026-05-25"]["status"] == "observed"
    assert state["daily"]["2026-05-26"]["status"] == "estimated-calibrated"


def test_standing_water_is_not_given_the_stream_model():
    state = build_water_temperature_state(
        _air_days(),
        "lake",
        as_of_date="2026-05-25",
    )
    assert state["status"] == "unavailable"
    assert "lake model" in state["reason"].lower()


def test_standing_water_can_still_use_a_real_observation():
    state = build_water_temperature_state(
        [],
        "reservoir",
        observed_temp_f=73.2,
        observed_at="2026-05-25T12:00:00-04:00",
        association_factor=0.85,
        as_of_date="2026-05-25",
    )
    assert state["status"] == "observed"
    assert state["valueF"] == 73.2
