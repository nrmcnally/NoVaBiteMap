"""Forecast-window and environmental-snapshot contracts.

These contracts are species-agnostic. They describe which environmental inputs
exist at a selected time; the deterministic species scorer consumes the
snapshot later. No catch outcome or user-report field belongs here.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from ..scoring.activity import max_wind_mph
from ..scoring.solar import daylight_context

CAPABILITY_VERSION = "forecast-capabilities-v0.1.0"
SNAPSHOT_VERSION = "environmental-snapshot-v0.1.0"
LOCAL_TIMEZONE = ZoneInfo("America/New_York")


def build_forecast_capabilities(
    *,
    location: dict,
    weather: dict,
    hydrology: dict | None,
    water_temperature: dict,
    association: dict | None,
) -> dict:
    generated_at = datetime.now(timezone.utc).isoformat()
    periods = _periods_with_time(weather.get("periods") or [])
    dates = sorted({_local_date(item[0]) for item in periods})
    weather_inputs = _weather_input_coverage([item[1] for item in periods])
    water_status = water_temperature.get("status", "unavailable")
    water_daily = water_temperature.get("daily") or {}
    water_dates = sorted(water_daily)
    modeled_inputs = (
        ["waterTemperature"]
        if water_status in {"estimated-calibrated", "estimated-regional"}
        else []
    )
    unavailable_inputs = [
        name for name, available in weather_inputs.items() if not available
    ]
    if water_status == "unavailable":
        unavailable_inputs.append("waterTemperature")
    if not association:
        unavailable_inputs.append("hydrology")
    elif not hydrology or not hydrology.get("available"):
        unavailable_inputs.append("mappedHydrology")

    hourly_available = bool(periods)
    daily_available = bool(dates)
    return {
        "contractVersion": CAPABILITY_VERSION,
        "generatedAt": generated_at,
        "timezone": "America/New_York",
        "location": location,
        "hourly": {
            "status": "available" if hourly_available else "unavailable",
            "resolution": "hourly",
            "startTime": periods[0][0].isoformat() if periods else None,
            "endTime": periods[-1][0].isoformat() if periods else None,
            "periodCount": len(periods),
            "provider": weather.get("provider"),
            "retrievedAt": weather.get("retrieved_at"),
            "forecastUpdatedAt": weather.get("forecast_updated_at"),
            "inputs": [name for name, available in weather_inputs.items() if available]
            + ["solarPosition"],
            "modeledInputs": modeled_inputs,
            "unavailableInputs": unavailable_inputs,
            "limitation": (
                "Hourly selection ends at the final timestamp returned by the weather provider."
                if hourly_available
                else weather.get("reason", "No hourly weather periods are available.")
            ),
        },
        "daily": {
            "status": "available" if daily_available else "unavailable",
            "resolution": "daily-outlook",
            "startDate": dates[0] if dates else None,
            "endDate": dates[-1] if dates else None,
            "dayCount": len(dates),
            "derivedFrom": "NWS hourly periods",
            "waterTemperatureEndDate": water_dates[-1] if water_dates else None,
            "excludedHourlyOnlyInputs": ["intrahourWeatherChange"],
            "label": "Daily outlook",
            "limitation": (
                "Daily outlooks summarize supported hourly periods and do not imply an exact hour."
                if daily_available
                else "No supported daily outlook dates are available."
            ),
        },
        "hydrology": _hydrology_capability(hydrology, association),
        "waterTemperature": {
            "status": water_status,
            "confidence": water_temperature.get("confidence", 0),
            "modelVersion": water_temperature.get("modelVersion"),
            "availableThrough": water_dates[-1] if water_dates else None,
            "provenance": _temperature_provenance(water_status),
            "limitation": water_temperature.get("reason"),
        },
        "alerts": {
            "status": "available" if weather.get("available") else "unavailable",
            "activeCount": len(weather.get("alerts") or []),
            "provider": weather.get("provider"),
        },
        "selectionPolicy": {
            "unsupportedFutureDisabled": True,
            "hourlyEndTime": periods[-1][0].isoformat() if periods else None,
            "dailyEndDate": dates[-1] if dates else None,
            "dailyOutlookLabel": "Daily outlook",
            "selectedTimestampRequiredForScoring": True,
        },
    }


def build_environmental_snapshot(
    *,
    selected_at: datetime,
    location: dict,
    weather: dict,
    hydrology: dict | None,
    water_temperature: dict,
    association: dict | None,
) -> dict:
    if selected_at.tzinfo is None:
        raise ValueError("Selected time must include a time-zone offset.")
    selected_at = selected_at.astimezone(timezone.utc)
    periods = _periods_with_time(weather.get("periods") or [])
    period = _period_for_time(periods, selected_at)
    if period is None:
        raise ValueError("Selected time is outside the supported hourly forecast window.")
    valid_time, weather_period = period
    local_date = _local_date(selected_at)
    temperature = _temperature_for_date(water_temperature, local_date)
    temperature_status = temperature.get("status", "unavailable")
    precipitation = weather_period.get("probabilityOfPrecipitation")
    if isinstance(precipitation, dict):
        precipitation = precipitation.get("value")
    solar = daylight_context(selected_at, location["latitude"], location["longitude"])

    inputs = {
        "airTemperature": _input(
            value=weather_period.get("temperature"),
            unit=weather_period.get("temperatureUnit"),
            provenance="forecast",
            provider=weather.get("provider"),
            valid_time=valid_time,
            retrieved_at=weather.get("retrieved_at"),
        ),
        "precipitationProbability": _input(
            value=precipitation,
            unit="percent",
            provenance="forecast",
            provider=weather.get("provider"),
            valid_time=valid_time,
            retrieved_at=weather.get("retrieved_at"),
        ),
        "wind": _input(
            value=max_wind_mph(weather_period.get("windSpeed")),
            unit="mph",
            provenance="forecast",
            provider=weather.get("provider"),
            valid_time=valid_time,
            retrieved_at=weather.get("retrieved_at"),
            context={
                "raw": weather_period.get("windSpeed"),
                "direction": weather_period.get("windDirection"),
            },
        ),
        "weatherSummary": _input(
            value=weather_period.get("shortForecast"),
            unit=None,
            provenance="forecast",
            provider=weather.get("provider"),
            valid_time=valid_time,
            retrieved_at=weather.get("retrieved_at"),
        ),
        "waterTemperature": _input(
            value=temperature.get("valueF"),
            unit="deg F",
            provenance=_temperature_provenance(temperature_status),
            provider=temperature.get("source"),
            valid_time=valid_time,
            retrieved_at=temperature.get("observedAt"),
            context={
                "status": temperature_status,
                "rangeF": temperature.get("rangeF"),
                "confidence": temperature.get("confidence", 0),
                "modelVersion": temperature.get("modelVersion"),
                "reason": temperature.get("reason"),
            },
        ),
        "solarPosition": _input(
            value=solar["elevation"],
            unit="degrees",
            provenance="deterministic",
            provider="BiteMap solar geometry",
            valid_time=selected_at,
            retrieved_at=None,
            context={"phase": solar["phase"]},
        ),
        "hydrology": _hydrology_snapshot(hydrology, association),
    }
    missing = [name for name, value in inputs.items() if value["status"] == "unavailable"]
    modeled = [
        name for name, value in inputs.items()
        if value["provenance"] in {"modeled-from-forecast", "estimated-current"}
    ]
    return {
        "contractVersion": SNAPSHOT_VERSION,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "selectedTime": selected_at.isoformat(),
        "timezone": "America/New_York",
        "location": location,
        "weatherValidTime": valid_time.isoformat(),
        "inputs": inputs,
        "coverage": {
            "status": "complete" if not missing else "partial",
            "missingInputs": missing,
            "modeledInputs": modeled,
        },
        "activeAlerts": weather.get("alerts") or [],
        "scoring": {
            "speciesAgnostic": True,
            "scoreIncluded": False,
            "selectedTimestampExplicit": True,
        },
    }


def _periods_with_time(periods: list[dict]) -> list[tuple[datetime, dict]]:
    parsed: list[tuple[datetime, dict]] = []
    for period in periods:
        try:
            at = datetime.fromisoformat(period["startTime"])
        except (KeyError, TypeError, ValueError):
            continue
        if at.tzinfo is None:
            continue
        parsed.append((at.astimezone(timezone.utc), period))
    return sorted(parsed, key=lambda item: item[0])


def _period_for_time(
    periods: list[tuple[datetime, dict]],
    selected_at: datetime,
) -> tuple[datetime, dict] | None:
    if not periods:
        return None
    for index, current in enumerate(periods):
        start = current[0]
        end = periods[index + 1][0] if index + 1 < len(periods) else start + timedelta(hours=1)
        if start <= selected_at < end:
            return current
    return None


def _weather_input_coverage(periods: list[dict]) -> dict[str, bool]:
    return {
        "airTemperature": any(period.get("temperature") is not None for period in periods),
        "precipitationProbability": any(
            _precipitation_value(period) is not None for period in periods
        ),
        "wind": any(bool(period.get("windSpeed")) for period in periods),
        "weatherSummary": any(bool(period.get("shortForecast")) for period in periods),
    }


def _precipitation_value(period: dict):
    value = period.get("probabilityOfPrecipitation")
    return value.get("value") if isinstance(value, dict) else value


def _hydrology_capability(hydrology: dict | None, association: dict | None) -> dict:
    if association is None:
        return {
            "status": "not-mapped",
            "station": None,
            "forecasted": False,
            "limitation": "No manually verified station relationship is mapped; no gage is guessed.",
        }
    if not hydrology or not hydrology.get("available"):
        return {
            "status": "unavailable",
            "station": association,
            "forecasted": False,
            "limitation": (hydrology or {}).get("reason", "Mapped USGS values are unavailable."),
        }
    return {
        "status": "observed-current-context",
        "station": association,
        "observedAt": hydrology.get("observedAt"),
        "freshness": hydrology.get("freshness"),
        "forecasted": False,
        "limitation": (
            "Current provisional gage values are context only; BiteMap does not project them "
            "across the forecast window or use them to declare water safe."
        ),
    }


def _hydrology_snapshot(
    hydrology: dict | None,
    association: dict | None,
) -> dict:
    capability = _hydrology_capability(hydrology, association)
    if capability["status"] != "observed-current-context":
        return {
            "status": "unavailable",
            "value": None,
            "unit": None,
            "provenance": "unavailable",
            "provider": "USGS" if association else None,
            "validTime": None,
            "retrievedAt": None,
            "context": capability,
        }
    return {
        "status": "available",
        "value": {
            "discharge": hydrology.get("discharge"),
            "gageHeight": hydrology.get("gageHeight"),
            "flowTrend": hydrology.get("flowTrend"),
            "rapidRise": hydrology.get("rapidRise", False),
            "dissolvedOxygenMgL": hydrology.get("dissolvedOxygenMgL"),
            "turbidityFnu": hydrology.get("turbidityFnu"),
        },
        "unit": None,
        "provenance": "observed-current-context",
        "provider": "USGS",
        "validTime": hydrology.get("observedAt"),
        "retrievedAt": hydrology.get("observedAt"),
        "context": capability,
    }


def _temperature_for_date(state: dict, date_key: str) -> dict:
    daily = state.get("daily") or {}
    if date_key in daily:
        return daily[date_key]
    current_date = datetime.now(LOCAL_TIMEZONE).date().isoformat()
    if date_key == current_date:
        return {key: value for key, value in state.items() if key != "daily"}
    return {
        "status": "unavailable",
        "valueF": None,
        "rangeF": None,
        "confidence": 0,
        "source": None,
        "modelVersion": None,
        "reason": "No water-temperature estimate covers the selected date.",
    }


def _temperature_provenance(status: str) -> str:
    if status == "observed":
        return "observed"
    if status in {"estimated-calibrated", "estimated-regional"}:
        return "modeled-from-forecast"
    return "unavailable"


def _input(
    *,
    value,
    unit: str | None,
    provenance: str,
    provider: str | None,
    valid_time: datetime,
    retrieved_at: str | None,
    context: dict | None = None,
) -> dict:
    available = value is not None and provenance != "unavailable"
    return {
        "status": "available" if available else "unavailable",
        "value": value if available else None,
        "unit": unit,
        "provenance": provenance if available else "unavailable",
        "provider": provider,
        "validTime": valid_time.isoformat(),
        "retrievedAt": retrieved_at,
        "context": context or {},
    }


def _local_date(value: datetime) -> str:
    return value.astimezone(LOCAL_TIMEZONE).date().isoformat()
