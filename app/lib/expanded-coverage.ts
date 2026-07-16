import dwrAccessPayload from "./generated/dwr-access-nova.json";
import nhdWatersPayload from "./generated/nhd-waters-nova.json";
import nhdStreamsPayload from "./generated/nhd-streams-nova.json";
import waterbodySpeciesPayload from "./generated/waterbody-species-nova.json";
import likelyPresentPayload from "./generated/likely-present-nova.json";
import promotedEvidencePayload from "./generated/promoted-evidence-nova.json";
import waterbodyCommunityPayload from "./generated/waterbody-community-nova.json";
import type { AccessMethod, FishingLocationSeed, SpeciesEvidence, WaterbodyType } from "./data";

type DwrAccessSite = {
  objectId: number;
  name: string;
  waterbody: string;
  waterbodyType: string;
  county: string;
  latitude: number;
  longitude: number;
  access: string[];
  ramps: number;
  accessArea: string | null;
};

const dwrSites = dwrAccessPayload.sites as DwrAccessSite[];
const dwrMeta = dwrAccessPayload.meta;

const radians = (value: number) => (value * Math.PI) / 180;

export function milesBetween(lat1: number, lon1: number, lat2: number, lon2: number) {
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(value));
}

const defaultOrigin = { lat: 38.8462, lng: -77.3064 };

function defaultTravel(latitude: number, longitude: number) {
  const miles = milesBetween(defaultOrigin.lat, defaultOrigin.lng, latitude, longitude);
  return {
    distanceMiles: Math.round(miles),
    travelMinutes: Math.max(10, Math.round(10 + miles * 1.35)),
  };
}

const slug = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// Order-independent word key so "Burke Lake" == "Lake Burke", ignoring generic
// suffixes like Park/Access that vary between an access point and the water.
const STOP = new Set(["park", "access", "landing", "regional", "the", "on", "at"]);
const wordKey = (value: string) =>
  [...new Set(value.toLowerCase().replace(/[^a-z0-9\s]+/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w)))]
    .sort()
    .join(" ");

type ExistingPoint = { id: string; name: string; lat: number; lng: number; waterbody: string };

// A new site is a duplicate of an existing one if it's very close (same access
// area) or clearly the same access point on the same waterbody nearby.
function isDuplicate(site: DwrAccessSite, existing: ExistingPoint[]): boolean {
  const siteName = slug(site.name);
  return existing.some((point) => {
    const distance = milesBetween(site.latitude, site.longitude, point.lat, point.lng);
    if (distance <= 0.3) return true;
    if (distance <= 0.75 && slug(point.name) === siteName) return true;
    return false;
  });
}

/**
 * DWR boating-access sites not already represented in the curated dataset,
 * as access-verified public locations. Aquatic-GAP evidence is layered on in
 * data.ts for river/stream types just like every other location.
 */
export function dwrAccessLocations(existing: ExistingPoint[]): FishingLocationSeed[] {
  const seen = new Set(existing.map((point) => slug(point.name)));
  const results: FishingLocationSeed[] = [];
  for (const site of dwrSites) {
    if (isDuplicate(site, existing)) continue;
    const id = `dwr-boat-${site.objectId}`;
    const nameSlug = slug(site.name);
    if (seen.has(nameSlug)) continue; // avoid two DWR sites collapsing to one id-name
    seen.add(nameSlug);
    const travel = defaultTravel(site.latitude, site.longitude);
    const isFlowing = site.waterbodyType === "river" || site.waterbodyType === "stream";
    results.push({
      id,
      name: site.name,
      waterbody: site.waterbody,
      waterbodyType: site.waterbodyType as WaterbodyType,
      county: site.county,
      lat: site.latitude,
      lng: site.longitude,
      ...travel,
      publicAccess: true,
      access: site.access as AccessMethod[],
      aliases: [site.name],
      notice:
        "Virginia DWR maintains this public boating/fishing access. Verify current ramp rules, hours, parking, launch fees, and posted conditions before departure.",
      flowStatus: isFlowing ? "Representative gage not yet verified" : "Live water data unavailable",
      activityEstimate: 0.5,
      accessFit: site.ramps > 0 ? 0.82 : 0.78,
      bestWindow: "Unavailable",
      evidence: [],
      accessAuthority: "Virginia Department of Wildlife Resources",
      accessSourceUrl: dwrMeta.sourceUrl,
      sourceReviewed: dwrMeta.retrieved,
      accessStatus: "verified",
    });
  }
  return results;
}

