"""Transparent daily surface-water temperature estimation for flowing waters.

The regional alpha model combines:
1. an exponential moving average of daily mean air temperature (thermal memory);
2. a four-parameter Mohseni-style logistic air-to-water equilibrium curve.

The parameters are the pooled regional values recorded by the 2026-07-16
feasibility study. The repository does not yet contain the original paired
station dataset, so these estimates intentionally carry broad uncertainty and
must not be represented as independently reproduced validation results.

This model estimates daily *surface* temperature. It is not applied to ponds,
lakes, reservoirs, or bays without an observed USGS temperature because standing
waters require a separate stratification-aware model.
"""
from __future__ import annotations

from datetime import date, datetime
from math import exp

MODEL_VERSION = "regional-flowing-water-0.1"
MODEL_METHOD = "air-temperature EMA plus Mohseni logistic"
FLOWING_WATER_TYPES = {"stream", "river"}

# Pooled regional curve from docs/WATER_TEMP_MODEL.md, in degrees Celsius.
MOHSENI_MU_C = -9.04
MOHSENI_ALPHA_C = 44.47
MOHSENI_BETA_C = 17.72
MOHSENI_GAMMA = 0.069

# Conservative alpha defaults pending leave-one-station-out validation.
THERMAL_MEMORY_DAYS = {"stream": 2.0, "river": 3.0}
REGIONAL_UNCERTAINTY_F = {"stream": 6.0, "river": 8.0}
REGIONAL_CONFIDENCE = {"stream": 0.58, "river": 0.42}
CALIBRATED_UNCERTAINTY_F = {"stream": 4.0, "river": 6.0}


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def _c_to_f(value: float) -> float:
    return value * 9 / 5 + 32


def _f_to_c(value: float) -> float:
    return (value - 32) * 5 / 9


def equilibrium_water_temperature_c(smoothed_air_c: float) -> float:
    """Mohseni-style S curve, bounded to liquid freshwater surface values."""
    denominator = 1 + exp(MOHSENI_GAMMA * (MOHSENI_BETA_C - smoothed_air_c))
    modeled = MOHSENI_MU_C + (MOHSENI_ALPHA_C - MOHSENI_MU_C) / denominator
    return _clamp(modeled, 0.0, 35.0)


def modeled_daily_temperatures(
    daily_air: list[dict],
    waterbody_type: str,
) -> dict[str, float]:
    """Return date -> modeled water temperature F after applying thermal memory."""
    if waterbody_type not in FLOWING_WATER_TYPES:
        return {}
    valid: list[tuple[str, float]] = []
    for item in daily_air:
        try:
            day = str(item["date"])
            datetime.strptime(day, "%Y-%m-%d")
            valid.append((day, float(item["temperatureC"])))
        except (KeyError, TypeError, ValueError):
            continue
    valid.sort(key=lambda item: item[0])
    if len(valid) < 14:
        return {}

    tau = THERMAL_MEMORY_DAYS[waterbody_type]
    response = 1 - exp(-1 / tau)
    smoothed_air_c = valid[0][1]
    modeled: dict[str, float] = {}
    for day, air_c in valid:
        smoothed_air_c += response * (air_c - smoothed_air_c)
        water_c = equilibrium_water_temperature_c(smoothed_air_c)
        modeled[day] = round(_c_to_f(water_c), 1)
    return modeled


def unavailable_temperature_state(reason: str) -> dict:
    return {
        "status": "unavailable",
        "valueF": None,
        "rangeF": None,
        "uncertaintyF": None,
        "confidence": 0.0,
        "source": None,
        "observedAt": None,
        "modelVersion": None,
        "method": None,
        "daily": {},
        "reason": reason,
    }


def _observed_reading(
    value_f: float,
    observed_at: str | None,
    association_factor: float,
) -> dict:
    return {
        "status": "observed",
        "valueF": round(value_f, 1),
        "rangeF": None,
        "uncertaintyF": None,
        "confidence": round(_clamp(association_factor, 0.35, 1.0), 2),
        "source": "USGS representative gage",
        "observedAt": observed_at,
        "modelVersion": None,
        "method": "instrument observation at associated station",
    }


