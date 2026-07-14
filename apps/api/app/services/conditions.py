"""Live-conditions assembly: fetch NWS weather + USGS hydrology (cached), and
normalize hydrology into the compact state the activity model consumes.

Never fabricates: any provider failure returns an unavailable result and the
caller falls back to the researched seasonal estimate with reduced confidence.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from ..core.cache import cache
from ..providers.base import ProviderError
from ..providers.nws import NwsProvider
from ..providers.usgs import UsgsWaterProvider

logger = logging.getLogger("bitemap.conditions")

WEATHER_TTL = 900   # 15 min
HYDRO_TTL = 900


async def get_weather(latitude: float, longitude: float) -> dict:
    key = f"nws:{latitude:.3f},{longitude:.3f}"
    cached = await cache.get_json(key)
    if cached is not None:
        return {**cached, "cached": True}
    try:
        forecast = await NwsProvider().get_hourly_forecast(latitude, longitude)
    except ProviderError as error:
        return {"available": False, "reason": str(error), "periods": [], "alerts": []}
    alerts = await _safe_alerts(latitude, longitude)
    result = {
        "available": True,
        "provider": forecast["provider"],
        "retrieved_at": forecast["retrieved_at"],
        "periods": forecast.get("periods", []),
        "alerts": alerts,
        "cached": False,
    }
    await cache.set_json(key, {k: v for k, v in result.items() if k != "cached"}, WEATHER_TTL)
    return result


async def _safe_alerts(latitude: float, longitude: float) -> list[dict]:
    try:
        payload = await NwsProvider().get_alerts(latitude, longitude)
    except ProviderError:
        return []
    alerts = []
    for feature in payload.get("features", []):
        props = feature.get("properties", {})
        alerts.append(
            {
                "id": feature.get("id"),
                "event": props.get("event"),
                "severity": props.get("severity"),
                "headline": props.get("headline"),
                "expires": props.get("expires"),
            }
        )
    return alerts


def _c_to_f(celsius: float) -> float:
    return celsius * 9 / 5 + 32


def _latest_series(time_series: list[dict], parameter_code: str) -> list[dict]:
    for series in time_series:
        code = series.get("variable", {}).get("variableCode", [{}])[0].get("value")
        if code == parameter_code:
            values = series.get("values", [{}])[0].get("value", [])
            return [v for v in values if v.get("value") not in (None, "", "-999999")]
    return []


def _trend(values: list[dict]) -> tuple[float | None, str, float]:
    """Returns (latest, direction, delta_percent) from a USGS value series."""
    if not values:
        return None, "steady", 0.0
    try:
        latest = float(values[-1]["value"])
    except (ValueError, KeyError):
        return None, "steady", 0.0
    if len(values) < 2:
        return latest, "steady", 0.0
    try:
        earlier = float(values[0]["value"])
    except (ValueError, KeyError):
        return latest, "steady", 0.0
    delta = latest - earlier
    delta_pct = (delta / earlier * 100) if earlier else 0.0
    if abs(delta_pct) < 5:
        direction = "steady"
    else:
        direction = "rising" if delta > 0 else "falling"
    return latest, direction, delta_pct


def normalize_hydrology(observations: dict, association: dict) -> dict:
    """Turn a USGS IV payload into the compact activity/state dict."""
    series = observations.get("time_series", [])
    if not series:
        return {"available": False, "reason": "No time series returned"}

    discharge = _latest_series(series, "00060")
    gage = _latest_series(series, "00065")
    water_temp_c = _latest_series(series, "00010")

    flow_latest, flow_dir, flow_delta_pct = _trend(discharge)
    gage_latest, gage_dir, _ = _trend(gage)
    gage_rise = 0.0
    if gage and len(gage) >= 2:
        try:
            gage_rise = float(gage[-1]["value"]) - float(gage[0]["value"])
        except (ValueError, KeyError):
            gage_rise = 0.0

    water_temp_f = None
    if water_temp_c:
        try:
            water_temp_f = round(_c_to_f(float(water_temp_c[-1]["value"])), 1)
        except (ValueError, KeyError):
            water_temp_f = None

    observed_at = None
    for candidate in (discharge, gage, water_temp_c):
        if candidate:
            observed_at = candidate[-1].get("dateTime")
            break
    freshness, age_hours = _freshness(observed_at)

    rapid_rise = (
        (flow_dir == "rising" and (flow_delta_pct or 0) >= 50)
        or (gage_dir == "rising" and gage_rise >= 0.75)
    )

    return {
        "available": True,
        "waterTempF": water_temp_f,
        "flowTrend": flow_dir,
        "flowDeltaPercent": round(flow_delta_pct, 1) if flow_delta_pct else 0.0,
        "gageRiseFt": round(gage_rise, 2),
        "rapidRise": bool(rapid_rise) and freshness != "old",
        "extremeFlow": False,  # seasonal norms not yet ingested; never fabricated
        "lowFlow": False,
        "discharge": flow_latest,
        "gageHeight": gage_latest,
        "observedAt": observed_at,
        "freshness": freshness,
        "ageHours": age_hours,
        "associationFactor": association.get("association_factor", 0.85),
        "association": association,
        "provisional": True,
    }


def _freshness(observed_at: str | None) -> tuple[str, float | None]:
    if not observed_at:
        return "unavailable", None
    try:
        dt = datetime.fromisoformat(observed_at)
    except ValueError:
        return "unavailable", None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    age = (datetime.now(timezone.utc) - dt).total_seconds() / 3600
    if age <= 6:
        return "fresh", round(age, 1)
    if age <= 24:
        return "stale", round(age, 1)
    return "old", round(age, 1)


async def get_hydrology_state(association: dict) -> dict:
    station_id = association["station_id"]
    key = f"usgs:{station_id}"
    cached = await cache.get_json(key)
    if cached is not None:
        return {**cached, "cached": True}
    try:
        observations = await UsgsWaterProvider().get_latest_observations(station_id)
    except ProviderError as error:
        return {"available": False, "reason": str(error)}
    state = normalize_hydrology(observations, association)
    await cache.set_json(key, state, HYDRO_TTL)
    return {**state, "cached": False}
