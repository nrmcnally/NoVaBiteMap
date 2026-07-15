/**
 * Imports two public DWR reach-level evidence layers for the unresolved review
 * queue: Wild Trout Streams and Anadromous Fish Use Waters. Geometry is used
 * only to associate a named feature with a nearby BiteMap location; source
 * coordinates/lines/polygons are not written to the snapshot.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REGION = { xmin: -78.75, ymin: 38.05, xmax: -76.95, ymax: 39.35 };
const SERVICES = {
  wildTrout: "https://services.dwr.virginia.gov/arcgis/rest/services/VAFWIS/Wild_Trout_Streams/FeatureServer/0/query",
  anadromous: "https://services.dwr.virginia.gov/arcgis/rest/services/VAFWIS/Anadromous_Fish_Use_Waters/FeatureServer/0/query",
};
const BATCH_SIZE = 20;
const localDate = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

type SeedLocation = {
  id: string;
  name: string;
  waterbody: string;
  waterbodyType: string;
  lat: number;
  lng: number;
  aliases?: string[];
  evidence: Array<{ evidenceType?: string; modeled?: boolean; sourceName?: string }>;
};
type Geometry = { x?: number; y?: number; paths?: number[][][]; rings?: number[][][] };
type Feature = { attributes: Record<string, unknown>; geometry?: Geometry };
type QueryResponse = { features?: Feature[]; error?: { message?: string; details?: string[] } };

const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const sql = (value: string) => `'${value.replace(/'/g, "''")}'`;
const text = (value: unknown) => typeof value === "string" ? value.trim() || null : null;
const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : null;
const date = (value: unknown) => {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp).toISOString().slice(0, 10) : null;
};
const yesFlag = (value: unknown) => text(value)?.toUpperCase() === "Y";
const modeledEvidence = (record: SeedLocation["evidence"][number]) =>
  record.evidenceType === "modeled" ||
  Boolean(record.modeled) ||
  (record.sourceName ?? "").toLowerCase().includes("aquatic gap");
const radians = (value: number) => value * Math.PI / 180;
const milesBetween = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(value));
};

function minimumGeometryDistance(location: SeedLocation, geometry?: Geometry): number | null {
  if (!geometry) return null;
  const points = [
    ...(Number.isFinite(geometry.x) && Number.isFinite(geometry.y) ? [[Number(geometry.x), Number(geometry.y)]] : []),
    ...(geometry.paths ?? []).flat(),
    ...(geometry.rings ?? []).flat(),
  ].filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]));
  if (points.length === 0) return null;
  return Math.min(...points.map(([lng, lat]) => milesBetween(location.lat, location.lng, lat, lng)));
}

async function query(url: string, nameField: string, names: string[], outFields: string): Promise<Feature[]> {
  const features: Feature[] = [];
  for (let index = 0; index < names.length; index += BATCH_SIZE) {
    const batch = names.slice(index, index + BATCH_SIZE);
    const params = new URLSearchParams({
      f: "json",
      where: `${nameField} IN (${batch.map(sql).join(",")})`,
      geometry: `${REGION.xmin},${REGION.ymin},${REGION.xmax},${REGION.ymax}`,
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields,
      returnGeometry: "true",
      outSR: "4326",
    });
    const response = await fetch(`${url}?${params}`, { headers: { "user-agent": "BiteMap-NOVA/0.1 public-data-ingestion" } });
    if (!response.ok) throw new Error(`DWR layer HTTP ${response.status}`);
    const payload = await response.json() as QueryResponse;
    if (payload.error) throw new Error([payload.error.message, ...(payload.error.details ?? [])].filter(Boolean).join(": "));
    features.push(...(payload.features ?? []));
  }
  return features;
}

function locationMatches(locations: SeedLocation[], featureName: string | null, geometry?: Geometry) {
  if (!featureName) return [];
  return locations.flatMap((location) => {
    const exactName = [location.waterbody, location.name, ...(location.aliases ?? [])]
      .some((name) => normalized(name) === normalized(featureName));
    if (!exactName) return [];
    const distanceMiles = minimumGeometryDistance(location, geometry);
    if (distanceMiles === null || distanceMiles > 5) return [];
    return [{ locationId: location.id, distanceMiles: Number(distanceMiles.toFixed(2)) }];
  }).sort((a, b) => a.distanceMiles - b.distanceMiles);
}

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const seed = JSON.parse(readFileSync(resolve(here, "../apps/api/app/data/seed_export.json"), "utf8")) as { locations: SeedLocation[] };
  const researchLocations = seed.locations.filter((location) =>
    !location.evidence.some((record) => !modeledEvidence(record))
  );
  const names = [...new Set(researchLocations.flatMap((location) =>
    [location.waterbody, location.name, ...(location.aliases ?? [])].map((name) => name.trim()).filter(Boolean)
  ))].sort((a, b) => a.localeCompare(b));

  const [wildFeatures, anadromousFeatures] = await Promise.all([
    query(SERVICES.wildTrout, "NAME", names, "OBJECTID_12,OBJECTID,BROOK,BROWN,RAINBOW,REACHCODE,NAME,STREAMCODE,CLASS,TYPE,GlobalID"),
    query(SERVICES.anadromous, "Name", names, "OBJECTID,UniqueID,UpBound,Status,Name,BOVA,SpeciesAbbrev,GENUS,SPECIES,COMMON_NAME,MajorDrain,GlobalID,last_edited_date"),
  ]);

  const wildTrout = wildFeatures.map(({ attributes: row, geometry }) => {
    const name = text(row.NAME);
    return {
      objectId: number(row.OBJECTID_12) ?? number(row.OBJECTID),
      name,
      speciesIds: [
        yesFlag(row.BROOK) ? "brook-trout" : null,
        yesFlag(row.BROWN) ? "brown-trout" : null,
        yesFlag(row.RAINBOW) ? "rainbow-trout" : null,
      ].filter(Boolean),
      speciesFlags: {
        brook: text(row.BROOK),
        brown: text(row.BROWN),
        rainbow: text(row.RAINBOW),
      },
      reachCode: text(row.REACHCODE),
      streamCode: text(row.STREAMCODE),
      classification: text(row.CLASS),
      type: text(row.TYPE),
      globalId: text(row.GlobalID),
      locationMatches: locationMatches(researchLocations, name, geometry),
    };
  }).filter((record) => record.locationMatches.length > 0 && record.speciesIds.length > 0);

  const anadromous = anadromousFeatures.map(({ attributes: row, geometry }) => {
    const name = text(row.Name);
    return {
      objectId: number(row.OBJECTID),
      uniqueId: text(row.UniqueID),
      name,
      upperBoundary: text(row.UpBound),
      status: text(row.Status),
      scientificName: [text(row.GENUS), text(row.SPECIES)].filter(Boolean).join(" ") || null,
      commonName: text(row.COMMON_NAME),
      majorDrainage: text(row.MajorDrain),
      globalId: text(row.GlobalID),
      lastEdited: date(row.last_edited_date),
      locationMatches: locationMatches(researchLocations, name, geometry),
    };
  }).filter((record) => record.locationMatches.length > 0);

  const payload = {
    meta: {
      retrieved: localDate(),
      targetLocationCount: researchLocations.length,
      sourceUrls: {
        wildTrout: SERVICES.wildTrout.replace(/\/query$/, ""),
        anadromous: SERVICES.anadromous.replace(/\/query$/, ""),
      },
      useNote: "Reach-level candidates only; each still requires contradiction and access review before promotion.",
      privacyNote: "Source geometry is discarded after a within-five-mile exact-name association.",
    },
    wildTrout,
    anadromous,
  };
  for (const outputPath of [
    resolve(here, "../app/lib/generated/dwr-fish-habitats-nova.json"),
    resolve(here, "../apps/api/app/data/generated/dwr-fish-habitats-nova.json"),
  ]) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
  }
  console.log(`Ingested ${wildTrout.length} wild-trout reaches and ${anadromous.length} anadromous-use records.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