def _regional_reading(value_f: float, waterbody_type: str) -> dict:
    uncertainty = REGIONAL_UNCERTAINTY_F[waterbody_type]
    return {
        "status": "estimated-regional",
        "valueF": round(value_f, 1),
        "rangeF": [
            round(max(32.0, value_f - uncertainty), 1),
            round(min(95.0, value_f + uncertainty), 1),
        ],
        "uncertaintyF": uncertainty,
        "confidence": REGIONAL_CONFIDENCE[waterbody_type],
        "source": "Open-Meteo air-temperature history",
        "observedAt": None,
        "modelVersion": MODEL_VERSION,
        "method": MODEL_METHOD,
    }


def _calibrated_reading(
    value_f: float,
    waterbody_type: str,
    association_factor: float,
) -> dict:
    uncertainty = CALIBRATED_UNCERTAINTY_F[waterbody_type] + max(
        0.0, (1 - association_factor) * 4
    )
    confidence = _clamp(0.68 + 0.22 * association_factor, 0.55, 0.9)
    return {
        "status": "estimated-calibrated",
        "valueF": round(value_f, 1),
        "rangeF": [
            round(max(32.0, value_f - uncertainty), 1),
            round(min(95.0, value_f + uncertainty), 1),
        ],
        "uncertaintyF": round(uncertainty, 1),
        "confidence": round(confidence, 2),
        "source": "regional model bias-corrected to current USGS gage",
        "observedAt": None,
        "modelVersion": MODEL_VERSION,
        "method": MODEL_METHOD,
    }


def build_water_temperature_state(
    daily_air: list[dict],
    waterbody_type: str,
    *,
    observed_temp_f: float | None = None,
    observed_at: str | None = None,
    association_factor: float = 1.0,
    as_of_date: str | None = None,
) -> dict:
    """Build current and daily temperature provenance for forecast scoring."""
    as_of = as_of_date or date.today().isoformat()
    observed = (
        _observed_reading(observed_temp_f, observed_at, association_factor)
        if observed_temp_f is not None
        else None
    )

    if waterbody_type not in FLOWING_WATER_TYPES:
        if observed is None:
            return unavailable_temperature_state(
                "Standing-water temperature requires an observation or a separate lake model."
            )
        return {**observed, "daily": {as_of: observed}}

    modeled = modeled_daily_temperatures(daily_air, waterbody_type)
    if not modeled:
        if observed is None:
            return unavailable_temperature_state(
                "Insufficient air-temperature history for a regional flowing-water estimate."
            )
        return {**observed, "daily": {as_of: observed}}

    # Historical air is needed to initialize thermal memory, but callers only need
    # current/future water estimates in the response payload.
    daily: dict[str, dict] = {
        day: _regional_reading(value_f, waterbody_type)
        for day, value_f in modeled.items()
        if day >= as_of
    }

    if observed is not None:
        baseline = modeled.get(as_of)
        if baseline is None:
            prior = [day for day in modeled if day <= as_of]
            baseline = modeled[max(prior)] if prior else None
        bias = observed_temp_f - baseline if baseline is not None else 0.0
        as_of_dt = datetime.strptime(as_of, "%Y-%m-%d").date()
        tau = THERMAL_MEMORY_DAYS[waterbody_type]
        for day, modeled_f in modeled.items():
            day_dt = datetime.strptime(day, "%Y-%m-%d").date()
            lead = (day_dt - as_of_dt).days
            if lead < 0:
                continue
            if lead == 0:
                daily[day] = observed
                continue
            decayed_bias = bias * exp(-lead / tau)
            daily[day] = _calibrated_reading(
                modeled_f + decayed_bias,
                waterbody_type,
                association_factor,
            )
        daily.setdefault(as_of, observed)
        return {**observed, "daily": daily}

    current = daily.get(as_of)
    if current is None:
        prior = [day for day in modeled if day <= as_of]
        fallback_day = max(prior) if prior else max(modeled)
        current = _regional_reading(modeled[fallback_day], waterbody_type)
    return {**current, "daily": daily}


def temperature_reading_for_date(state: dict | None, date_key: str) -> dict:
    if not state:
        return unavailable_temperature_state("No water-temperature state was supplied.")
    daily = state.get("daily") or {}
    reading = daily.get(date_key)
    if reading:
        return reading
    return {key: value for key, value in state.items() if key != "daily"}
