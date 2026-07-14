/**
 * Client for the canonical BiteMap FastAPI backend.
 *
 * The API is the source of truth for scored opportunities. Callers degrade
 * gracefully when it is unreachable (e.g. a static preview with no backend):
 * fetchApi returns null rather than throwing, and UI falls back to the
 * evidence facts already bundled with the page.
 */
export function apiBaseUrl(): string | null {
  const explicit =
    typeof process !== "undefined" && process.env
      ? process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL
      : undefined;
  // An explicit empty string disables the API (instant evidence-only fallback).
  if (explicit === "") return null;
  if (explicit) return explicit;
  // Default to the local API. A doomed fetch (e.g. no backend deployed) fails fast
  // via the short timeout below, so this never stalls navigation.
  return "http://localhost:8000";
}

export async function fetchApi<T>(path: string, init?: RequestInit): Promise<T | null> {
  const base = apiBaseUrl();
  if (!base) return null;
  try {
    const response = await fetch(`${base}${path}`, {
      ...init,
      headers: { Accept: "application/json", ...(init?.headers ?? {}) },
      // Server-render freshness: opportunities change with conditions.
      cache: "no-store",
      // Short cap so a slow/absent backend never freezes navigation.
      signal: init?.signal ?? AbortSignal.timeout(2500),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export type FishFacts = {
  preferredTempF: [number | null, number | null];
  toleranceTempF: [number | null, number | null];
  typicalSizeInches: [number | null, number | null];
  citationLengthInches: number | null;
  citationWeightLb: number | null;
  identification: string | null;
  baits: string[];
  dielPattern: string;
  biteTimes: string;
  spawnMonths: number[];
  spawnWindow: string;
  spawnTempF: number | null;
  seasonalPeak: string;
  seasonalActivityByMonth: number[];
  habitat: string | null;
  techniquesBySeason: { cold?: string; cool?: string; warm?: string };
  waterbodyPreference: Record<string, number>;
  family: string | null;
  nativeStatus: "native" | "introduced" | "invasive" | null;
  statusNote: string | null;
  handlingNote: string | null;
  diet: string | null;
  confusedWith: { speciesId: string; tell: string }[];
  stateRecordLb: number | null;
  confidence: string | null;
  sources: string[];
  notes: string | null;
};

export type ScoredSpecies = {
  speciesId: string;
  name: string;
  scientificName: string | null;
  opportunity_score: number;
  availability_score: number;
  fishery_quality_score: number | null;
  activity_score: number | null;
  confidence_score: number;
  confidence_label: "High" | "Moderate" | "Low";
  state: "strong" | "fair" | "low";
  evidence_type: string;
  evidence_summary: string | null;
  last_evidence: string | null;
  technique: string | null;
  depth: string | null;
  modeled: boolean;
  bestWindow: string | null;
  activityLive: boolean;
  source_name: string | null;
  source_url: string | null;
  factors: { positive: string[]; negative: string[] };
  fishFacts: FishFacts | null;
  stocked: boolean;
  stockingCategory: string | null;
  stockingPlanUrl: string | null;
};

export type SpeciesLocation = {
  id: string;
  name: string;
  waterbody: string;
  waterbodyType: string;
  county: string;
  watershed: string | null;
  travelMinutes: number | null;
  accessStatus: "verified" | "listed" | "unverified";
  availability: number;
  opportunityScore: number;
  confidenceScore: number;
  confidenceLabel: "High" | "Moderate" | "Low";
  state: "strong" | "fair" | "low";
  evidenceType: string;
  modeled: boolean;
  evidenceSummary: string | null;
};

export type SpeciesDetail = {
  id: string;
  name: string;
  scientificName: string;
  code: string;
  habitat: string | null;
  aliases: string[];
  facts: FishFacts | null;
  locations: SpeciesLocation[];
  disclaimer: string;
};

export function fetchSpecies(speciesId: string): Promise<SpeciesDetail | null> {
  return fetchApi<SpeciesDetail>(`/api/species/${encodeURIComponent(speciesId)}`);
}

export type InsufficientSpecies = {
  speciesId: string;
  name: string;
  availabilityScore: number;
  reason: string;
  evidenceType: string;
};

export type WhatsBitingResponse = {
  location: { id: string; name: string; waterbody: string; waterbodyType: string; county: string };
  liveConditions: boolean;
  hydrologyAvailable: boolean;
  species: ScoredSpecies[];
  insufficient: InsufficientSpecies[];
  disclaimer: string;
};

export function fetchWhatsBiting(locationId: string, live = false): Promise<WhatsBitingResponse | null> {
  return fetchApi<WhatsBitingResponse>(`/api/locations/${encodeURIComponent(locationId)}/species?live=${live}`);
}
