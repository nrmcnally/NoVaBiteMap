# BiteMap NOVA bite-science roadmap

## What the score means

The biological term estimates **relative angling catchability/activity**, not
pure hunger and not catch probability. Fish may strike while feeding, defending
territory or a nest, migrating, or reacting aggressively. Presence evidence and
fishery quality remain separate from current activity.

## Scoring profile v1.1

The canonical activity score currently uses:

1. species monthly seasonal prior;
2. observed or labeled estimated daily surface-water temperature;
3. species daylight/activity pattern using calculated sunrise and sunset;
4. dissolved-oxygen stress when reported by the associated USGS station;
5. waterbody fit;
6. supported rapid-rise/extreme-flow constraints;
7. severe-weather and high-wind presentation/safety penalties.

Temperature and the monthly prior are blended rather than multiplied. A regional
temperature estimate has less influence than an observation. Adequate dissolved
oxygen receives no artificial bonus; low oxygen acts only as a constraint.
Turbidity is exposed but not scored universally because its effect depends on
species, feeding mode, prey, and waterbody.

## Candidate scoring profile v1.2

The completed model-translation audit identifies 22 modelable rules across 17
species. Two have unusually direct field catchability or local feeding support;
twenty are evidence-informed rules based on correct-species feeding, foraging,
activity, or catchability studies. Study geography, life stage, and laboratory
setting control confidence and maximum contribution rather than automatically
excluding the evidence.

Each candidate is bounded by its tested range and one conservative engineering
envelope: minor (0.97-1.03), moderate (0.95-1.05), strong conservative
(0.92-1.08), or severe-stress penalty (0.85-1.00). These are model caps, not
published effect sizes. Temperature and light candidates calibrate or replace
the existing species factor; they are never multiplied on top of the same
seasonal, thermal, diel, cloud, or solar signal.

The candidate definitions remain outside production in
`research/species/model-review/candidate-blueprints.json`. Versioned
`candidate-v0.2.0` fixtures now exercise 21 rules in an isolated evaluator and
hold fallfish neutral pending exact source timing. All 194 golden scenarios pass,
and an adversarial pass reduced six effects that remained too assertive for
their transfer uncertainty. The live scorer still does not read these artifacts.
The future offline cohort is limited to snakehead and walleye diel responses;
prospective observations, preregistration, and named human approval remain
required before any feature-flagged live comparison.

## Factors deliberately not given a universal score

- **Barometric pressure:** recordable for future calibration, currently zero
  weight. Direct feeding evidence is limited and larger syntheses do not support
  a reliable general effect.
- **Moon phase:** potentially relevant for some species and fisheries, but
  inconsistent and likely context-specific.
- **Cloud cover and ordinary rain probability:** no universal bonus. Their
  mechanisms overlap with underwater light, flow, turbidity, and temperature.
- **Normal wind:** no universal biological penalty or bonus. High wind retains a
  modest presentation/safety cost.
- **Turbidity:** awaiting species/guild response profiles.
- **Fishing pressure:** scientifically important but no reliable real-time NOVA
  feed exists yet.

## Next scientific increments

1. Add explicit per-species reproductive phases: pre-spawn, spawning/nesting,
   post-spawn, and non-spawning. Temperature trend, photoperiod, and flow should
   determine phase; nesting aggression must be labeled as vulnerability rather
   than feeding.
2. Add species/guild clarity responses for visual drift feeders, ambush
   predators, benthic feeders, and nocturnal/olfactory feeders.
3. Add seasonal flow percentiles and rate-of-change from longer USGS records.
4. Add tidal stage/current and salinity for tidal Potomac and estuarine waters.
5. Add lake surface temperature, stratification risk, and depth-zone estimates
   instead of applying the stream model to standing waters.
6. Collect opt-in trip effort, catch/no-catch, lure/bait, time, and handling-safe
   metadata. Calibrate only with watershed/time holdouts and publish calibration
   error by species and evidence tier.

## Primary research anchors

- Mohseni et al. (1998), nonlinear stream-temperature regression:
  https://doi.org/10.1029/98WR01877
- Piccolroaz et al. (2013), Air2Water lake surface model:
  https://doi.org/10.5194/hess-17-3323-2013
- Toffolon and Piccolroaz (2015), river temperature with air and discharge:
  https://doi.org/10.1088/1748-9326/10/11/114011
- Buentello et al. (2000), temperature/oxygen interaction in channel-catfish
  feeding: https://doi.org/10.1016/S0044-8486(99)00274-4
- Kuparinen et al. (2010), pike angling catchability and environmental/fishing
  factors: https://doi.org/10.1016/j.fishres.2010.03.011
- Suski et al. (2004), vulnerability of nesting largemouth and smallmouth bass:
  https://doi.org/10.1577/T03-079.1
