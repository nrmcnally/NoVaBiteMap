from __future__ import annotations

import pytest


def _fake_periods():
    return [
        {
            "startTime": f"{day}T{hour:02d}:00:00-04:00",
            "temperature": 70,
            "temperatureUnit": "F",
            "shortForecast": "Partly Cloudy",
            "windSpeed": "6 mph",
            "precipitationProbability": 10,
        }
        for day in ("2026-05-10", "2026-05-11")
        for hour in range(24)
    ]


@pytest.fixture()
def mocked_conditions(client, monkeypatch):
    from app.services import conditions as conditions_service

    async def fake_weather(lat, lng):
        return {
            "available": True,
            "provider": "test",
            "retrieved_at": "2026-05-10T09:00:00Z",
            "periods": _fake_periods(),
            "alerts": [],
        }

    monkeypatch.setattr(conditions_service, "get_weather", fake_weather)
    return client


def test_timeline_score_matrix_is_bounded_and_precomputed(mocked_conditions):
    response = mocked_conditions.post(
        "/api/opportunities/timeline",
        json={
            "anchor_latitude": 38.8462,
            "anchor_longitude": -77.3064,
            "anchor_label": "Fairfax test anchor",
            "location_ids": ["front-royal", "lake-burke"],
            "species_ids": ["smallmouth-bass", "largemouth-bass"],
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["contractVersion"] == "timeline-score-matrix-v0.1.0"
    assert body["engine"] == "canonical-api"
    assert body["anchor"]["label"] == "Fairfax test anchor"
    assert len(body["periods"]) == 48
    assert body["dayKeys"] == ["2026-05-10", "2026-05-11"]

    smallmouth = body["locations"]["front-royal"]["smallmouth-bass"]
    assert len(smallmouth["hourlyScores"]) == len(body["periods"])
    assert len(smallmouth["dailyScores"]) == len(body["dayKeys"])
    assert len(smallmouth["dailyBestPeriodIndexes"]) == len(body["dayKeys"])
    assert all(isinstance(score, int) for score in smallmouth["hourlyScores"])
    assert "channel-catfish" not in body["locations"]["front-royal"]


def test_weather_period_normalization_preserves_raw_nws_probability():
    from app.services.conditions import _normalized_weather_period

    raw = {
        "startTime": "2026-05-10T08:00:00-04:00",
        "probabilityOfPrecipitation": {"unitCode": "wmoUnit:percent", "value": 45},
    }
    normalized = _normalized_weather_period(raw)
    assert normalized["precipitationProbability"] == 45
    assert normalized["probabilityOfPrecipitation"] == raw["probabilityOfPrecipitation"]
