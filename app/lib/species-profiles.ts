import profilesPayload from "./generated/species-profiles.json";
import communityProfilesPayload from "./community-fish-profiles.json";

export type SpeciesLookalike = {
  speciesId: string;
  tell: string;
};

export type SeasonalTechniques = {
  cold?: string;
  cool?: string;
  warm?: string;
};

export type SpeciesProfile = {
  speciesId: string;
  guideOnly?: boolean;
  family?: string;
  nativeStatus?: "native" | "introduced" | "invasive";
  statusNote?: string;
  typicalMinInches?: number;
  typicalMaxInches?: number;
  citationLengthInches?: number | null;
  waterbodyPreference?: Record<string, number>;
  seasonalActivityByMonth?: number[];
  dielPattern?: string;
  preferredMinF?: number;
  preferredMaxF?: number;
  temperatureResponse?: "preference-band" | "stress-only";
  toleranceMinF?: number;
  toleranceMaxF?: number;
  spawnMonths?: number[];
  spawnTempF?: number;
  primaryTechniquesBySeason?: SeasonalTechniques;
  identification?: string;
  baits?: string[];
  handlingNote?: string;
  regulationAlert?: {
    title: string;
    detail: string;
    sourceUrl: string;
    sourceLabel: string;
  };
  diet?: string;
  confusedWith?: SpeciesLookalike[];
  sourceUrls?: string[];
  notes?: string;
  confidence?: string;
  citationWeightLb?: number | null;
  stateRecordLb?: number | null;
};

const byId: Record<string, SpeciesProfile> = Object.fromEntries(
  ((profilesPayload.profiles as SpeciesProfile[]) ?? []).map((p) => [p.speciesId, p]),
);

const communityById: Record<string, SpeciesProfile> = Object.fromEntries(
  ((communityProfilesPayload.profiles as SpeciesProfile[]) ?? []).map((p) => [p.speciesId, p]),
);

export function profileFor(speciesId: string): SpeciesProfile | undefined {
  return byId[speciesId];
}

/**
 * Returns either a reviewed bite-scoring profile or a guide-only community
 * profile. Guide-only profiles must never be used by the opportunity model.
 */
export function guideProfileFor(speciesId: string): SpeciesProfile | undefined {
  return byId[speciesId] ?? communityById[speciesId];
}

export function isGuideOnlyProfile(profile: SpeciesProfile | undefined): boolean {
  return profile?.guideOnly === true;
}

const WB_LABEL: Record<string, string> = {
  river: "rivers", stream: "streams", reservoir: "reservoirs", lake: "lakes", pond: "ponds", bay: "bays",
};

/** The water types a species most favors (preference >= 0.5), for a signature line. */
export function topWaterTypes(profile: SpeciesProfile | undefined): string {
  const pref = profile?.waterbodyPreference;
  if (!pref) return "";
  const favored = Object.entries(pref)
    .filter(([, v]) => v >= 0.5)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => WB_LABEL[k] ?? k);
  return favored.slice(0, 2).join(" & ");
}
