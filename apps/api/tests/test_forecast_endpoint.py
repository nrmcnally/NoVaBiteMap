from __future__ import annotations

import pathlib
import sys

import pytest

API_ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))


def _fake_periods():
    periods = []
    for day in ("2026-05-10", "2026-05-11"):
        for hour in range(0, 24):
            periods.append(
                {
                    "startTime": f"{day}T{hour:02d}:00:00-04:00",
                    "temperature": 70,
                    "temperatureUnit": "F",
                    "shortForecast": "Partly Cloudy",
                    "windSpeed": "6 mph",
                    "precipitationProbability": 10,
                }
            )
    return periods


@pytest.fixture()
def mocked_conditions(client, monkeypatch):
    from app.services import conditions as conditions_service

    async def fake_weather(lat, lng):
        return {"available": True, "provider": "test", "retrieved_at": "2026-05-10T09:00:00Z", "periods": _fake_periods(), "alerts": []}

    async def fake_hydro(assoc):
        return {"available": True, "waterTempF": 62.0, "flowTrend": "steady", "rapidRise": False, "associationFactor": assoc.get("association_factor", 0.85)}

    monkeypatch.setattr(conditions_service, "get_weather", fake_weather)
    monkeypatch.setattr(conditions_service, "get_hydrology_state", fake_hydro)
    return client


def test_species_forecast_endpoint_returns_hourly_and_days(mocked_conditions):
    resp = mocked_conditions.get("/api/locations/front-royal/forecast", params={"species_id": "smallmouth-bass"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["speciesId"] == "smallmouth-bass"
    assert body["waterTempStatus"] == "observed"  # measured water temp was supplied
    assert len(body["forecast"]["hourly"]) > 0
    assert len(body["forecast"]["days"]) >= 2
    assert body["scores"]["availability_score"] >= 0.35


def test_multispecies_live_uses_measured_water_temp(mocked_conditions):
    payload = mocked_conditions.get("/api/locations/front-royal/species", params={"live": "true"}).json()
    assert payload["liveConditions"] is True
    assert len(payload["species"]) >= 1
    assert all(s.get("activityLive") for s in payload["species"])