type NhdWater = {
  permanentId: string;
  name: string;
  waterbodyType: string;
  county: string;
  latitude: number;
  longitude: number;
  areaAcres: number;
  park: string;
};

const nhdWaters = nhdWatersPayload.waters as NhdWater[];
const nhdMeta = nhdWatersPayload.meta;

/**
 * Named public waters (USGS NHD) whose centroid falls inside a public park/forest,
 * as access-"listed" locations. Public land = publicly fishable subject to park
 * rules, but BiteMap hasn't pinpointed the exact access point — hence "listed", a
 * discovery entry, not a verified access point. Private lakes were already excluded
 * at ingest time (spatial join), so nothing here is private property.
 */
export function nhdParkWaterLocations(existing: ExistingPoint[]): FishingLocationSeed[] {
  const seen = new Set(existing.map((point) => slug(point.name)));
  const results: FishingLocationSeed[] = [];
  for (const water of nhdWaters) {
    if (isDuplicateWater(water, existing)) continue;
    const nameSlug = slug(water.name);
    if (seen.has(nameSlug)) continue;
    seen.add(nameSlug);
    const travel = defaultTravel(water.latitude, water.longitude);
    results.push({
      id: `nhd-${nameSlug}`,
      name: water.name,
      waterbody: water.name,
      waterbodyType: water.waterbodyType as WaterbodyType,
      county: water.county,
      lat: water.latitude,
      lng: water.longitude,
      ...travel,
      publicAccess: true,
      access: ["shore"],
      aliases: [water.name],
      notice: `This named public water (~${water.areaAcres} acres) sits within ${water.park}. BiteMap has not pinpointed a designated fishing access point or confirmed that fishing is permitted here — verify park rules, access, and parking before you go.`,
      flowStatus: "Live water data unavailable",
      activityEstimate: 0.5,
      accessFit: 0.68,
      bestWindow: "Unavailable",
      evidence: [],
      accessAuthority: water.park,
      accessSourceUrl: nhdMeta.nhdUrl,
      sourceReviewed: nhdMeta.retrieved,
      accessStatus: "listed",
    });
  }
  return results;
}

function isDuplicateWater(water: NhdWater, existing: ExistingPoint[]): boolean {
  const nameKey = wordKey(water.name);
  return existing.some((point) => {
    const distance = milesBetween(water.latitude, water.longitude, point.lat, point.lng);
    if (distance <= 0.3) return true;
    // Same water (order-independent name) within ~1.5 mi = a lake whose NHD
    // centroid differs from its curated access point.
    if (distance <= 1.5 && nameKey && (wordKey(point.waterbody) === nameKey || wordKey(point.name) === nameKey)) {
      return true;
    }
    return false;
  });
}

// ---------------------------------------------------------------------------
// Named public-park streams (NHD flowlines × parks)
// ---------------------------------------------------------------------------
type NhdStream = { name: string; lat: number; lng: number; county: string; park: string };
const nhdStreams = nhdStreamsPayload.streams as NhdStream[];
const streamMeta = nhdStreamsPayload.meta;

