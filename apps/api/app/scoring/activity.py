"""Species-specific hourly activity model.

Replaces the single generic time/wind/precip heuristic with a per-species score
driven by the researched profile (temperature bands, seasonal curve, diel pattern,
waterbody fit) and live conditions (NWS weather, real sunrise/sunset, USGS water
quality/flow, and a clearly labeled water-temperature state).

Honesty rules enforced here:
- Air temperature is never passed directly to the fish scorer as water temperature.
- Estimated water temperature carries less scoring authority than an observation.
- Seasonal and thermal suitability are blended, not multiplied, so temperature-of-
  season is not counted twice.
- Turbidity is exposed as context but is not given a universal bonus or penalty.
- Flow affects the generic score only for documented dangerous/rapid changes; normal
  flow effects require species-specific or seasonal-percentile support.
- Weights below are documented tuning knobs, separate from the cited profile facts.
"""
from __future__ import annotations

import re
from datetime import datetime

from .engine import clamp, final_opportunity_score
from .solar import daylight_context, sun_times
from .water_temperature import (
    temperature_reading_for_date,
    unavailable_temperature_state,
)

# --- tuning knobs (documented, adjustable; NOT researched facts) ------------
DIEL_WEIGHTS: dict[str, dict[str, float]] = {
    "crepuscular": {"twilight": 1.18, "day": 1.00, "bright": 0.86, "night": 0.82},
    "diurnal": {"twilight": 1.05, "day": 1.10, "bright": 0.98, "night": 0.60},
    "nocturnal": {"twilight": 1.12, "day": 0.80, "bright": 0.65, "night": 1.20},
    "flexible": {"twilight": 1.10, "day": 1.00, "bright": 0.92, "night": 0.95},
}
WATERBODY_PREF_GAIN = 0.12
TEMP_FLOOR = 0.15
SEASON_WEIGHT_WITH_TEMPERATURE = 0.45
TEMPERATURE_WEIGHT = 0.55


def max_wind_mph(value: str | None) -> float:
    if not value:
        return 0.0
    numbers = [float(n) for n in re.findall(r"\d+(?:\.\d+)?", value)]
    return max(numbers) if numbers else 0.0


def wind_multiplier(mph: float) -> float:
    # Wind effects on catchability are species- and waterbody-specific. Keep the
    # generic biological term neutral until winds become a presentation/safety cost.
    if mph <= 15:
        return 1.00
    if mph <= 24:
        return 0.93
    return 0.80


def weather_multiplier(precip_prob: float | None, short_forecast: str | None) -> float:
    text = (short_forecast or "").lower()
    if re.search(r"thunderstorm|heavy rain|tornado|severe", text):
        return 0.65
    probability = precip_prob or 0
    if probability <= 60:
        return 1.00
    if probability <= 80:
        return 0.94
    return 0.88


def diel_multiplier(profile: dict, phase: str) -> float:
    weights = DIEL_WEIGHTS.get(profile.get("dielPattern", "flexible"), DIEL_WEIGHTS["flexible"])
    return weights.get(phase, 1.0)


def waterbody_multiplier(profile: dict, waterbody_type: str) -> float:
    pref = float(profile.get("waterbodyPreference", {}).get(waterbody_type, 0.0))
    return 1.0 + WATERBODY_PREF_GAIN * pref


def reproductive_phase(profile: dict, month: int, water_temp_f: float | None) -> str:
    """Expose reproductive context without assuming spawning always improves feeding."""
    spawn_months = {
        int(value)
        for value in (profile.get("spawnMonths") or [])
        if isinstance(value, (int, float)) and 1 <= int(value) <= 12
    }
    if not spawn_months:
        return "not-profiled"
    if month in spawn_months:
        spawn_temp = profile.get("spawnTempF")
        if water_temp_f is None or spawn_temp is None:
            return "spawn-window-calendar"
        delta = water_temp_f - float(spawn_temp)
        if abs(delta) <= 5:
            return "spawn-window-temperature-aligned"
        return (
            "spawn-window-warmer-than-trigger"
            if delta > 0
            else "spawn-window-colder-than-trigger"
        )
    next_month = 1 if month == 12 else month + 1
    if next_month in spawn_months:
        return "pre-spawn-calendar"
    previous_month = 12 if month == 1 else month - 1
    if previous_month in spawn_months:
        return "post-spawn-calendar"
    return "outside-spawn-window"


