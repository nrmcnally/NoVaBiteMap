/**
 * Downloads public Virginia DWR VAFWIS fish-observation records intersecting
 * BiteMap NOVA's Phase 1 region. The snapshot intentionally omits geometry:
 * exact coordinates for sensitive records are unnecessary for waterbody-level
 * evidence review, and a named-water match must still pass human review before
 * it can affect rankings.
 *
 *   npx tsx scripts/ingest-vafwis-fish-observations.mts
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const LAYER =
  "https://services.dwr.virginia.gov/arcgis/rest/services/VAFWIS/Species_Observations_All_Distrib/FeatureServer/0/query";
const REGION = { xmin: -78.75, ymin: 38.05, xmax: -76.95, ymax: 39.35 };
const PAGE_SIZE = 2_000;
const QUERY_BATCH_SIZE = 20;
const localDate = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const OUT_FIELDS = [
  "SppObsID",
  "ObsID",
  "SppBova",
  "GENUS",
  "SPECIES",
  "COMMON_NAME",
  "Count",
  "Cond",
  "Disp",
  "FeatID",
  "FeatType",
  "ObsDate",
  "Observer",
  "ObserverTypeDesc",
  "Waterbody",
  "LocDescription",
  "TargetSpp",
  "Exclude",
  "DB_Description",
  "Comments",
  "SourceDB",
  "SourceDB_ID",
  "Last_Updated_Date",
  "txtFeatID",
].join(",");

type ArcGeometry = { x?: number; y?: number; points?: number[][]; paths?: number[][][]; rings?: number[][][] };
type ArcFeature = { attributes: Record<string, unknown>; geometry?: ArcGeometry };
type ArcResponse = {
  features?: ArcFeature[];
  exceededTransferLimit?: boolean;
  error?: { message?: string; details?: string[] };
};

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

const text = (value: unknown) => typeof value === "string" ? value.trim() || null : null;
const integer = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : null;
const date = (value: unknown) => {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0
    ? new Date(timestamp).toISOString().slice(0, 10)
    : null;
};
const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const nameVariants = (value: string) => [...new Set([
  value,
  value.replace(/\bN\.\s*Fork\b/gi, "North Fork").replace(/\bS\.\s*Fork\b/gi, "South Fork"),
])];
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

function representativePoint(geometry?: ArcGeometry): { lat: number; lng: number } | null {
  if (!geometry) return null;
  if (Number.isFinite(geometry.x) && Number.isFinite(geometry.y)) {
    return { lng: Number(geometry.x), lat: Number(geometry.y) };
  }
  const points = [
    ...(geometry.points ?? []),
    ...(geometry.paths ?? []).flat(),
    ...(geometry.rings ?? []).flat(),
  ].filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]));
  if (points.length === 0) return null;
  const bounds = points.reduce((result, [lng, lat]) => ({
    minLng: Math.min(result.minLng, lng),
    maxLng: Math.max(result.maxLng, lng),
    minLat: Math.min(result.minLat, lat),
    maxLat: Math.max(result.maxLat, lat),
  }), { minLng: Infinity, maxLng: -Infinity, minLat: Infinity, maxLat: -Infinity });
  return { lat: (bounds.minLat + bounds.maxLat) / 2, lng: (bounds.minLng + bounds.maxLng) / 2 };
}

const sql = (value: string) => `'${value.replace(/'/g, "''")}'`;

async function fetchPage(waterbodyNames: string[], offset: number): Promise<ArcResponse> {
  const params = new URLSearchParams({
    f: "json",
    where: `TaxaGrp = 'Fish' AND Waterbody IN (${waterbodyNames.map(sql).join(",")})`,
    geometry: `${REGION.xmin},${REGION.ymin},${REGION.xmax},${REGION.ymax}`,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: OUT_FIELDS,
    returnGeometry: "true",
    outSR: "4326",
    orderByFields: "SppObsID",
    resultOffset: String(offset),
    resultRecordCount: String(PAGE_SIZE),
  });
  const response = await fetch(`${LAYER}?${params}`, {
    headers: { "user-agent": "BiteMap-NOVA/0.1 public-data-ingestion" },
  });
  if (!response.ok) throw new Error(`VAFWIS layer HTTP ${response.status}`);
  const payload = await response.json() as ArcResponse;
  if (payload.error) {
    throw new Error([payload.error.message, ...(payload.error.details ?? [])].filter(Boolean).join(": "));
  }
  return payload;
}

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const seedPath = resolve(here, "../apps/api/app/data/seed_export.json");
  const seed = JSON.parse(readFileSync(seedPath, "utf8")) as { locations: SeedLocation[] };
  const researchLocations = seed.locations.filter((location) =>
    !location.evidence.some((record) => !modeledEvidence(record))
  );
  const targetWaterbodyNames = [...new Set(researchLocations.flatMap((location) =>
    [location.waterbody, location.name, ...(location.aliases ?? [])]
      .flatMap(nameVariants)
      .map((name) => name.trim())
      .filter(Boolean)
  ))].sort((a, b) => a.localeCompare(b));

  const features: ArcFeature[] = [];
  for (let index = 0; index < targetWaterbodyNames.length; index += QUERY_BATCH_SIZE) {
    const batch = targetWaterbodyNames.slice(index, index + QUERY_BATCH_SIZE);
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const page = await fetchPage(batch, offset);
      const rows = page.features ?? [];
      features.push(...rows);
      if (rows.length < PAGE_SIZE && !page.exceededTransferLimit) break;
      if (rows.length === 0) break;
    }
  }

  const observations = features.map(({ attributes: row, geometry }) => {
    const point = representativePoint(geometry);
    const waterbody = text(row.Waterbody);
    const locationMatches = !point || !waterbody ? [] : researchLocations
      .filter((location) =>
        [location.waterbody, location.name, ...(location.aliases ?? [])]
          .flatMap(nameVariants)
          .some((name) => normalized(name) === normalized(waterbody))
      )
      .map((location) => ({
        locationId: location.id,
        distanceMiles: milesBetween(location.lat, location.lng, point.lat, point.lng),
        thresholdMiles: location.waterbodyType === "river" ? 35 : 5,
      }))
      .filter((match) => match.distanceMiles <= match.thresholdMiles)
      .map((match) => ({ locationId: match.locationId, distanceMiles: Number(match.distanceMiles.toFixed(2)) }))
      .sort((a, b) => a.distanceMiles - b.distanceMiles);
    return {
      speciesObservationId: integer(row.SppObsID),
      observationId: integer(row.ObsID),
      speciesCode: text(row.SppBova),
      scientificName: [text(row.GENUS), text(row.SPECIES)].filter(Boolean).join(" ") || null,
      commonName: text(row.COMMON_NAME),
      count: integer(row.Count),
      condition: text(row.Cond),
      disposition: text(row.Disp),
      featureId: integer(row.FeatID),
      featureType: text(row.FeatType),
      observationDate: date(row.ObsDate),
      observer: text(row.Observer),
      observerType: text(row.ObserverTypeDesc),
      waterbody,
      locationDescription: text(row.LocDescription),
      targetSpecies: text(row.TargetSpp),
      exclude: text(row.Exclude),
      sourceDatabase: integer(row.SourceDB),
      sourceDatabaseId: text(row.SourceDB_ID),
      databaseDescription: text(row.DB_Description),
      comments: text(row.Comments),
      featureReference: text(row.txtFeatID),
      lastUpdated: date(row.Last_Updated_Date),
      spatialMatchMethod: point ? (text(row.FeatType) === "POINT" ? "public-point-distance" : "generalized-geometry-center-distance") : "no-public-geometry",
      locationMatches,
    };
  }).sort((a, b) =>
    (a.waterbody ?? "").localeCompare(b.waterbody ?? "") ||
    (a.commonName ?? "").localeCompare(b.commonName ?? "") ||
    (a.speciesObservationId ?? 0) - (b.speciesObservationId ?? 0)
  );

  const deduped = [...new Map(observations.map((record) =>
    [record.speciesObservationId ?? `${record.observationId}:${record.commonName}`, record]
  )).values()];
  const payload = {
    meta: {
      source: "Virginia DWR VAFWIS Species Observations — All Distributions",
      sourceUrl: LAYER.replace(/\/query$/, ""),
      retrieved: localDate(),
      targetLocationCount: researchLocations.length,
      targetWaterbodyNameCount: targetWaterbodyNames.length,
      region: REGION,
      observationCount: deduped.length,
      useNote:
        "Candidate evidence only. A record must match the named waterbody and pass geographic, species, date, exclusion, and contradiction review before ranking use.",
      privacyNote: "Source geometries are used transiently for matching, then deliberately discarded; only distance-to-catalog-water is retained.",
    },
    observations: deduped,
  };

  const outputPaths = [
    resolve(here, "../app/lib/generated/vafwis-fish-observations-nova.json"),
    resolve(here, "../apps/api/app/data/generated/vafwis-fish-observations-nova.json"),
  ];
  for (const outputPath of outputPaths) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
  }
  console.log(
    `Ingested ${deduped.length} public VAFWIS candidates for ` +
    `${researchLocations.length} guess-reliant locations (${targetWaterbodyNames.length} names).`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
