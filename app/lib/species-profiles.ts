import profilesPayload from "./generated/species-profiles.json";

export type SpeciesProfile = {
  speciesId: string;
  family?: string;
  nativeStatus?: "native" | "introduced" | "invasive";
  statusNote?: string;
  typicalMinInches?: number;
  typicalMaxInches?: number;
  citationLengthInches?: number | null;
  waterbodyPreference?: Record<string, number>;
  seasonalActivityByMonth?: number[];
  dielPattern?: string;
};

const byId: Record<string, SpeciesProfile> = Object.fromEntries(
  ((profilesPayload.profiles as SpeciesProfile[]) ?? []).map((p) => [p.speciesId, p]),
);

export function profileFor(speciesId: string): SpeciesProfile | undefined {
  return byId[speciesId];
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
