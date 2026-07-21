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
from ..providers.open_meteo import OpenMeteoAirProvider
from ..providers.usgs import UsgsWaterProvider
from ..scoring.water_temperature import (
    FLOWING_WATER_TYPES,
    build_water_temperature_state,
)

logger = logging.getLogger("bitemap.conditions")

WEATHER_TTL = 900   # 15 min
HYDRO_TTL = 900
AIR_HISTORY_TTL = 21600  # 6 hours; thermal state changes slowly


def _normalized_weather_period(period: dict) -> dict:
    """Preserve the NWS payload while exposing the numeric field the scorer uses."""
    raw_probability = period.get("probabilityOfPrecipitation")
    precipitation_probability = (
        raw_probability.get("value")
        if isinstance(raw_probability, dict)
        else raw_probability
    )
    return {
        **period,
        "precipitationProbability": precipitation_probability,
    }


async def get_weather(latitude: float, longitude: float) -> dict:
    key = f"nws:{latitude:.3f},{longitude:.3f}"
    cached = await cache.get_json(key)
    if cached is not None:
        return {
            **cached,
            "periods": [
                _normalized_weather_period(period)
                for period in cached.get("periods", [])[:120]
            ],
            "cached": True,
        }
    try:
        forecast = await NwsProvider().get_hourly_forecast(latitude, longitude)
    except ProviderError as error:
        return {"available": False, "reason": str(error), "periods": [], "alerts": []}
    alerts = await _safe_alerts(latitude, longitude)
    result = {
        "available": True,
        "provider": forecast["provider"],
        "retrieved_at": forecast["retrieved_at"],
        "forecast_updated_at": forecast.get("forecast_updated_at"),
        "periods": [
            _normalized_weather_period(period)
            for period in forecast.get("periods", [])[:120]
        ],
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


def _parsed_value(item: dict) -> float | None:
    try:
        return float(item["value"])
    except (TypeError, ValueError, KeyError):
        return None


def _parsed_time(item: dict) -> datetime | None:
    try:
        dt = datetime.fromisoformat(item["dateTime"])
    except (TypeError, ValueError, KeyError):
        return None
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def _trend(values: list[dict], window_hours: int = 6) -> tuple[float | None, str, float, float, float]:
    """Return latest, direction, delta %, absolute delta, and actual window hours."""
    if not values:
        return None, "steady", 0.0, 0.0, 0.0
    valid = [
        (dt, value)
        for item in values
        if (dt := _parsed_time(item)) is not None
        and (value := _parsed_value(item)) is not None
    ]
    valid.sort(key=lambda item: item[0])
    if not valid:
        return None, "steady", 0.0, 0.0, 0.0
    latest_time, latest = valid[-1]
    if len(valid) < 2:
        return latest, "steady", 0.0, 0.0, 0.0
    target = latest_time.timestamp() - window_hours * 3600
    candidates = [item for item in valid[:-1] if item[0].timestamp() <= target]
    earlier_time, earlier = candidates[-1] if candidates else valid[0]
    delta = latest - earlier
    delta_pct = (delta / abs(earlier) * 100) if earlier else 0.0
    elapsed = max(0.0, (latest_time - earlier_time).total_seconds() / 3600)
    if abs(delta_pct) < 5:
        direction = "steady"
    else:
        direction = "rising" if delta > 0 else "falling"
    return latest, direction, delta_pct, delta, elapsed


def _latest_number(values: list[dict]) -> float | None:
    for item in reversed(values):
        value = _parsed_value(item)
        if value is not None:
            return value
    return None


def _newest_observed_at(*series: list[dict]) -> str | None:
    latest: tuple[datetime, str] | None = None
    for values in series:
        for item in values:
            dt = _parsed_time(item)
            raw = item.get("dateTime")
            if dt is not None and raw and (latest is None or dt > latest[0]):
                latest = (dt, raw)
    return latest[1] if latest else None


def normalize_hydrology(observations: dict, association: dict) -> dict:
    """Turn a USGS IV payload into the compact activity/state dict."""
    series = observations.get("time_series", [])
    if not series:
        return {"available": False, "reason": "No time series returned"}

    discharge = _latest_series(series, "00060")
    gage = _latest_series(series, "00065")
    water_temp_c = _latest_series(series, "00010")
    dissolved_oxygen = _latest_series(series, "00300")
    turbidity = _latest_series(series, "63680")
    specific_conductance = _latest_series(series, "00095")

    flow_latest, flow_dir, flow_delta_pct, flow_delta, flow_window = _trend(discharge)
    gage_latest, gage_dir, _, gage_rise, gage_window = _trend(gage)

    water_temp_f = None
    water_temp_value_c = _latest_number(water_temp_c)
    if water_temp_value_c is not None:
        water_temp_f = round(_c_to_f(water_temp_value_c), 1)

    dissolved_oxygen_mg_l = _latest_number(dissolved_oxygen)
    turbidity_fnu = _latest_number(turbidity)
    specific_conductance_us_cm = _latest_number(specific_conductance)

    observed_at = _newest_observed_at(
        discharge,
        gage,
        water_temp_c,
        dissolved_oxygen,
        turbidity,
        specific_conductance,
    )
    water_temp_observed_at = _newest_observed_at(water_temp_c)
    flow_observed_at = _newest_observed_at(discharge, gage)
    freshness, age_hours = _freshness(observed_at)
    flow_freshness, flow_age_hours = _freshness(flow_observed_at)

    rapid_rise = (
        (flow_dir == "rising" and (flow_delta_pct or 0) >= 50)
        or (gage_dir == "rising" and gage_rise >= 0.75)
    )

    return {
        "available": True,
        "waterTempF": water_temp_f,
        "waterTempObservedAt": water_temp_observed_at,
        "dissolvedOxygenMgL": (
            round(dissolved_oxygen_mg_l, 2)
            if dissolved_oxygen_mg_l is not None
            else None
        ),
        "turbidityFnu": round(turbidity_fnu, 2) if turbidity_fnu is not None else None,
        "specificConductanceUsCm": (
            round(specific_conductance_us_cm, 1)
            if specific_conductance_us_cm is not None
            else None
        ),
        "flowTrend": flow_dir,
        "flowDeltaPercent": round(flow_delta_pct, 1) if flow_delta_pct else 0.0,
        "flowDelta": round(flow_delta, 1),
        "flowWindowHours": round(flow_window, 1),
        "gageRiseFt": round(gage_rise, 2),
        "gageWindowHours": round(gage_window, 1),
        "flowObservedAt": flow_observed_at,
        "flowFreshness": flow_freshness,
        "flowAgeHours": flow_age_hours,
        "rapidRise": bool(rapid_rise) and flow_freshness != "old",
        "extremeFlow": False,  # needs seasonal percentiles; never inferred from a short window
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


async def get_water_temperature_state(
    latitude: float,
    longitude: float,
    waterbody_type: str,
    hydrology: dict | None = None,
) -> dict:
    """Observed USGS temperature wins; flowing waters may use a regional estimate."""
    observed_temp_f = hydrology.get("waterTempF") if hydrology else None
    observed_at = hydrology.get("waterTempObservedAt") if hydrology else None
    association_factor = hydrology.get("associationFactor", 1.0) if hydrology else 1.0
    source_freshness, source_age_hours = _freshness(observed_at)
    if source_freshness in {"old", "unavailable"}:
        observed_temp_f = None
        observed_at = None
    elif source_freshness == "stale":
        association_factor *= 0.85

    # Standing waters deliberately do not inherit the stream model.
    if waterbody_type not in FLOWING_WATER_TYPES:
        state = build_water_temperature_state(
            [],
            waterbody_type,
            observed_temp_f=observed_temp_f,
            observed_at=observed_at,
            association_factor=association_factor,
        )
        state["sourceFreshness"] = source_freshness
        state["sourceAgeHours"] = source_age_hours
        return state

    key = f"air-history:{latitude:.3f},{longitude:.3f}"
    daily_air = await cache.get_json(key)
    if daily_air is None:
        try:
            payload = await OpenMeteoAirProvider().get_daily_air_temperatures(
                latitude, longitude
            )
            daily_air = payload.get("days", [])
            await cache.set_json(key, daily_air, AIR_HISTORY_TTL)
        except ProviderError as error:
            logger.info("Air-temperature history unavailable: %s", error)
            daily_air = []

    state = build_water_temperature_state(
        daily_air,
        waterbody_type,
        observed_temp_f=observed_temp_f,
        observed_at=observed_at,
        association_factor=association_factor,
    )
    state["sourceFreshness"] = source_freshness
    state["sourceAgeHours"] = source_age_hours
    return state
