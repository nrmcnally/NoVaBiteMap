/**
 * Imports official Virginia DWR designated stocked-trout lakes and stream
 * sections. Geometry is used only to verify an exact named-water association;
 * source coordinates are discarded. Stocking evidence never certifies public
 * access because DWR explicitly notes that some stocked sections cross private
 * land and that posted signs control.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REGION = { xmin: -78.75, ymin: 38.05, xmax: -76.95, ymax: 39.35 };
const SERVICE = "https://services.dwr.virginia.gov/arcgis/rest/services/Projects/TroutApp/MapServer";
const LAYERS = [
  { id: 0, kind: "lake-or-pond" },
  { id: 1, kind: "stream-section" },
] as const;
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
  lat: number;
  lng: number;
  aliases?: string[];
};
type Geometry = { x?: number; y?: number; points?: number[][]; paths?: number[][][]; rings?: number[][][] };
type Feature = { attributes: Record<string, unknown>; geometry?: Geometry };
type QueryResponse = { features?: Feature[]; error?: { message?: string; details?: string[] } };

const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const sql = (value: string) => `'${value.replace(/'/g, "''")}'`;
const text = (value: unknown) => typeof value === "string" ? value.trim() || null : null;
const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : null;
const presentFlag = (value: unknown) => Number(value) === 1;
const radians = (value: number) => value * Math.PI / 180;
const milesBetween = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(value));
};
const nameVariants = (value: string) => [...new Set([
  value,
  value.replace(/\bN\.\s*Fork\b/gi, "North Fork").replace(/\bS\.\s*Fork\b/gi, "South Fork"),
  ...(normalized(value) === "locust shade pond" ? ["Locust Shade Park"] : []),
])];

function minimumGeometryDistance(location: SeedLocation, geometry?: Geometry): number | null {
  if (!geometry) return null;
  const points = [
    ...(Number.isFinite(geometry.x) && Number.isFinite(geometry.y) ? [[Number(geometry.x), Number(geometry.y)]] : []),
    ...(geometry.points ?? []),
    ...(geometry.paths ?? []).flat(),
    ...(geometry.rings ?? []).flat(),
  ].filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]));
  if (points.length === 0) return null;
  return Math.min(...points.map(([lng, lat]) => milesBetween(location.lat, location.lng, lat, lng)));
}

async function queryLayer(layerId: number, names: string[]): Promise<Feature[]> {
  const features: Feature[] = [];
  for (let index = 0; index < names.length; index += BATCH_SIZE) {
    const batch = names.slice(index, index + BATCH_SIZE);
    const params = new URLSearchParams({
      f: "json",
      where: `Waterbody IN (${batch.map(sql).join(",")})`,
      geometry: `${REGION.xmin},${REGION.ymin},${REGION.xmax},${REGION.ymax}`,
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "OBJECTID,Waterbody,COUNTY,County,Notes,StockSched,Designation,RainbowTrout,BrownTrout,BrookTrout,HeritageDay,NationalForest,NoFallStock,StockingUrl,GlobalID",
      returnGeometry: "true",
      outSR: "4326",
    });
    const response = await fetch(`${SERVICE}/${layerId}/query?${params}`, {
      headers: { "user-agent": "BiteMap-NOVA/0.1 public-data-ingestion" },
    });
    if (!response.ok) throw new Error(`DWR TroutApp layer ${layerId} HTTP ${response.status}`);
    const payload = await response.json() as QueryResponse;
    if (payload.error) throw new Error([payload.error.message, ...(payload.error.details ?? [])].filter(Boolean).join(": "));
    features.push(...(payload.features ?? []));
  }
  return features;
}

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const seed = JSON.parse(readFileSync(resolve(here, "../apps/api/app/data/seed_export.json"), "utf8")) as {
    locations: SeedLocation[];
  };
  const names = [...new Set(seed.locations.flatMap((location) =>
    [location.waterbody, location.name, ...(location.aliases ?? [])].flatMap(nameVariants)
  ).map((name) => name.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  const layerFeatures = await Promise.all(LAYERS.map(async (layer) => ({
    layer,
    features: await queryLayer(layer.id, names),
  })));
  const records = layerFeatures.flatMap(({ layer, features }) => features.map(({ attributes: row, geometry }) => {
    const objectId = number(row.OBJECTID);
    const waterbody = text(row.Waterbody);
    const matches = !waterbody ? [] : seed.locations.flatMap((location) => {
      const catalogNames = [location.waterbody, location.name, ...(location.aliases ?? [])].flatMap(nameVariants);
      if (!catalogNames.some((name) => normalized(name) === normalized(waterbody))) return [];
      const distanceMiles = minimumGeometryDistance(location, geometry);
      if (distanceMiles === null) return [];
      const dwrLocationMatch = objectId !== null && location.id === `dwr-trout-${objectId}`;
      if (location.id.startsWith("dwr-trout-") && !dwrLocationMatch) return [];
      if (!dwrLocationMatch && distanceMiles > 1.25) return [];
      return [{
        locationId: location.id,
        distanceMiles: Number(distanceMiles.toFixed(2)),
        matchBasis: dwrLocationMatch ? "source-object-id" : "exact-name-and-near-section",
      }];
    }).sort((a, b) => a.distanceMiles - b.distanceMiles);
    return {
      layerId: layer.id,
      evidenceKind: layer.kind,
      objectId,
      waterbody,
      county: text(row.COUNTY) ?? text(row.County),
      designation: text(row.Designation),
      stockingSchedule: text(row.StockSched),
      speciesIds: [
        presentFlag(row.RainbowTrout) ? "rainbow-trout" : null,
        presentFlag(row.BrownTrout) ? "brown-trout" : null,
        presentFlag(row.BrookTrout) ? "brook-trout" : null,
      ].filter(Boolean),
      speciesFlags: {
        rainbow: number(row.RainbowTrout),
        brown: number(row.BrownTrout),
        brook: number(row.BrookTrout),
      },
      heritageDay: presentFlag(row.HeritageDay),
      nationalForest: presentFlag(row.NationalForest),
      noFallStocking: presentFlag(row.NoFallStock),
      notes: text(row.Notes),
      stockingUrl: text(row.StockingUrl),
      globalId: text(row.GlobalID),
      locationMatches: matches,
    };
  })).filter((record) => record.locationMatches.length > 0 && record.speciesIds.length > 0);

  const payload = {
    meta: {
      source: "Virginia DWR TroutApp - Designated Stocked Trout Waters",
      sourceUrls: LAYERS.map((layer) => `${SERVICE}/${layer.id}`),
      retrieved: localDate(),
      catalogLocationCount: seed.locations.length,
      recordCount: records.length,
      useNote: "Exact-water stocking candidates. DWR catalog records must match source object ID; other locations require exact name and <=1.25 miles to the official section. Species flags must equal numeric 1. Access and current posted restrictions require separate review.",
      sourceCaveat: "DWR states that some stocked sections are on private land and that this guide does not supersede physical signage.",
      privacyNote: "Source geometry is discarded after exact-name and within-five-mile matching.",
    },
    records,
  };
  for (const outputPath of [
    resolve(here, "../app/lib/generated/dwr-stocked-trout-nova.json"),
    resolve(here, "../apps/api/app/data/generated/dwr-stocked-trout-nova.json"),
  ]) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
  }
  console.log(`Ingested ${records.length} exact-water DWR stocked-trout records.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
