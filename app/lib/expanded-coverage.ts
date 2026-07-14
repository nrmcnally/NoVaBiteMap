import dwrAccessPayload from "./generated/dwr-access-nova.json";
import nhdWatersPayload from "./generated/nhd-waters-nova.json";
import nhdStreamsPayload from "./generated/nhd-streams-nova.json";
import waterbodySpeciesPayload from "./generated/waterbody-species-nova.json";
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
// Basin inference — last-resort, clearly-labeled evidence for waters with no
// agency documentation (small streams, small park ponds). A tributary of a
// documented smallmouth river very likely holds smallmouth + redbreast; a public
// park pond very likely holds largemouth + bluegill. These are INFERENCES, not
// surveys: flagged modeled, low availability/confidence, and only applied when a
// water has no documented evidence at all.
// ---------------------------------------------------------------------------
const SHENANDOAH_COUNTIES = new Set(["Page", "Warren", "Shenandoah", "Clarke", "Frederick", "Rockingham"]);
const RAPPAHANNOCK_COUNTIES = new Set(["Culpeper", "Madison", "Rappahannock", "Orange", "Spotsylvania", "King George", "Fredericksburg", "Fauquier"]);
const SHEN_URL = "https://dwr.virginia.gov/blog/five-great-places-in-the-northern-shenandoah-valley-to-fish-after-work/";
const RAPP_URL = "https://dwr.virginia.gov/waterbody/rappahannock-river-upper/";
const POTOMAC_SMB_URL = "https://dwr.virginia.gov/blog/10-top-virginia-fishing-waters-rivers/";
const TIDAL_URL = "https://dwr.virginia.gov/blog/tidal-river-curious-focus-on-these-four-habitats/";
const POND_URL = "https://www.fairfaxcounty.gov/parks/fishing";

function inferredRecord(speciesId: string, basinLabel: string, waterName: string, sourceUrl: string): SpeciesEvidence {
  return {
    speciesId,
    availability: 0.44,
    quality: null,
    evidenceConfidence: 0.5,
    evidenceType: "modeled",
    evidenceSummary: `Inferred from the documented ${basinLabel}; BiteMap has no survey of ${waterName} specifically.`,
    lastEvidence: "Basin inference (connected drainage), 2026-07-14",
    technique: "Match a compact natural presentation to the visible current, cover, and depth",
    depth: "Work accessible current breaks, pools, and cover first",
    positive: [`${speciesId.replace(/-/g, " ")} is documented in the connected ${basinLabel}`],
    negative: [
      "This is a basin inference, not a survey of this specific water",
      "Small headwater streams and ponds may not hold every basin species",
    ],
    sourceName: "Virginia Department of Wildlife Resources",
    sourceUrl,
    modeled: true,
  } as SpeciesEvidence;
}

export function inferredEvidenceFor(
  location: Pick<FishingLocationSeed, "waterbody" | "waterbodyType" | "county" | "lng" | "name">,
): SpeciesEvidence[] {
  const name = location.name;
  if (location.waterbodyType === "stream" || location.waterbodyType === "river") {
    let label = "Occoquan/Piedmont tributary fishery";
    let species = ["smallmouth-bass", "redbreast-sunfish"];
    let url = POTOMAC_SMB_URL;
    if (SHENANDOAH_COUNTIES.has(location.county)) {
      label = "Shenandoah River smallmouth fishery"; url = SHEN_URL;
    } else if (RAPPAHANNOCK_COUNTIES.has(location.county)) {
      label = "Rappahannock River smallmouth fishery"; url = RAPP_URL;
    } else if (location.lng > -77.15) {
      // Eastern/tidal NOVA creeks are warmwater, not smallmouth.
      label = "tidal Potomac tributary fishery"; species = ["largemouth-bass", "bluegill", "redbreast-sunfish"]; url = TIDAL_URL;
    }
    return species.map((s) => inferredRecord(s, label, name, url));
  }
  if (["lake", "pond", "reservoir", "bay"].includes(location.waterbodyType)) {
    return ["largemouth-bass", "bluegill"].map((s) =>
      inferredRecord(s, "warmwater fishery typical of the region's public impoundments and embayments", name, POND_URL),
    );
  }
  return [];
}

export const expandedCoverageStats = {
  dwrAccessSites: dwrSites.length,
  dwrRetrieved: dwrMeta.retrieved,
  nhdParkWaters: nhdWaters.length,
  nhdRetrieved: nhdMeta.retrieved,
  nhdStreams: nhdStreams.length,
  waterbodySpeciesWaters: Object.keys(waterbodyByKey).length + Object.keys(waterbodyByName).length,
};
