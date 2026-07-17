from __future__ import annotations

import asyncio
import pathlib
import sys
from datetime import datetime, timedelta, timezone

API_ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))

from app.services.conditions import (  # noqa: E402
    get_water_temperature_state,
    normalize_hydrology,
)


def _series(code: str, values: list[tuple[str, float]]) -> dict:
    return {
        "variable": {"variableCode": [{"value": code}]},
        "values": [
            {
                "value": [
                    {"dateTime": observed_at, "value": str(value)}
                    for observed_at, value in values
                ]
            }
        ],
    }


def test_hydrology_normalizes_water_quality_and_six_hour_flow_change():
    latest = datetime.now(timezone.utc).replace(microsecond=0)
    earlier = latest - timedelta(hours=6)
    latest_text = latest.isoformat()
    earlier_text = earlier.isoformat()
    observations = {
        "time_series": [
            _series(
                "00060",
                [
                    (earlier_text, 100),
                    (latest_text, 160),
                ],
            ),
            _series(
                "00065",
                [
                    (earlier_text, 2.0),
                    (latest_text, 2.8),
                ],
            ),
            _series("00010", [(latest_text, 20)]),
            _series("00300", [(latest_text, 7.4)]),
            _series("63680", [(latest_text, 12.3)]),
            _series("00095", [(latest_text, 455)]),
        ]
    }
    state = normalize_hydrology(
        observations,
        {"station_id": "01600000", "association_factor": 0.85},
    )
    assert state["waterTempF"] == 68.0
    assert state["waterTempObservedAt"] == latest_text
    assert state["dissolvedOxygenMgL"] == 7.4
    assert state["turbidityFnu"] == 12.3
    assert state["specificConductanceUsCm"] == 455.0
    assert state["flowDeltaPercent"] == 60.0
    assert state["flowWindowHours"] == 6.0
    assert state["rapidRise"] is True
    assert state["extremeFlow"] is False
    assert state["observedAt"] == latest_text


def test_short_window_does_not_invent_seasonal_high_or_low_flow():
    observations = {
        "time_series": [
            _series(
                "00060",
                [
                    ("2026-05-10T06:00:00-04:00", 100),
                    ("2026-05-10T12:00:00-04:00", 102),
                ],
            )
        ]
    }
    state = normalize_hydrology(
        observations,
        {"station_id": "01600000", "association_factor": 1.0},
    )
    assert state["flowTrend"] == "steady"
    assert state["extremeFlow"] is False
    assert state["lowFlow"] is False


def test_stale_flow_does_not_trigger_rapid_rise_when_other_metrics_are_fresh():
    now = datetime.now(timezone.utc).replace(microsecond=0)
    old = now - timedelta(days=3)
    observations = {
        "time_series": [
            _series(
                "00060",
                [
                    ((old - timedelta(hours=6)).isoformat(), 100),
                    (old.isoformat(), 170),
                ],
            ),
            _series("00300", [(now.isoformat(), 8.0)]),
        ]
    }

    state = normalize_hydrology(
        observations,
        {"station_id": "01600000", "association_factor": 1.0},
    )

    assert state["freshness"] == "fresh"
    assert state["flowFreshness"] == "old"
    assert state["flowDeltaPercent"] == 70.0
    assert state["rapidRise"] is False


def test_stale_standing_water_temperature_is_not_presented_as_current():
    old = datetime.now(timezone.utc) - timedelta(days=3)
    state = asyncio.run(
        get_water_temperature_state(
            latitude=38.9,
            longitude=-77.3,
            waterbody_type="lake",
            hydrology={
                "waterTempF": 72.0,
                "waterTempObservedAt": old.isoformat(),
            },
        )
    )

    assert state["status"] == "unavailable"
    assert state["valueF"] is None
    assert state["sourceFreshness"] == "old"
