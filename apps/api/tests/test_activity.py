from __future__ import annotations

import json
import pathlib
import sys
from datetime import datetime, timedelta, timezone

API_ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))

from app.scoring.activity import build_species_forecast, hourly_activity  # noqa: E402
from app.scoring.solar import daylight_context, sun_times  # noqa: E402

PROFILES = {p["speciesId"]: p for p in json.loads(
    (API_ROOT / "app" / "data" / "species_profiles.json").read_text()
)["profiles"]}


# --- solar / sunrise-sunset / DST -------------------------------------------
def test_summer_and_winter_sunrise_are_reasonable_and_dst_aware():
    # EDT (summer, -4) vs EST (winter, -5) — offsets supplied by caller.
    sr_summer, ss_summer = sun_times(2026, 6, 21, 38.9, -77.03, -4)
    sr_winter, ss_winter = sun_times(2026, 12, 21, 38.9, -77.03, -5)
    assert 5 <= sr_summer.hour <= 6      # ~05:43 EDT
    assert 20 <= ss_summer.hour <= 21    # ~20:36 EDT
    assert 7 <= sr_winter.hour <= 8      # ~07:23 EST
    assert 16 <= ss_winter.hour <= 17    # ~16:49 EST
    # Summer days are longer than winter days.
    assert (ss_summer - sr_summer) > (ss_winter - sr_winter)


def test_daylight_phase_classification():
    tz = timezone(timedelta(hours=-4))
    assert daylight_context(datetime(2026, 6, 21, 3, 0, tzinfo=tz), 38.9, -77.03)["phase"] == "night"
    assert daylight_context(datetime(2026, 6, 21, 13, 0, tzinfo=tz), 38.9, -77.03)["phase"] == "bright"


def _periods(date: str, hours, offset="-04:00", temp=72, wind="5 mph", sky="Partly Cloudy", precip=10):
    return [
        {
            "startTime": f"{date}T{h:02d}:00:00{offset}",
            "temperature": temp,
            "temperatureUnit": "F",
            "shortForecast": sky,
            "windSpeed": wind,
            "precipitationProbability": precip,
        }
        for h in hours
    ]


def _avg_activity(species, date, offset="-04:00", wb="river"):
    fc = build_species_forecast(
        PROFILES[species], _periods(date, range(4, 21), offset),
        waterbody_type=wb, latitude=38.91, longitude=-78.19,
        availability=0.85, quality=0.7, access_fit=0.9, base_confidence=70,
    )
    return sum(h["activity"] for h in fc["hourly"]) / len(fc["hourly"])


# --- species differentiation (the audit's #1 gap) ---------------------------
def test_trout_and_bass_diverge_by_season():
    # Summer: warmwater bass beat coldwater trout.
    assert _avg_activity("smallmouth-bass", "2026-07-15") > _avg_activity("rainbow-trout", "2026-07-15")
    # Winter: the ranking inverts.
    assert _avg_activity("rainbow-trout", "2026-01-15", "-05:00") > _avg_activity("smallmouth-bass", "2026-01-15", "-05:00")


def test_flexible_and_crepuscular_diel_patterns_differ_without_forcing_catfish_nocturnal():
    tz = timezone(timedelta(hours=-4))
    def suit(species, hour):
        return hourly_activity(
            PROFILES[species], dt_local=datetime(2026, 10, 15, hour, 0, tzinfo=tz),
            latitude=38.91, longitude=-78.19, waterbody_type="river",
            water_temp_f=None, wind_mph=5, precip_prob=10, short_forecast="Clear", hydrology=None,
        )["suitability"]
    # Channel catfish is flexible: low light has only a mild edge, not a universal
    # night-only multiplier.
    assert PROFILES["channel-catfish"]["dielPattern"] == "flexible"
    assert abs(suit("channel-catfish", 23) / suit("channel-catfish", 13) - 1.0) < 0.1
    # Smallmouth (crepuscular) favors dawn over midday.
    assert suit("smallmouth-bass", 7) > suit("smallmouth-bass", 13)


def test_channel_catfish_temperature_is_stress_only_not_a_fake_optimum_band():
    tz = timezone(timedelta(hours=-4))

    def temperature_factor(value):
        return hourly_activity(
            PROFILES["channel-catfish"], dt_local=datetime(2026, 7, 15, 8, 0, tzinfo=tz),
            latitude=38.91, longitude=-78.19, waterbody_type="reservoir",
            water_temp_f=value, wind_mph=5, precip_prob=10, short_forecast="Clear", hydrology=None,
        )["factors"]["waterTemperature"]

    assert temperature_factor(58) == temperature_factor(72) == temperature_factor(84) == 1.0
    assert temperature_factor(40) < 1.0
    assert temperature_factor(93) < 1.0