export function nhdStreamLocations(existing: ExistingPoint[]): FishingLocationSeed[] {
  const seen = new Set(existing.map((point) => slug(point.name)));
  const results: FishingLocationSeed[] = [];
  for (const stream of nhdStreams) {
    const nameSlug = slug(stream.name);
    if (seen.has(nameSlug)) continue;
    const near = existing.some((point) => {
      const distance = milesBetween(stream.lat, stream.lng, point.lat, point.lng);
      return distance <= 0.3 || (distance <= 1.5 && wordKey(point.waterbody) === wordKey(stream.name));
    });
    if (near) continue;
    seen.add(nameSlug);
    const travel = defaultTravel(stream.lat, stream.lng);
    results.push({
      id: `nhd-stream-${nameSlug}`,
      name: stream.name,
      waterbody: stream.name,
      waterbodyType: "stream",
      county: stream.county,
      lat: stream.lat,
      lng: stream.lng,
      ...travel,
      publicAccess: true,
      access: ["shore", "wade"],
      aliases: [stream.name],
      notice: `${stream.name} crosses ${stream.park}. BiteMap has not pinpointed a designated fishing access point or confirmed fishing rules — verify park regulations, posted access, and parking before you go.`,
      flowStatus: "Representative gage not yet verified",
      activityEstimate: 0.5,
      accessFit: 0.66,
      bestWindow: "Unavailable",
      evidence: [],
      accessAuthority: stream.park,
      accessSourceUrl: streamMeta.nhdUrl,
      sourceReviewed: streamMeta.retrieved,
      accessStatus: "listed",
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Waterbody-level species evidence (DWR/agency documentation)
// ---------------------------------------------------------------------------
type WaterbodyRecord = {
  speciesId: string;
  availability: number;
  quality: number | null;
  evidenceConfidence: number;
  summary: string;
  strengthNote: string | null;
  sourceUrl: string;
};
const wbPayload = waterbodySpeciesPayload as {
  meta: { retrieved: string };
  byKey?: Record<string, WaterbodyRecord[]>;
  byWaterbody?: Record<string, WaterbodyRecord[]>;
  waters?: Record<string, WaterbodyRecord[]>;
};
// byKey holds assemblages that need custom matching (Potomac tidal split, etc.);
// byWaterbody holds per-named-water DWR communities matched by waterbody name.
const waterbodyByKey = wbPayload.byKey ?? wbPayload.waters ?? {};
const waterbodyByName = wbPayload.byWaterbody ?? {};
const wbMeta = wbPayload.meta;

const normalizeWb = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const byNameNorm: Record<string, WaterbodyRecord[]> = Object.fromEntries(
  Object.entries(waterbodyByName).map(([name, records]) => [normalizeWb(name), records]),
);

function sourceName(url: string): string {
  if (url.includes("dwr.virginia.gov")) return "Virginia Department of Wildlife Resources";
  if (url.includes("dnr.maryland.gov")) return "Maryland Department of Natural Resources";
  if (url.includes("nps.gov")) return "National Park Service";
  return "State fisheries agency";
}

// Special assemblages (geographic / multi-name) that aren't a simple name match.
function specialWaterbodyKey(location: Pick<FishingLocationSeed, "waterbody" | "lat">): string | null {
  const wb = location.waterbody.toLowerCase();
  if (wb.includes("occoquan reservoir")) return "occoquan-reservoir";
  if (wb.includes("pohick bay") || wb.includes("belmont bay")) return "pohick-belmont-bay";
  if (wb.includes("beaverdam reservoir")) return "beaverdam-reservoir";
  if (wb.includes("potomac")) return location.lat >= 38.95 ? "nontidal-potomac" : "tidal-potomac";
  return null;
}

/**
 * Documented-waterbody species evidence for a location, as shared-waterbody
 * official listings (DWR/MD DNR/NPS). Combines the special geographic
 * assemblages with the per-named-water DWR community, deduped by species
 * (highest-availability record wins). Caveated as a waterbody listing, not an
 * angler report at the specific access point.
 */
export function waterbodySpeciesFor(location: Pick<FishingLocationSeed, "waterbody" | "lat" | "name">): SpeciesEvidence[] {
  const records: WaterbodyRecord[] = [];
  const key = specialWaterbodyKey(location);
  if (key && waterbodyByKey[key]) records.push(...waterbodyByKey[key]);
  // Match by waterbody, and by the location's display name too (some waters have
  // a different official waterbody name, e.g. Lake Frederick = "Wheatlands Lake").
  const named = byNameNorm[normalizeWb(location.waterbody)] || (location.name ? byNameNorm[normalizeWb(location.name)] : undefined);
  if (named) records.push(...named);
  if (records.length === 0) return [];

  const bySpecies = new Map<string, WaterbodyRecord>();
  for (const record of records) {
    const current = bySpecies.get(record.speciesId);
    if (!current || record.availability > current.availability) bySpecies.set(record.speciesId, record);
  }
  return [...bySpecies.values()].map((record) => ({
    speciesId: record.speciesId,
    availability: record.availability,
    quality: record.quality,
    evidenceConfidence: record.evidenceConfidence,
    evidenceType: "official listing" as const,
    evidenceSummary: record.summary,
    lastEvidence: `Agency waterbody documentation reviewed ${wbMeta.retrieved}`,
    technique: "Match presentation to the species, season, and current conditions",
    depth: "Work accessible cover and structure first, then probe the first depth change",
    positive: [record.summary, ...(record.strengthNote ? [record.strengthNote] : [])],
    negative: ["Evidence is the documented waterbody listing, not an angler report at this specific access point"],
    sourceName: sourceName(record.sourceUrl),
    sourceUrl: record.sourceUrl,
  }));
}

// ---------------------------------------------------------------------------
// Likely-present evidence — replaces the retired county/basin stereotype with
// honest, cited inference for waters that have no direct documentation. Three
// real mechanisms, generated deterministically (scripts/generate-likely-present.mjs)
// from USGS data — never a "typical for the region" guess:
//   1. same-waterbody  — this access point sits ON a documented river/water.
//   2. connectivity    — a warmwater sportfish is documented <=5 mi downstream in
//                        a connected water (USGS NLDI river network trace).
//   3. subwatershed    — recorded at surveyed reaches in the same HUC12 (Aquatic GAP).
// All flagged modeled, lower availability/confidence, and each carries its basis.
// ---------------------------------------------------------------------------
type LikelySpecies = { id: string; sourceName: string; sourceUrl: string | null };
type LikelyWater = {
  sameWaterbody: { waterbody: string; species: LikelySpecies[] } | null;
  connectivity: { water: string; downstreamMi: number; species: LikelySpecies[] }[];
  subwatershed: { huc12: string; sampleCount: number; sources: string[]; species: { id: string; count: number; nonGame: boolean }[] } | null;
};
const likelyByLocation = (likelyPresentPayload as { waters: Record<string, LikelyWater> }).waters;
const niceName = (id: string) => id.replace(/-/g, " ");

function likelyRecord(
  speciesId: string, availability: number, confidence: number,
  summary: string, positive: string, sourceName: string, sourceUrl: string | null,
): SpeciesEvidence {
  return {
    speciesId,
    availability,
    quality: null,
    evidenceConfidence: confidence,
    evidenceType: "modeled",
    evidenceSummary: summary,
    lastEvidence: "Likely-present model (USGS NLDI river network + USGS Aquatic GAP)",
    technique: "Match a compact natural presentation to the visible current, cover, and depth",
    depth: "Work accessible current breaks, pools, and cover first",
    positive: [positive],
    negative: ["Modeled inference for this specific water, not a survey of it"],
    sourceName,
    sourceUrl: sourceUrl ?? undefined,
    modeled: true,
  } as SpeciesEvidence;
}

export function likelyPresentFor(location: Pick<FishingLocationSeed, "id">): SpeciesEvidence[] {
  const w = likelyByLocation[location.id];
  if (!w) return [];
  const bySpecies = new Map<string, SpeciesEvidence>();
  // Strongest first: same-waterbody wins over connectivity wins over subwatershed.
  if (w.sameWaterbody) {
    for (const s of w.sameWaterbody.species) {
      if (!bySpecies.has(s.id)) bySpecies.set(s.id, likelyRecord(s.id, 0.55, 0.6,
        `Documented in ${w.sameWaterbody.waterbody} — the same water this access point sits on.`,
        `${niceName(s.id)} is documented in ${w.sameWaterbody.waterbody}`, s.sourceName, s.sourceUrl));
    }
  }
  for (const c of w.connectivity) {
    for (const s of c.species) {
      if (!bySpecies.has(s.id)) bySpecies.set(s.id, likelyRecord(s.id, 0.45, 0.5,
        `Likely present — ${niceName(s.id)} is documented ${c.downstreamMi} mi downstream in the connected ${c.water}.`,
        `${niceName(s.id)} documented ${c.downstreamMi} mi downstream in the connected ${c.water}`, s.sourceName, s.sourceUrl));
    }
  }
  if (w.subwatershed) {
    const src = w.subwatershed.sources.join(", ") || "public fisheries surveys";
    for (const s of w.subwatershed.species) {
      if (!bySpecies.has(s.id)) bySpecies.set(s.id, likelyRecord(s.id, s.nonGame ? 0.4 : 0.42, 0.48,
        `Recorded at ${w.subwatershed.sampleCount} surveyed reach${w.subwatershed.sampleCount === 1 ? "" : "es"} in this subwatershed (USGS Aquatic GAP).`,
        `${niceName(s.id)} recorded in this subwatershed by ${src}`,
        "USGS Aquatic GAP presence/absence database", "https://doi.org/10.5066/P9FZ6J6R"));
    }
  }
  return [...bySpecies.values()];
}

// ---------------------------------------------------------------------------
// Promoted agency evidence — approved candidates from the fish-community review
// pipeline (e.g. DWR Wild Trout Streams reaches), emitted by
// scripts/build-promoted-evidence.mjs only for objectIds the verdict file has
// approved. Real documented evidence: gives the region's native brook-trout
// tributaries a cited fishery. The review --check treats these as corroborated.
// ---------------------------------------------------------------------------
const promotedByLocation = (promotedEvidencePayload as { byLocation: Record<string, SpeciesEvidence[]> }).byLocation;

export function promotedEvidenceFor(locationId: string): SpeciesEvidence[] {
  return (promotedByLocation[locationId] ?? []) as SpeciesEvidence[];
}

// ---------------------------------------------------------------------------
// Same-waterbody community (#3: no species overlooked). Access points on one river/
// reservoir share that water's documented fish; this fills the species a given point
// is missing, from scripts/build-waterbody-community.mjs. Labeled as the shared-water
// listing, not an exact-point survey; only direct agency evidence ever propagates.
// ---------------------------------------------------------------------------
type WbCommunity = { waterbody: string; species: { speciesId: string; availability: number; quality: number | null; evidenceType: string; sourceName: string | null; sourceUrl: string | null }[] };
const wbCommunity = (waterbodyCommunityPayload as { byWaterbody: Record<string, WbCommunity> }).byWaterbody;
const normWbKey = (w: string) => (w || "").toLowerCase()
  .replace(/\bn\.?\s+fork\b/g, "north fork").replace(/\bs\.?\s+fork\b/g, "south fork")
  .replace(/\be\.?\s+fork\b/g, "east fork").replace(/\bw\.?\s+fork\b/g, "west fork")
  .replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();

export function waterbodyCommunityFor(location: Pick<FishingLocationSeed, "waterbody">): SpeciesEvidence[] {
  const community = wbCommunity[normWbKey(location.waterbody)];
  if (!community) return [];
  return community.species.map((s) => ({
    speciesId: s.speciesId,
    availability: Math.round((s.availability ?? 0.5) * 0.9 * 100) / 100,
    quality: s.quality ?? null,
    evidenceConfidence: 0.72,
    // Modeled for THIS point: the species is agency-documented in the shared water,
    // inferred present at this access point on it (not a survey of the exact point).
    evidenceType: "modeled" as const,
    modeled: true,
    evidenceSummary: `Documented in ${community.waterbody} — the shared water this access point sits on (not a survey at this exact point).`,
    lastEvidence: "Shared-waterbody community listing",
    technique: "Match presentation to the species, season, and current conditions",
    depth: "Work accessible cover and structure first, then probe the first depth change",
    positive: [`${s.speciesId.replace(/-/g, " ")} is documented in ${community.waterbody}`],
    negative: ["Evidence is the shared-water listing, not a survey at this exact access point"],
    sourceName: s.sourceName ?? undefined,
    sourceUrl: s.sourceUrl ?? undefined,
  }));
}

// ---------------------------------------------------------------------------
// FCPA "watershed-typical" tier. The Fairfax County Park Authority "Parks with
// Small Lakes" page describes the Pohick Watershed lakes as holding "a standard mix
// of bass, sunfish, crappie, carp and catfish." For the Pohick lakes with no
// lake-specific survey anywhere, surface that agency statement as a clearly-labeled,
// modeled, group-mapped tier — never presented as a survey of the specific lake.
// (Royal Lake is excluded: its documented record is a fish-save that relocated fish
// OUT, and those species are in the rejection ledger.)
// ---------------------------------------------------------------------------
const POHICK_FCPA_LAKES = new Set(["lake-mercer", "woodglen-lake"]);
const FCPA_SMALL_LAKES_URL = "https://www.fairfaxcounty.gov/parks/small-lakes";
const FCPA_TYPICAL: Array<{ group: string; speciesId: string }> = [
  { group: "bass", speciesId: "largemouth-bass" },
  { group: "sunfish", speciesId: "bluegill" },
  { group: "crappie", speciesId: "black-crappie" },
  { group: "carp", speciesId: "common-carp" },
  { group: "catfish", speciesId: "channel-catfish" },
];

export function fcpaWatershedTypicalFor(location: Pick<FishingLocationSeed, "id" | "name">): SpeciesEvidence[] {
  if (!POHICK_FCPA_LAKES.has(location.id)) return [];
  return FCPA_TYPICAL.map(({ group, speciesId }) => ({
    speciesId,
    availability: 0.42,
    quality: null,
    evidenceConfidence: 0.5,
    evidenceType: "modeled" as const,
    modeled: true,
    evidenceSummary: `Watershed-typical — Fairfax County Park Authority describes the Pohick Watershed lakes as holding "a standard mix of bass, sunfish, crappie, carp and catfish." Not a survey of ${location.name} specifically.`,
    lastEvidence: "FCPA Parks with Small Lakes (watershed-typical characterization)",
    technique: "Work shoreline cover and the first depth change with a compact natural presentation",
    depth: "Shoreline cover early, then the first drop-off",
    positive: [`FCPA describes ${group} among the Pohick Watershed lakes' standard mix`],
    negative: [
      `FCPA names the group ("${group}"), not the exact species — the standard Fairfax county-lake species is shown`,
      "A watershed-level characterization, not a survey of this specific lake",
    ],
    sourceName: "Fairfax County Park Authority",
    sourceUrl: FCPA_SMALL_LAKES_URL,
  } as SpeciesEvidence));
}

export const expandedCoverageStats = {
  dwrAccessSites: dwrSites.length,
  dwrRetrieved: dwrMeta.retrieved,
  nhdParkWaters: nhdWaters.length,
  nhdRetrieved: nhdMeta.retrieved,
  nhdStreams: nhdStreams.length,
  waterbodySpeciesWaters: Object.keys(waterbodyByKey).length + Object.keys(waterbodyByName).length,
};
