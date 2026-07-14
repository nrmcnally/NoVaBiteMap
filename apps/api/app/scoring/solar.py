"""Dependency-free solar geometry: solar elevation and sunrise/sunset.

Used by the species activity model to place real dawn/dusk windows (crepuscular
feeding) instead of fixed clock-hour bands, and to display sunrise/sunset. Times
are computed from the UTC instant, so daylight-saving is handled by the caller's
timezone-aware datetimes (NWS periods already carry the America/New_York offset).

Accuracy is ~0.5 degrees / ~1 minute, which is ample for fishing-window scoring.
"""
from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone

_RAD = math.pi / 180.0
_SUNRISE_ELEVATION = -0.833  # standard atmospheric refraction at the horizon


def _julian_date(dt_utc: datetime) -> float:
    dt = dt_utc.astimezone(timezone.utc)
    a = (14 - dt.month) // 12
    y = dt.year + 4800 - a
    m = dt.month + 12 * a - 3
    jdn = dt.day + (153 * m + 2) // 5 + 365 * y + y // 4 - y // 100 + y // 400 - 32045
    frac = (dt.hour - 12) / 24 + dt.minute / 1440 + dt.second / 86400
    return jdn + frac


def solar_elevation(dt_utc: datetime, latitude: float, longitude: float) -> float:
    """Solar elevation angle in degrees (negative = below horizon)."""
    n = _julian_date(dt_utc) - 2451545.0
    mean_long = (280.460 + 0.9856474 * n) % 360
    mean_anom = (357.528 + 0.9856003 * n) % 360
    ecliptic = mean_long + 1.915 * math.sin(mean_anom * _RAD) + 0.020 * math.sin(2 * mean_anom * _RAD)
    obliquity = 23.439 - 0.0000004 * n
    declination = math.asin(math.sin(obliquity * _RAD) * math.sin(ecliptic * _RAD)) / _RAD
    gmst = (280.46061837 + 360.98564736629 * n) % 360
    lmst = (gmst + longitude) % 360
    right_ascension = math.atan2(
        math.cos(obliquity * _RAD) * math.sin(ecliptic * _RAD), math.cos(ecliptic * _RAD)
    ) / _RAD
    hour_angle = (lmst - right_ascension + 180) % 360 - 180
    elevation = math.asin(
        math.sin(latitude * _RAD) * math.sin(declination * _RAD)
        + math.cos(latitude * _RAD) * math.cos(declination * _RAD) * math.cos(hour_angle * _RAD)
    ) / _RAD
    return elevation


def sun_times(
    year: int, month: int, day: int, latitude: float, longitude: float, tz_offset_hours: float
) -> tuple[datetime | None, datetime | None]:
    """Sunrise and sunset for a local calendar date, returned as timezone-aware
    datetimes in the supplied fixed offset. Returns None where the sun does not
    cross the horizon (not applicable at NOVA latitudes)."""
    tz = timezone(timedelta(hours=tz_offset_hours))
    local_midnight = datetime(year, month, day, 0, 0, tzinfo=tz)
    step = timedelta(minutes=2)
    samples: list[tuple[datetime, float]] = []
    current = local_midnight
    for _ in range((24 * 60) // 2 + 1):
        samples.append((current, solar_elevation(current, latitude, longitude)))
        current += step

    sunrise: datetime | None = None
    sunset: datetime | None = None
    for (t0, e0), (t1, e1) in zip(samples, samples[1:]):
        if e0 < _SUNRISE_ELEVATION <= e1 and sunrise is None:
            sunrise = _interpolate(t0, e0, t1, e1)
        if e0 >= _SUNRISE_ELEVATION > e1 and sunrise is not None and sunset is None:
            sunset = _interpolate(t0, e0, t1, e1)
    return sunrise, sunset


def _interpolate(t0: datetime, e0: float, t1: datetime, e1: float) -> datetime:
    if e1 == e0:
        return t0
    fraction = (_SUNRISE_ELEVATION - e0) / (e1 - e0)
    return t0 + (t1 - t0) * fraction


def daylight_context(dt_local: datetime, latitude: float, longitude: float) -> dict:
    """Classify an hour by solar geometry for diel (dawn/dusk/day/night) scoring."""
    elevation = solar_elevation(dt_local, latitude, longitude)
    if elevation < -6:
        phase = "night"
    elif elevation < 8:
        phase = "twilight"  # dawn or dusk band
    elif elevation < 45:
        phase = "day"
    else:
        phase = "bright"
    return {"elevation": round(elevation, 2), "phase": phase}
