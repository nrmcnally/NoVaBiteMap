# BiteMap NOVA — Water-Temperature Estimation (implemented alpha + feasibility notes)

**Status:** regional flowing-water alpha implemented, 2026-07-16. The earlier
feasibility analysis reported real-data fitting and chronological holdout
results, but its paired station data and fitting scratchpad are not present in
the repository. Exact accuracy claims therefore remain unreplicated. See
[[EVIDENCE_METHODOLOGY]] for the honesty spine.

## Why

Water temperature is one of the strongest drivers of fish activity, but the app only
uses it where a live USGS gage reports it (sparse). Everywhere else the scorer falls
back to a per-species **season curve** — geography-blind, so a cold mountain brook-trout
stream and a warm tidal bay in the same month get the same temperature signal. This
closes that gap with a **physically grounded, per-water estimate** that retains
explicit provenance and is always superseded by a live gage.

## The alpha model

Water temperature responds to air temperature **with thermal inertia** — a hot afternoon
doesn't instantly heat a river. Two steps:

1. **Thermal memory:** smooth daily mean air temp with an exponential moving average of
   timescale **τ days** (τ = the body's thermal-mass knob). `Tₛ[t] = Tₛ[t-1] + (1 − e^(−1/τ))·(Tair[t] − Tₛ[t-1])`
2. **Equilibrium map:** logistic air→water curve (Mohseni form)
   `Tw = μ + (α − μ) / (1 + e^(γ(β − Tₛ)))`

This is an **EMA + Mohseni-style hybrid**. The logistic stream relationship is
established in the literature, but this is not the published Air2Water lake ODE.
Thermal-memory τ represents response time; it should not be interpreted as a
validated direct conversion from lake depth.

### Feasibility results reported by the prior research run (RMSE in °F)

Calibration data: USGS daily water temp (param 00010) + Open-Meteo ERA5 daily air temp,
2016–2023 (streams) / 2023–2025 (Lake Anna). Fit on the first 70%, scored on the last 30%.

| Model | Mean test RMSE |
|---|---|
| Season curve *(what the app uses today)* | **3.97 °F** |
| Same-day linear (Stefan) | 3.96 °F |
| Same-day logistic (Mohseni) | 3.73 °F |
| **Thermal-inertia (this model), per-water fit** | **1.96 °F** |

The reported run suggests thermal memory may materially improve over the season
curve. These numbers should not appear as a public accuracy guarantee until the
paired data, station manifest, fitting code, and residual results are committed
and independently rerun.

### Thermal-memory results reported by the feasibility run

| Water (gage) | Type | Best-fit τ | Per-water test RMSE |
|---|---|---|---|
| 7 piedmont/mountain streams | flowing | **1.5–3 d** | ~2.0 °F |
| Lake Anna (Henrys / Boxley / Red House) | reservoir | **4–10 d** | 1.5–2.3 °F |

The prior run reported streams near two days and Lake Anna sites between four
and ten days. That is directionally consistent with thermal inertia, but one
short reservoir record cannot establish a general depth-to-τ conversion.

## Coverage — what it takes to run this on all 196 waters

| Input | Availability |
|---|---|
| Air-temp history | **Free everywhere** — Open-Meteo daily history/forecast at runtime |
| Thermal memory τ | **163/196 waters are classified as flowing** and can receive the conservative regional alpha. The **33 standing waters** remain unavailable without an observation until a lake model is validated |
| Calibration gages | **58 stream + 3 lake** USGS 00010 sites in-region — many of our waters sit within a few miles of one |
| Mean depth (33 standing waters) | Published for larger managed lakes (DWR pages/dam records); estimate small ponds from surface area (NHD polygons) with wider error |

So **83% of catalog waters can receive a labeled regional alpha estimate without
new depth data.** Standing-water work will require more than a depth pass:
surface-temperature observations and stratification-aware validation are needed.

## Accuracy and labels used by the alpha implementation

- **Current USGS value:** `observed`; association confidence remains visible.
- **Future after a current observation:** `estimated-calibrated`; the regional
  trajectory is bias-corrected and the correction decays with forecast lead.
- **Ungaged stream/river:** `estimated-regional`; a conservative engineering
  range of ±6 °F for streams or ±8 °F for rivers is displayed. These are not
  statistical prediction intervals.
- **Standing water without a sensor:** `unavailable`; no stream model is applied.
- **Mountain/spring-fed & large rivers need the offset:** a single regional curve left
  Waites Run (mountain) at 5.2 °F and the Rappahannock (large river) at 4.7 °F. Fix:
  subtract an elevation/coldwater offset (our Class I/II wild-trout designations already
  flag the cold streams) and treat large rivers as their own τ band.

Every estimate ships with explicit provenance and reduced scoring authority, and
a **live gage always wins**.

Pooled regional stream curve (τ=2 d, params in °C, valid over the regional air range —
the asymptotes are shape parameters, not literal min/max):
`μ=−9.04, α=44.47, β=17.72, γ=0.069`.

## Honest caveats (state these in the UI/methodology)

- **Surface temperature only.** In summer a deep reservoir stratifies — the surface can be
  80 °F while fish hold at 60 °F on the thermocline. Good for "cold vs warm water today,"
  not for the temperature at fishing depth in a stratified lake.
- **Lake record is short (~2 yr, Lake Anna)** and Lake Anna has a warm (nuclear-cooled)
  arm — the cool-side points were used. More lake gages will tighten the τ–depth curve.
- **Daily, not diurnal.** The model operates on *daily mean* water temperature. Small shallow waters do
  warm several °F on a sunny afternoon; an intraday term for shallow waters is a separate,
  optional refinement — do not fabricate an hourly swing for deep waters (they don't swing).
- **No production τ–depth mapping exists.** The alpha refuses to apply the
  flowing-water model to small ponds, lakes, bays, or reservoirs without an
  observed temperature.

## Current implementation

1. `apps/api/app/scoring/water_temperature.py` contains the daily flowing-water
   model, provenance states, broad alpha ranges, and current-observation
   bias-correction.
2. `apps/api/app/providers/open_meteo.py` supplies the multi-week daily air
   history needed for thermal memory. NWS remains the displayed weather forecast.
3. `apps/api/app/scoring/activity.py` blends thermal and seasonal suitability,
   attenuates estimated-temperature effects by confidence, and includes measured
   dissolved-oxygen stress.
4. The location page requests the canonical FastAPI forecast through
   `/api/live-forecast`; its older browser heuristic remains only as a degraded
   fallback.

Still required before stronger accuracy claims: station manifest, paired raw
series, hashes, fitting script, leave-one-station-out validation, seasonal
residual plots, and a separate standing-water/stratification model.

## Data provenance

- Water temp: USGS NWIS daily values, parameter 00010 (`waterservices.usgs.gov/nwis/dv`).
- Air temp used at runtime: Open-Meteo daily forecast/history endpoint,
  `temperature_2m_mean` (`api.open-meteo.com`).
- Prior feasibility air temp: described as Open-Meteo ERA5 archive.
- Fit/validation script + paired series: referenced by the prior research note
  but not currently present in the repository.
