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
        return {
            "available": True,
            "waterTempF": 62.0,
            "flowTrend": "steady",
            "rapidRise": False,
            "associationFactor": assoc.get("association_factor", 0.85),
        }

    async def fake_temperature(lat, lng, waterbody_type, hydrology=None):
        return {
            "status": "observed",
            "valueF": 62.0,
            "rangeF": None,
            "uncertaintyF": None,
            "confidence": 0.85,
            "source": "test gage",
            "observedAt": "2026-05-10T09:00:00Z",
            "modelVersion": None,
            "method": "test observation",
            "daily": {},
        }

    monkeypatch.setattr(conditions_service, "get_weather", fake_weather)
    monkeypatch.setattr(conditions_service, "get_hydrology_state", fake_hydro)
    monkeypatch.setattr(
        conditions_service,
        "get_water_temperature_state",
        fake_temperature,
    )
    return client


def test_species_forecast_endpoint_returns_hourly_and_days(mocked_conditions):
    resp = mocked_conditions.get("/api/locations/front-royal/forecast", params={"species_id": "smallmouth-bass"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["speciesId"] == "smallmouth-bass"
    assert body["waterTempStatus"] == "observed"  # measured water temp was supplied
    assert body["waterTemperature"]["valueF"] == 62.0
    assert len(body["forecast"]["hourly"]) > 0
    assert len(body["forecast"]["days"]) >= 2
    assert body["scores"]["availability_score"] >= 0.35


def test_multispecies_live_uses_measured_water_temp(mocked_conditions):
    payload = mocked_conditions.get("/api/locations/front-royal/species", params={"live": "true"}).json()
    assert payload["liveConditions"] is True
    assert len(payload["species"]) >= 1
    assert all(s.get("activityLive") for s in payload["species"])


def test_forecast_capabilities_publish_real_provider_boundaries(mocked_conditions):
    response = mocked_conditions.get("/api/locations/front-royal/forecast-capabilities")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["contractVersion"] == "forecast-capabilities-v0.1.0"
    assert body["hourly"]["status"] == "available"
    assert body["hourly"]["periodCount"] == 48
    assert body["hourly"]["startTime"].startswith("2026-05-10T04:00:00")
    assert body["hourly"]["endTime"].startswith("2026-05-12T03:00:00")
    assert body["daily"]["resolution"] == "daily-outlook"
    assert body["daily"]["dayCount"] == 2
    assert body["daily"]["startDate"] == "2026-05-10"
    assert body["daily"]["endDate"] == "2026-05-11"
    assert body["selectionPolicy"]["unsupportedFutureDisabled"] is True
    assert body["selectionPolicy"]["selectedTimestampRequiredForScoring"] is True
    assert body["hydrology"]["forecasted"] is False


def test_environmental_snapshot_is_species_agnostic_and_timestamp_explicit(mocked_conditions):
    response = mocked_conditions.get(
        "/api/locations/front-royal/environmental-snapshot",
        params={"at": "2026-05-10T12:30:00-04:00"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["contractVersion"] == "environmental-snapshot-v0.1.0"
    assert body["selectedTime"] == "2026-05-10T16:30:00+00:00"
    assert body["weatherValidTime"] == "2026-05-10T16:00:00+00:00"
    assert body["inputs"]["airTemperature"]["value"] == 70
    assert body["inputs"]["airTemperature"]["provenance"] == "forecast"
    assert body["inputs"]["solarPosition"]["provenance"] == "deterministic"
    assert body["inputs"]["hydrology"]["provenance"] == "observed-current-context"
    assert body["inputs"]["waterTemperature"]["status"] == "unavailable"
    assert body["coverage"]["status"] == "partial"
    assert body["scoring"]["speciesAgnostic"] is True
    assert body["scoring"]["scoreIncluded"] is False
    assert "speciesId" not in body
    assert "score" not in body


def test_environmental_snapshot_rejects_unsupported_time(mocked_conditions):
    response = mocked_conditions.get(
        "/api/locations/front-royal/environmental-snapshot",
        params={"at": "2026-05-20T12:00:00-04:00"},
    )
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert "outside the supported hourly forecast window" in detail["message"]
    assert detail["capabilities"]["selectionPolicy"]["unsupportedFutureDisabled"] is True
