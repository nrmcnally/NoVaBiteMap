import dwrAccessPayload from "./generated/dwr-access-nova.json";
import nhdWatersPayload from "./generated/nhd-waters-nova.json";
import type { AccessMethod, FishingLocationSeed, WaterbodyType } from "./data";

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

export const expandedCoverageStats = {
  dwrAccessSites: dwrSites.length,
  dwrRetrieved: dwrMeta.retrieved,
  nhdParkWaters: nhdWaters.length,
  nhdRetrieved: nhdMeta.retrieved,
};