def water_temp_multiplier(
    profile: dict,
    water_temp_f: float | None,
    *,
    status: str = "observed",
    confidence: float = 1.0,
) -> tuple[float, str]:
    """Return effective thermal suitability, attenuated by estimate confidence."""
    if water_temp_f is None:
        return 1.0, "unavailable"
    tmin = float(profile["toleranceMinF"])
    tmax = float(profile["toleranceMaxF"])
    if profile.get("temperatureResponse") == "stress-only":
        # Some species have defensible cold/heat stress evidence but no portable
        # feeding optimum. Keep the broad middle neutral instead of turning an
        # aquaculture growth band into a bite multiplier.
        cold_recovery_f = float(profile.get("coldStressRecoveryF", 50))
        heat_stress_f = float(profile.get("heatStressStartF", 88))
        if water_temp_f < tmin or water_temp_f > tmax:
            suit = TEMP_FLOOR
        elif water_temp_f < cold_recovery_f:
            suit = 0.6 + 0.4 * (water_temp_f - tmin) / max(1e-6, cold_recovery_f - tmin)
        elif water_temp_f <= heat_stress_f:
            suit = 1.0
        else:
            suit = 1.0 - 0.45 * (water_temp_f - heat_stress_f) / max(1e-6, tmax - heat_stress_f)
    else:
        pmin = float(profile["preferredMinF"])
        pmax = float(profile["preferredMaxF"])
        if pmin <= water_temp_f <= pmax:
            suit = 1.0
        elif tmin <= water_temp_f < pmin:
            suit = 0.4 + 0.6 * (water_temp_f - tmin) / max(1e-6, pmin - tmin)
        elif pmax < water_temp_f <= tmax:
            suit = 0.4 + 0.6 * (tmax - water_temp_f) / max(1e-6, tmax - pmax)
        else:
            suit = TEMP_FLOOR
    reliability = clamp(confidence)
    effective = 1 - reliability * (1 - suit)
    return round(effective, 3), status


def oxygen_multiplier(
    profile: dict,
    dissolved_oxygen_mg_l: float | None,
    water_temp_f: float | None,
    association_factor: float,
) -> tuple[float, str]:
    """Conservative oxygen-stress term; adequate oxygen receives no bonus."""
    if dissolved_oxygen_mg_l is None:
        return 1.0, "dissolved oxygen unavailable"

    coldwater = float(profile.get("preferredMaxF", 75)) <= 68
    if coldwater:
        if dissolved_oxygen_mg_l >= 7:
            raw = 1.0
        elif dissolved_oxygen_mg_l >= 6:
            raw = 0.94
        elif dissolved_oxygen_mg_l >= 5:
            raw = 0.82
        elif dissolved_oxygen_mg_l >= 4:
            raw = 0.66
        else:
            raw = 0.48
    else:
        if dissolved_oxygen_mg_l >= 6:
            raw = 1.0
        elif dissolved_oxygen_mg_l >= 5:
            raw = 0.96
        elif dissolved_oxygen_mg_l >= 4:
            raw = 0.86
        elif dissolved_oxygen_mg_l >= 3:
            raw = 0.70
        else:
            raw = 0.52

    # Warm water plus low oxygen is more stressful than either in isolation.
    if (
        water_temp_f is not None
        and water_temp_f > float(profile.get("preferredMaxF", water_temp_f))
        and dissolved_oxygen_mg_l < (6 if coldwater else 5)
    ):
        raw *= 0.9

    representativeness = clamp(association_factor)
    effective = 1 - representativeness * (1 - raw)
    return round(effective, 3), f"{dissolved_oxygen_mg_l:.1f} mg/L at representative gage"


