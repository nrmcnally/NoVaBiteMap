"""Species-specific hourly activity model.

Replaces the single generic time/wind/precip heuristic with a per-species score
driven by the researched profile (temperature bands, seasonal curve, diel pattern,
waterbody fit) and live conditions (NWS weather, real sunrise/sunset, USGS flow).

Honesty rules enforced here:
- Air temperature is never treated as water temperature. The temperature term only
  bites when a *measured* water temperature is supplied; otherwise the researched
  seasonal curve carries the temperature-of-season signal and the term is neutral.
- Flow (USGS) now modulates biological activity for flowing water, not just safety.
- Weights below are documented tuning knobs, separate from the cited profile facts.
"""
from __future__ import annotations

import re
from datetime import datetime

from .engine import clamp, final_opportunity_score
from .solar import daylight_context, sun_times

# --- tuning knobs (documented, adjustable; NOT researched facts) ------------
DIEL_WEIGHTS: dict[str, dict[str, float]] = {
    "crepuscular": {"twilight": 1.18, "day": 1.00, "bright": 0.86, "night": 0.82},
    "diurnal": {"twilight": 1.05, "day": 1.10, "bright": 0.98, "night": 0.60},
    "nocturnal": {"twilight": 1.12, "day": 0.80, "bright": 0.65, "night": 1.20},
    "flexible": {"twilight": 1.10, "day": 1.00, "bright": 0.92, "night": 0.95},
}
WATERBODY_PREF_GAIN = 0.12
TEMP_FLOOR = 0.30  # measured out-of-tolerance water temperature floor multiplier


def max_wind_mph(value: str | None) -> float:
    if not value:
        return 0.0
    numbers = [float(n) for n in re.findall(r"\d+(?:\.\d+)?", value)]
    return max(numbers) if numbers else 0.0


def wind_multiplier(mph: float) -> float:
    if mph <= 8:
        return 1.03
    if mph <= 15:
        return 1.00
    if mph <= 24:
        return 0.85
    return 0.68


def weather_multiplier(precip_prob: float | None, short_forecast: str | None) -> float:
    text = (short_forecast or "").lower()
    if re.search(r"thunderstorm|heavy rain|tornado|severe", text):
        return 0.55
    probability = precip_prob or 0
    overcast_bonus = 1.04 if re.search(r"cloud|overcast|fog", text) else 1.0
    if probability <= 20:
        base = 1.00
    elif probability <= 50:
        base = 1.02
    elif probability <= 75:
        base = 0.90
    else:
        base = 0.78
    return round(base * overcast_bonus, 3)


def diel_multiplier(profile: dict, phase: str) -> float:
    weights = DIEL_WEIGHTS.get(profile.get("dielPattern", "flexible"), DIEL_WEIGHTS["flexible"])
    return weights.get(phase, 1.0)


def waterbody_multiplier(profile: dict, waterbody_type: str) -> float:
    pref = float(profile.get("waterbodyPreference", {}).get(waterbody_type, 0.0))
    return 1.0 + WATERBODY_PREF_GAIN * pref


def water_temp_multiplier(profile: dict, water_temp_f: float | None) -> tuple[float, str]:
    """Returns (multiplier, status). Only measured water temperature bites."""
    if water_temp_f is None:
        return 1.0, "unavailable"
    pmin = float(profile["preferredMinF"])
    pmax = float(profile["preferredMaxF"])
    tmin = float(profile["toleranceMinF"])
    tmax = float(profile["toleranceMaxF"])
    if pmin <= water_temp_f <= pmax:
        suit = 1.0
    elif tmin <= water_temp_f < pmin:
        suit = 0.4 + 0.6 * (water_temp_f - tmin) / max(1e-6, pmin - tmin)
    elif pmax < water_temp_f <= tmax:
        suit = 0.4 + 0.6 * (tmax - water_temp_f) / max(1e-6, tmax - pmax)
    else:
        suit = 0.15
    return round(TEMP_FLOOR + (1 - TEMP_FLOOR) * suit, 3), "observed"


