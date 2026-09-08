import { locations as bundledLocations } from "../../lib/data";
import { buildTimelineScoreSeries, prepareForecastTimeline } from "../../lib/forecast";
import { opportunityFor } from "../../lib/scoring";
import { fetchNwsConditions } from "../../lib/server/nws";
import { profileFor } from "../../lib/species-profiles";
import type { TimelineScoreMatrix, TimelineSpeciesScores } from "../../lib/timeline-score-matrix";

type TimelineRequest = {
  anchor?: { lat?: number; lng?: number; label?: string };
  locationIds?: string[];
  speciesIds?: string[];
};

type TimelineCacheEntry = {
  expiresAt: number;
  matrix: Promise<TimelineScoreMatrix>;
};

const TIMELINE_CACHE_TTL_MS = 10 * 60 * 1000;
// A full regional matrix is compact, but retaining many address-specific
// variants wastes memory on small Railway instances. Four entries cover the
// common current-location and default-location cases without unbounded growth.
const TIMELINE_CACHE_MAX_ENTRIES = 4;
const timelineCache = new Map<string, TimelineCacheEntry>();

function backendBaseUrl() {
  const configured = process.env.API_BASE_URL?.trim();
  if (configured === "") return null;
  if (configured) return configured.replace(/\/$/, "");
  return process.env.NODE_ENV === "development" ? "http://localhost:8000" : null;
}

function validSlug(value: string) {
  return /^[a-z0-9][a-z0-9-]{0,119}$/.test(value);
}

function uniqueSlugs(values: unknown, maximum: number) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((value): value is string => typeof value === "string" && validSlug(value)))].slice(0, maximum);
}

async function canonicalMatrix(
  base: string,
  anchor: { lat: number; lng: number; label: string },
  locationIds: string[],
  speciesIds: string[],
) {
  const response = await fetch(`${base}/api/opportunities/timeline`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      anchor_latitude: anchor.lat,
      anchor_longitude: anchor.lng,
      anchor_label: anchor.label,
      location_ids: locationIds,
      species_ids: speciesIds,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.contractVersion !== "timeline-score-matrix-v0.1.0") {
    throw new Error(`Canonical timeline backend returned ${response.status}`);
  }
  return payload as TimelineScoreMatrix;
}

async function bundledMatrix(
  anchor: { lat: number; lng: number; label: string },
  locationIds: string[],
  speciesIds: string[],
): Promise<TimelineScoreMatrix> {
  const conditions = await fetchNwsConditions(anchor.lat, anchor.lng);
  const requestedLocations = new Set(locationIds);
  const requestedSpecies = new Set(speciesIds);
  // Parsing dates, weather, and alert windows is the expensive part of the
  // forecast. Do it once per request, then reuse the compact values for every
  // location/species pair. The previous implementation rebuilt a full
  // forecast (including Intl formatters and daily objects) for every pair and
  // exhausted the production Worker's CPU allowance.
  const preparedTimeline = prepareForecastTimeline(conditions.periods, conditions.alerts);
  const dayKeys = preparedTimeline.dayKeys;
  const matrix: TimelineScoreMatrix["locations"] = {};

  for (const location of bundledLocations) {
    if (!requestedLocations.has(location.id)) continue;
    const sourceSpecies = requestedSpecies.size > 0
      ? [...requestedSpecies]
      : [...new Set(location.evidence.map((evidence) => evidence.speciesId))];
    const locationScores: Record<string, TimelineSpeciesScores> = {};
    for (const speciesId of sourceSpecies) {
      const base = opportunityFor(location, speciesId);
      const profile = profileFor(speciesId);
      if (!base || !profile) continue;
      const series = buildTimelineScoreSeries(preparedTimeline, {
        availability: base.availability,
        quality: base.quality,
        accessFit: base.accessFit,
        dielPattern: profile.dielPattern,
        seasonalActivityByMonth: profile.seasonalActivityByMonth,
      });
      locationScores[speciesId] = {
        baseScore: base.score,
        confidence: base.confidence,
        confidenceLabel: base.confidenceLabel,
        ...series,
      };
    }
    if (Object.keys(locationScores).length > 0) matrix[location.id] = locationScores;
  }

  return {
    contractVersion: "timeline-score-matrix-v0.1.0",
    engine: "bundled-fallback",
    provider: conditions.provider,
    retrievedAt: conditions.retrievedAt,
    anchor,
    basis: "Scores use one Northern Virginia NWS forecast point and the fish records available for each spot. Location-specific stream-gauge and water-temperature data are not included.",
    periods: conditions.periods,
    alerts: conditions.alerts,
    dayKeys,
    locations: matrix,
  };
}

function cachedMatrix(
  base: string | null,
  anchor: { lat: number; lng: number; label: string },
  locationIds: string[],
  speciesIds: string[],
) {
  const key = JSON.stringify([
    base ?? "bundled",
    anchor.lat.toFixed(4),
    anchor.lng.toFixed(4),
    locationIds,
    speciesIds,
  ]);
  const now = Date.now();
  const existing = timelineCache.get(key);
  if (existing && existing.expiresAt > now) {
    return { matrix: existing.matrix, status: "hit" as const };
  }
  if (existing) timelineCache.delete(key);
  if (timelineCache.size >= TIMELINE_CACHE_MAX_ENTRIES) {
    const oldestKey = timelineCache.keys().next().value;
    if (oldestKey) timelineCache.delete(oldestKey);
  }

  const matrix = (async () => {
    if (base) {
      try {
        return await canonicalMatrix(base, anchor, locationIds, speciesIds);
      } catch {
        // A missing local API must not break the standalone alpha web app. The
        // response labels this fallback so it is never mistaken for canonical.
      }
    }
    return bundledMatrix(anchor, locationIds, speciesIds);
  })();
  const entry = { expiresAt: now + TIMELINE_CACHE_TTL_MS, matrix };
  timelineCache.set(key, entry);
  void matrix.catch(() => {
    if (timelineCache.get(key) === entry) timelineCache.delete(key);
  });
  return { matrix, status: "miss" as const };
}

export async function POST(request: Request) {
  let body: TimelineRequest;
  try {
    body = await request.json() as TimelineRequest;
  } catch {
    return Response.json({ error: "A JSON timeline request is required." }, { status: 400 });
  }
  const lat = Number(body.anchor?.lat);
  const lng = Number(body.anchor?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 36 || lat > 40.5 || lng < -84 || lng > -74) {
    return Response.json({ error: "A valid Virginia-area forecast anchor is required." }, { status: 400 });
  }
  const locationIds = uniqueSlugs(body.locationIds, 300);
  const speciesIds = uniqueSlugs(body.speciesIds, 80);
  if (locationIds.length === 0) {
    return Response.json({ error: "At least one valid location is required." }, { status: 400 });
  }
  const anchor = {
    lat,
    lng,
    label: (body.anchor?.label || "Northern Virginia regional forecast").slice(0, 160),
  };

  const base = backendBaseUrl();
  try {
    const cached = cachedMatrix(base, anchor, locationIds, speciesIds);
    return Response.json(await cached.matrix, {
      headers: {
        "cache-control": "private, no-store",
        "x-bitemap-timeline-cache": cached.status,
      },
    });
  } catch (error) {
    return Response.json({
      error: "The fishing timeline is unavailable because the weather forecast could not be loaded.",
      detail: error instanceof Error ? error.message : "Unknown provider error",
    }, { status: 503 });
  }
}