def hydrology_multiplier(waterbody_type: str, hydrology: dict | None) -> tuple[float, str]:
    """Flow modulates activity for flowing water. Returns (multiplier, note)."""
    if waterbody_type not in ("river", "stream") or not hydrology or not hydrology.get("available"):
        return 1.0, "flow not applied"
    if hydrology.get("rapidRise"):
        return 0.70, "rapid rise suppresses activity and raises safety risk"
    if hydrology.get("extremeFlow"):
        return 0.72, "flow well above seasonal norms"
    if hydrology.get("lowFlow"):
        return 0.92, "low flow can concentrate but slow fish"
    return 1.0, "flow trend shown as context; no universal biological adjustment"


def _local(period: dict) -> datetime:
    return datetime.fromisoformat(period["startTime"])


def hourly_activity(
    profile: dict,
    *,
    dt_local: datetime,
    latitude: float,
    longitude: float,
    waterbody_type: str,
    water_temp_f: float | None,
    wind_mph: float,
    precip_prob: float | None,
    short_forecast: str | None,
    hydrology: dict | None,
    water_temp_status: str = "observed",
    water_temp_confidence: float = 1.0,
) -> dict:
    month = dt_local.month
    seasonal = float(profile.get("seasonalActivityByMonth", [0.5] * 12)[month - 1])
    ctx = daylight_context(dt_local, latitude, longitude)
    diel = diel_multiplier(profile, ctx["phase"])
    wind = wind_multiplier(wind_mph)
    weather = weather_multiplier(precip_prob, short_forecast)
    body = waterbody_multiplier(profile, waterbody_type)
    temp_mult, temp_status = water_temp_multiplier(
        profile,
        water_temp_f,
        status=water_temp_status,
        confidence=water_temp_confidence,
    )
    hydro_mult, hydro_note = hydrology_multiplier(waterbody_type, hydrology)
    oxygen_mult, oxygen_note = oxygen_multiplier(
        profile,
        hydrology.get("dissolvedOxygenMgL") if hydrology else None,
        water_temp_f,
        hydrology.get("associationFactor", 1.0) if hydrology else 1.0,
    )
    reproductive = reproductive_phase(profile, month, water_temp_f)

    if water_temp_f is None:
        seasonal_thermal = seasonal
    else:
        seasonal_thermal = (
            SEASON_WEIGHT_WITH_TEMPERATURE * seasonal
            + TEMPERATURE_WEIGHT * temp_mult
        )
    suitability = clamp(
        seasonal_thermal
        * diel
        * wind
        * weather
        * body
        * hydro_mult
        * oxygen_mult
    )
    return {
        "suitability": round(suitability, 3),
        "phase": ctx["phase"],
        "solarElevation": ctx["elevation"],
        "seasonalBase": round(seasonal, 3),
        "waterTempStatus": temp_status,
        "reproductivePhase": reproductive,
        "factors": {
            "seasonal": round(seasonal, 3),
            "seasonalThermal": round(seasonal_thermal, 3),
            "diel": round(diel, 3),
            "wind": round(wind, 3),
            "weather": round(weather, 3),
            "waterbody": round(body, 3),
            "waterTemperature": round(temp_mult, 3),
            "hydrology": round(hydro_mult, 3),
            "dissolvedOxygen": round(oxygen_mult, 3),
            "turbidityFnu": hydrology.get("turbidityFnu") if hydrology else None,
            "reproductivePhase": reproductive,
        },
        "hydrologyNote": hydro_note,
        "oxygenNote": oxygen_note,
    }


def _is_safety_alert(alert: dict) -> bool:
    text = f"{alert.get('event', '')} {alert.get('headline', '')}"
    return bool(re.search(r"flash flood|flood warning|severe thunderstorm warning|tornado|hurricane|tropical storm warning", text, re.I))