def hydrology_multiplier(waterbody_type: str, hydrology: dict | None) -> tuple[float, str]:
    """Flow modulates activity for flowing water. Returns (multiplier, note)."""
    if waterbody_type not in ("river", "stream") or not hydrology or not hydrology.get("available"):
        return 1.0, "flow not applied"
    if hydrology.get("rapidRise"):
        return 0.70, "rapid rise suppresses activity and raises safety risk"
    if hydrology.get("extremeFlow"):
        return 0.72, "flow well above seasonal norms"
    trend = hydrology.get("flowTrend", "steady")
    if trend == "steady":
        return 1.05, "stable flow favors feeding"
    if hydrology.get("lowFlow"):
        return 0.92, "low flow can concentrate but slow fish"
    return 1.0, "flow within normal range"


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
) -> dict:
    month = dt_local.month
    seasonal = float(profile.get("seasonalActivityByMonth", [0.5] * 12)[month - 1])
    ctx = daylight_context(dt_local, latitude, longitude)
    diel = diel_multiplier(profile, ctx["phase"])
    wind = wind_multiplier(wind_mph)
    weather = weather_multiplier(precip_prob, short_forecast)
    body = waterbody_multiplier(profile, waterbody_type)
    temp_mult, temp_status = water_temp_multiplier(profile, water_temp_f)
    hydro_mult, hydro_note = hydrology_multiplier(waterbody_type, hydrology)

    suitability = clamp(seasonal * diel * wind * weather * body * temp_mult * hydro_mult)
    return {
        "suitability": round(suitability, 3),
        "phase": ctx["phase"],
        "solarElevation": ctx["elevation"],
        "seasonalBase": round(seasonal, 3),
        "waterTempStatus": temp_status,
        "factors": {
            "seasonal": round(seasonal, 3),
            "diel": round(diel, 3),
            "wind": round(wind, 3),
            "weather": round(weather, 3),
            "waterbody": round(body, 3),
            "waterTemperature": round(temp_mult, 3),
            "hydrology": round(hydro_mult, 3),
        },
        "hydrologyNote": hydro_note,
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
    wading_selected: bool = False,
    association_factor: float = 1.0,
) -> dict:
    alerts = alerts or []
    active_alerts = [a for a in alerts if _is_safety_alert(a)]
    rapid_rise = bool(hydrology and hydrology.get("rapidRise"))
    safety_cap = 35 if (active_alerts or (wading_selected and rapid_rise)) else None

    hourly = []
    for period in periods:
        dt_local = _local(period)
        activity = hourly_activity(
            profile,
            dt_local=dt_local,
            latitude=latitude,
            longitude=longitude,
            waterbody_type=waterbody_type,
            water_temp_f=water_temp_f,
            wind_mph=max_wind_mph(period.get("windSpeed")),
            precip_prob=period.get("precipitationProbability"),
            short_forecast=period.get("shortForecast"),
            hydrology=hydrology,
        )
        score = final_opportunity_score(availability, quality, activity["suitability"], access_fit, safety_cap)
        hourly.append(
            {
                "startTime": period["startTime"],
                "hour": dt_local.hour,
                "dateKey": dt_local.strftime("%Y-%m-%d"),
                "temperature": period.get("temperature"),
                "temperatureUnit": period.get("temperatureUnit"),
                "shortForecast": period.get("shortForecast"),
                "windMph": max_wind_mph(period.get("windSpeed")),
                "activity": activity["suitability"],
                "phase": activity["phase"],
                "score": score,
                "factors": activity["factors"],
            }
        )

    days = _daily_rollup(hourly, periods, latitude, longitude, base_confidence, hydrology, association_factor)
    return {
        "hourly": hourly,
        "days": days,
        "safetyCap": safety_cap,
        "activeSafetyAlerts": active_alerts,
        "rapidRise": rapid_rise,
        "waterTempStatus": "observed" if water_temp_f is not None else "estimated",
        "explanation": _explanation(profile, hydrology, safety_cap, water_temp_f),
    }


def _daily_rollup(hourly, periods, latitude, longitude, base_confidence, hydrology, association_factor):
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
        confidence = round(base_confidence * horizon[index] * hydro_factor)
        days.append(
            {
                "dateKey": date_key,
                "score": best["score"],
                "average": average,
                "bestHour": best["hour"],
                "bestScore": best["score"],
                "forecast": best.get("shortForecast"),
                "temperature": best.get("temperature"),
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


def _explanation(profile: dict, hydrology: dict | None, safety_cap: int | None, water_temp_f: float | None) -> list[str]:
    lines = [
        "Species availability and fishery quality remain evidence-gated; weather cannot override weak presence evidence.",
        f"Hourly activity uses this species' researched seasonal curve, {profile.get('dielPattern', 'flexible')} feeding pattern, and real sunrise/sunset.",
    ]
    if water_temp_f is not None:
        lines.append(f"A measured water temperature of {water_temp_f:.0f} F is applied against the species' preferred band.")
    else:
        lines.append("Water temperature is estimated from the seasonal curve, not from air temperature.")
    if hydrology and hydrology.get("available"):
        lines.append("USGS flow is factored into activity for this flowing-water location.")
    else:
        lines.append("No live flow reading is applied, so confidence is reduced where flow matters.")
    if safety_cap is not None:
        lines.append("An official weather warning or rapid gage rise applied a safety cap.")
    return lines
