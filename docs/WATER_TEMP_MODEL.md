# BiteMap NOVA — Water-Temperature Estimation (validated feasibility + spec)

**Status:** validated feasibility study, 2026-07-16. Real data, real fit, held-out
validation. **Not yet wired into the app.** This documents what to build and the
accuracy we can honestly promise. See [[EVIDENCE_METHODOLOGY]] for the honesty spine.

## Why

Water temperature is one of the strongest drivers of fish activity, but the app only
uses it where a live USGS gage reports it (sparse). Everywhere else the scorer falls
back to a per-species **season curve** — geography-blind, so a cold mountain brook-trout
stream and a warm tidal bay in the same month get the same temperature signal. This
closes that gap with a **physically-grounded, per-water estimate**, never a stereotype,
always labeled `estimated` and beaten by a live gage when one exists.

## The model (validated)

Water temperature responds to air temperature **with thermal inertia** — a hot afternoon
doesn't instantly heat a river. Two steps:

1. **Thermal memory:** smooth daily mean air temp with an exponential moving average of
   timescale **τ days** (τ = the body's thermal-mass knob). `Tₛ[t] = Tₛ[t-1] + (1 − e^(−1/τ))·(Tair[t] − Tₛ[t-1])`
2. **Equilibrium map:** logistic air→water curve (Mohseni form)
   `Tw = μ + (α − μ) / (1 + e^(γ(β − Tₛ)))`

This is the standard *air2water / Mohseni* approach from the limnology literature — not
invented here. τ is exactly the "average depth / size" intuition: shallow/flowing water
has small τ (tracks air fast); deep standing water has large τ (lags by days–weeks).

### Validation (held-out last 30% of each series, RMSE in °F)

Calibration data: USGS daily water temp (param 00010) + Open-Meteo ERA5 daily air temp,
2016–2023 (streams) / 2023–2025 (Lake Anna). Fit on the first 70%, scored on the last 30%.

| Model | Mean test RMSE |
|---|---|
| Season curve *(what the app uses today)* | **3.97 °F** |
| Same-day linear (Stefan) | 3.96 °F |
| Same-day logistic (Mohseni) | 3.73 °F |
| **Thermal-inertia (this model), per-water fit** | **1.96 °F** |

The thermal-inertia model **roughly halves** the current error. Same-day air barely beats
the season curve — the **thermal memory (τ) is what unlocks the accuracy**, confirming the
depth/thermal-mass hypothesis.

### τ scales with thermal mass — confirmed across the spectrum

| Water (gage) | Type | Best-fit τ | Per-water test RMSE |
|---|---|---|---|
| 7 piedmont/mountain streams | flowing | **1.5–3 d** | ~2.0 °F |
| Lake Anna (Henrys / Boxley / Red House) | reservoir | **4–10 d** | 1.5–2.3 °F |

Streams ≈ 2 days; a large reservoir ≈ 6–10 days — monotonic in mean depth, as the physics
requires. Larger/deeper waters are actually *smoother* and slightly easier to predict.

## Coverage — what it takes to run this on all 196 waters

| Input | Availability |
|---|---|
| Air-temp history | **Free everywhere** — Open-Meteo ERA5 archive (no key) or NWS |
| Thermal memory τ | **163/196 waters (flowing) need no depth** — a fixed τ≈2 fits every stream. Only the **33 standing waters** (lake/reservoir/pond/bay) need mean depth to set τ |
| Calibration gages | **58 stream + 3 lake** USGS 00010 sites in-region — many of our waters sit within a few miles of one |
| Mean depth (33 standing waters) | Published for larger managed lakes (DWR pages/dam records); estimate small ponds from surface area (NHD polygons) with wider error |

So **83% of waters are buildable with zero new data.** The only new data cost is a
one-time mean-depth pass for 33 standing waters.

## Accuracy we can honestly promise

- **Near a gage (many piedmont streams):** per-water calibrate/bias-correct → **~2 °F RMSE**.
- **Ungaged, regional curve + type/elevation offset:** **~2.8 °F RMSE** for typical waters.
- **Mountain/spring-fed & large rivers need the offset:** a single regional curve left
  Waites Run (mountain) at 5.2 °F and the Rappahannock (large river) at 4.7 °F. Fix:
  subtract an elevation/coldwater offset (our Class I/II wild-trout designations already
  flag the cold streams) and treat large rivers as their own τ band.

Every estimate ships flagged `estimated` with confidence scaled to input quality
(gage-calibrated > regional+offset > depth-estimated pond), and a **live gage always wins**.

Pooled regional stream curve (τ=2 d, params in °C, valid over the regional air range —
the asymptotes are shape parameters, not literal min/max):
`μ=−9.04, α=44.47, β=17.72, γ=0.069`.

## Honest caveats (state these in the UI/methodology)

- **Surface temperature only.** In summer a deep reservoir stratifies — the surface can be
  80 °F while fish hold at 60 °F on the thermocline. Good for "cold vs warm water today,"
  not for the temperature at fishing depth in a stratified lake.
- **Lake record is short (~2 yr, Lake Anna)** and Lake Anna has a warm (nuclear-cooled)
  arm — the cool-side points were used. More lake gages will tighten the τ–depth curve.
- **Daily, not diurnal.** This validates *daily mean* water temp. Small shallow waters do
  warm several °F on a sunny afternoon; an intraday term for shallow waters is a separate,
  optional refinement — do not fabricate an hourly swing for deep waters (they don't swing).
- **τ–depth mapping** rests on stream (τ≈2) vs Lake Anna (τ≈4–10) — a defensible monotonic
  rule, refined as more lake gages come online. Don't over-claim precision for small ponds.

## Implementation path (when built)

1. **Backend model** in `apps/api/app/scoring/` (feeds the existing `water_temp_multiplier`
   in `activity.py`, which already accepts a measured/estimated temp and flags status):
   pull ~30–60 days of air-temp history per gridpoint (Open-Meteo/NWS), EMA by τ, apply the
   equilibrium curve. τ from waterbody type (flowing→2) or mean depth (standing). Bias-correct
   against the nearest gage where one is within a threshold distance.
2. **Data:** one-time **mean-depth pass for the 33 standing waters** (published where
   available, area-based estimate otherwise) + surface area from NHD polygons.
3. **Wiring:** set `waterTempStatus` to `observed | estimated-calibrated | estimated-regional`;
   reduce confidence accordingly; label the source in the UI. This directly powers the
   temperature handling in [[bitemap-time-scrub-feature]].

## Data provenance

- Water temp: USGS NWIS daily values, parameter 00010 (`waterservices.usgs.gov/nwis/dv`).
- Air temp: Open-Meteo ERA5 archive, `temperature_2m_mean` (`archive-api.open-meteo.com`).
- Fit/validation script + paired series: research scratchpad (2026-07-16 run).