def build_species_forecast(
    profile: dict,
    periods: list[dict],
    *,
    waterbody_type: str,
    latitude: float,
    longitude: float,
    availability: float,
    quality: float | None,
    access_fit: float,
    base_confidence: int,
    hydrology: dict | None = None,
    alerts: list[dict] | None = None,
    water_temp_f: float | None = None,
    water_temperature: dict | None = None,
    wading_selected: bool = False,
    association_factor: float = 1.0,
) -> dict:
    alerts = alerts or []
    active_alerts = [a for a in alerts if _is_safety_alert(a)]
    rapid_rise = bool(hydrology and hydrology.get("rapidRise"))
    safety_cap = 35 if (active_alerts or (wading_selected and rapid_rise)) else None
    if water_temperature is None:
        if water_temp_f is not None:
            water_temperature = {
                "status": "observed",
                "valueF": water_temp_f,
                "rangeF": None,
                "uncertaintyF": None,
                "confidence": 1.0,
                "source": "supplied observation",
                "observedAt": None,
                "modelVersion": None,
                "method": "instrument observation",
                "daily": {},
            }
        else:
            water_temperature = unavailable_temperature_state(
                "No observed or modeled water temperature was supplied."
            )

    hourly = []
    for period in periods:
        dt_local = _local(period)
        date_key = dt_local.strftime("%Y-%m-%d")
        temp_reading = temperature_reading_for_date(water_temperature, date_key)
        activity = hourly_activity(
            profile,
            dt_local=dt_local,
            latitude=latitude,
            longitude=longitude,
            waterbody_type=waterbody_type,
            water_temp_f=temp_reading.get("valueF"),
            wind_mph=max_wind_mph(period.get("windSpeed")),
            precip_prob=period.get("precipitationProbability"),
            short_forecast=period.get("shortForecast"),
            hydrology=hydrology,
            water_temp_status=temp_reading.get("status", "unavailable"),
            water_temp_confidence=float(temp_reading.get("confidence") or 0.0),
        )
        score = final_opportunity_score(availability, quality, activity["suitability"], access_fit, safety_cap)
        hourly.append(
            {
                "startTime": period["startTime"],
                "hour": dt_local.hour,
                "dateKey": date_key,
                "temperature": period.get("temperature"),
                "temperatureUnit": period.get("temperatureUnit"),
                "shortForecast": period.get("shortForecast"),
                "windMph": max_wind_mph(period.get("windSpeed")),
                "precipitationProbability": period.get("precipitationProbability"),
                "activity": activity["suitability"],
                "phase": activity["phase"],
                "reproductivePhase": activity["reproductivePhase"],
                "score": score,
                "factors": activity["factors"],
                "waterTemperatureF": temp_reading.get("valueF"),
                "waterTemperatureStatus": temp_reading.get("status"),
                "waterTemperatureRangeF": temp_reading.get("rangeF"),
            }
        )

    days = _daily_rollup(
        hourly,
        periods,
        latitude,
        longitude,
        base_confidence,
        hydrology,
        association_factor,
        water_temperature,
    )
    return {
        "hourly": hourly,
        "days": days,
        "safetyCap": safety_cap,
        "activeSafetyAlerts": active_alerts,
        "rapidRise": rapid_rise,
        "waterTempStatus": water_temperature.get("status", "unavailable"),
        "waterTemperature": water_temperature,
        "explanation": _explanation(
            profile, hydrology, safety_cap, water_temperature
        ),
    }