def test_air_temperature_never_acts_as_water_temperature():
    tz = timezone(timedelta(hours=-4))
    def suit(water_temp):
        return hourly_activity(
            PROFILES["rainbow-trout"], dt_local=datetime(2026, 7, 15, 8, 0, tzinfo=tz),
            latitude=38.91, longitude=-78.19, waterbody_type="stream",
            water_temp_f=water_temp, wind_mph=5, precip_prob=10, short_forecast="Clear", hydrology=None,
        )
    warm = suit(78)   # measured warm water strongly suppresses trout
    cold = suit(55)   # measured cold water does not
    none = suit(None)  # no measurement => neutral temperature term, not air-driven
    assert warm["factors"]["waterTemperature"] < 0.5
    assert cold["factors"]["waterTemperature"] == 1.0
    assert none["factors"]["waterTemperature"] == 1.0
    assert none["waterTempStatus"] == "unavailable"


def test_regional_temperature_has_less_authority_than_an_observation():
    tz = timezone(timedelta(hours=-4))
    common = {
        "dt_local": datetime(2026, 7, 15, 8, 0, tzinfo=tz),
        "latitude": 38.91,
        "longitude": -78.19,
        "waterbody_type": "stream",
        "water_temp_f": 78,
        "wind_mph": 5,
        "precip_prob": 10,
        "short_forecast": "Clear",
        "hydrology": None,
    }
    observed = hourly_activity(
        PROFILES["rainbow-trout"],
        **common,
        water_temp_status="observed",
        water_temp_confidence=1.0,
    )
    estimated = hourly_activity(
        PROFILES["rainbow-trout"],
        **common,
        water_temp_status="estimated-regional",
        water_temp_confidence=0.42,
    )
    assert observed["factors"]["waterTemperature"] < estimated["factors"]["waterTemperature"] < 1


def test_spawn_phase_is_exposed_as_context_not_a_generic_bonus():
    tz = timezone(timedelta(hours=-4))
    activity = hourly_activity(
        PROFILES["smallmouth-bass"],
        dt_local=datetime(2026, 5, 15, 8, 0, tzinfo=tz),
        latitude=38.91,
        longitude=-78.19,
        waterbody_type="river",
        water_temp_f=60,
        wind_mph=5,
        precip_prob=10,
        short_forecast="Clear",
        hydrology=None,
    )
    assert activity["reproductivePhase"] == "spawn-window-temperature-aligned"
    assert activity["factors"]["reproductivePhase"] == "spawn-window-temperature-aligned"


def test_low_dissolved_oxygen_suppresses_activity_but_turbidity_is_context_only():
    tz = timezone(timedelta(hours=-4))

    def activity(do_mg_l, turbidity):
        return hourly_activity(
            PROFILES["rainbow-trout"],
            dt_local=datetime(2026, 7, 15, 8, 0, tzinfo=tz),
            latitude=38.91,
            longitude=-78.19,
            waterbody_type="stream",
            water_temp_f=66,
            wind_mph=5,
            precip_prob=10,
            short_forecast="Clear",
            hydrology={
                "available": True,
                "rapidRise": False,
                "extremeFlow": False,
                "lowFlow": False,
                "dissolvedOxygenMgL": do_mg_l,
                "turbidityFnu": turbidity,
                "associationFactor": 1.0,
            },
        )

    high_oxygen = activity(8.0, 2)
    low_oxygen = activity(3.5, 2)
    muddy_but_oxygenated = activity(8.0, 100)
    assert low_oxygen["suitability"] < high_oxygen["suitability"]
    assert muddy_but_oxygenated["suitability"] == high_oxygen["suitability"]
    assert high_oxygen["factors"]["hydrology"] == 1.0


def test_forecast_produces_days_with_sunrise_and_confidence_decay():
    fc = build_species_forecast(
        PROFILES["largemouth-bass"], _periods("2026-05-10", range(0, 24)) + _periods("2026-05-11", range(0, 24)),
        waterbody_type="lake", latitude=38.76, longitude=-77.30,
        availability=0.86, quality=0.7, access_fit=0.9, base_confidence=80,
    )
    assert len(fc["days"]) >= 2
    assert fc["days"][0]["sunrise"] is not None
    assert fc["days"][1]["confidence"] < fc["days"][0]["confidence"]  # horizon decay
    assert fc["waterTempStatus"] == "unavailable"
