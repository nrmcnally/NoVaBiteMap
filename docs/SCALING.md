# BiteMap NOVA — Productionization / Scaling Gaps

**Status:** recorded 2026-07-17. These are the deltas between "works for a closed
alpha of nearby friends" and "a public site used by fishermen throughout the
region." **None block the closed alpha.** They are the next-phase list, ordered
by impact. See [[ARCHITECTURE]] and [[BITE_SCIENCE_ROADMAP]].

## The data model is right; keep it

Data is fetched **on-demand when a spot is viewed**, then cached server-side
(`apps/api/app/core/cache.py`) for a short TTL. There is **no background poller**,
and that is correct: a poller refreshing all 252 waters every 15 min would make
~24k NWS calls/day with zero users, risk rate-limit bans, and not improve accuracy
(a forecast is a forecast). Lazy + cache + graceful degradation (no fabricated data
on provider failure) is the right foundation. Current TTLs: weather/hydrology
15 min, water-temp air history 6 hr (`apps/api/app/services/conditions.py:24-26`).

## Gaps to address before regional public launch (prioritized)

### 1. Map scrubber uses ONE regional weather anchor (highest impact)
The Explore map/timeline scores every spot off a single Fairfax-area forecast
(`app/components/ExploreDashboard.tsx`, disclosed at `/methodology`). NoVa spans
the tidal Potomac to the Blue Ridge; one anchor cannot represent a mountain trout
stream 60 mi west when a front hits only the mountains. **Fix:** per-NWS-gridpoint
forecasts — cluster spots to their ~2.5 km NWS gridpoint, fetch/cache once per
gridpoint, score each spot against its own grid. This is the biggest accuracy win
*and* it's the scrubber upgrade already gameplanned (see [[bitemap-time-scrub-feature]]).
The location **detail** page already fetches the spot's own forecast, so only the
map-wide path is affected.

### 2. Cache is not shared across instances unless Redis is on
`redis_url` is optional and currently unset (`apps/api/app/core/config.py`), so the
cache falls back to an in-process dict. One backend instance is fine; the moment you
scale horizontally for regional load, each instance keeps its own cache, hit rate
fragments, and upstream (NWS/USGS) load multiplies. **Fix:** enable the already-wired
Redis (or Cloudflare KV, depending on where the FastAPI backend is hosted) in prod.

### 3. Cache keys per-coordinate, not per-gridpoint (redundant upstream fetches)
Weather cache key is `nws:{lat:.3f},{lng:.3f}` (`conditions.py:30`). Waters sharing
one NWS gridpoint each trigger a *separate* NWS fetch. **Fix:** key on the gridpoint
— fewer upstream calls, higher hit rate. Same change as #1.

### 4. Canonical model convergence is delivered; environmental convergence remains
Explore now requests one precomputed score matrix from
`POST /api/opportunities/timeline`. When FastAPI is available, that matrix and the
spot-detail forecast run the same reviewed Python species model; the browser only
selects an already-computed array value while scrubbing. The standalone hosted
web fallback is explicitly labeled `bundled-fallback` and is precomputed
server-side rather than in the scrub hot path.

Map and detail numbers can still legitimately differ because Explore uses the
disclosed regional anchor without spot-specific hydrology/water temperature,
while detail uses the spot forecast and verified environmental associations.
Per-gridpoint weather in gap #1 is the remaining convergence work.

### 5. No cache-stampede / rate-limit protection
Under peak load (dawn/dusk), an expired cache entry can let many requests hit NWS at
once. **Fix:** stale-while-revalidate + single-flight lock; confirm/expand retry &
backoff and a "provider down" circuit breaker. (Audit did not confirm current
single-flight behavior — verify before launch.)

## What background polling would (and wouldn't) buy
Would NOT improve accuracy. WOULD help: selectively pre-warming the top-N popular
spots to cut p99 latency at peak and decouple user latency from upstream hiccups.
Do it for a handful of hot spots, never for all 252.