def _daily_rollup(
    hourly,
    periods,
    latitude,
    longitude,
    base_confidence,
    hydrology,
    association_factor,
    water_temperature,
):
    by_day: dict[str, list[dict]] = {}
    for row in hourly:
        by_day.setdefault(row["dateKey"], []).append(row)

    horizon = [1.0, 0.92, 0.84, 0.78, 0.72]
    tz_offset = _tz_offset_hours(periods)
    days = []
    for index, (date_key, rows) in enumerate(list(by_day.items())[:5]):
        best = max(rows, key=lambda r: r["score"])
        average = round(sum(r["score"] for r in rows) / len(rows))
        year, month, day = (int(part) for part in date_key.split("-"))
        sunrise, sunset = sun_times(year, month, day, latitude, longitude, tz_offset)
        hydro_factor = 1.0
        if hydrology is not None:
            hydro_factor = association_factor if hydrology.get("available") else 0.55
        temp_reading = temperature_reading_for_date(water_temperature, date_key)
        temp_status = temp_reading.get("status", "unavailable")
        temperature_factor = {
            "observed": 1.0,
            "estimated-calibrated": 0.9,
            "estimated-regional": 0.8,
            "unavailable": 0.82,
        }.get(temp_status, 0.82)
        confidence = round(
            base_confidence * horizon[index] * hydro_factor * temperature_factor
        )
        days.append(
            {
                "dateKey": date_key,
                "score": best["score"],
                "average": average,
                "bestHour": best["hour"],
                "bestScore": best["score"],
                "forecast": best.get("shortForecast"),
                "temperature": best.get("temperature"),
                "temperatureUnit": best.get("temperatureUnit"),
                "waterTemperatureF": best.get("waterTemperatureF"),
                "waterTemperatureStatus": best.get("waterTemperatureStatus"),
                "waterTemperatureRangeF": best.get("waterTemperatureRangeF"),
                "reproductivePhase": best.get("reproductivePhase"),
                "sunrise": sunrise.isoformat() if sunrise else None,
                "sunset": sunset.isoformat() if sunset else None,
                "confidence": confidence,
                "confidenceLabel": "High" if confidence >= 75 else "Moderate" if confidence >= 50 else "Low",
            }
        )
    return days


def _tz_offset_hours(periods: list[dict]) -> float:
    if not periods:
        return -5.0
    dt = _local(periods[0])
    if dt.utcoffset() is None:
        return -5.0
    return dt.utcoffset().total_seconds() / 3600


def _explanation(
    profile: dict,
    hydrology: dict | None,
    safety_cap: int | None,
    water_temperature: dict,
) -> list[str]:
    lines = [
        "Species availability and fishery quality remain evidence-gated; weather cannot override weak presence evidence.",
        f"Hourly activity uses this species' researched seasonal prior, {profile.get('dielPattern', 'flexible')} activity pattern, and real sunrise/sunset.",
    ]
    status = water_temperature.get("status", "unavailable")
    value_f = water_temperature.get("valueF")
    range_f = water_temperature.get("rangeF")
    if status == "observed" and value_f is not None:
        lines.append(
            f"A representative USGS water-temperature observation of {value_f:.0f} F is applied against the species' preferred band."
        )
    elif status in {"estimated-calibrated", "estimated-regional"} and value_f is not None:
        range_text = (
            f" (model range {range_f[0]:.0f}-{range_f[1]:.0f} F)"
            if range_f
            else ""
        )
        lines.append(
            f"A labeled daily surface-water estimate of {value_f:.0f} F{range_text} is blended with, not multiplied by, the seasonal prior."
        )
    else:
        lines.append(
            "No measured or modeled water temperature is applied; the seasonal profile remains the fallback."
        )
    if hydrology and hydrology.get("available"):
        if hydrology.get("dissolvedOxygenMgL") is not None:
            lines.append(
                f"Representative-gage dissolved oxygen ({hydrology['dissolvedOxygenMgL']:.1f} mg/L) is included as a stress constraint."
            )
        if hydrology.get("turbidityFnu") is not None:
            lines.append(
                "Turbidity is shown as context but receives no universal bite bonus or penalty."
            )
        lines.append(
            "USGS flow changes affect the generic activity score only when a rapid rise or supported extreme is present."
        )
    else:
        lines.append("No live flow reading is applied, so confidence is reduced where flow matters.")
    if safety_cap is not None:
        lines.append("An official weather warning or rapid gage rise applied a safety cap.")
    return lines
