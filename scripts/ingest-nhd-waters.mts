/**
 * Ingests named lakes/ponds/reservoirs from USGS NHD (National Hydrography Dataset)
 * across the NOVA + adjacent watershed region, and classifies PUBLIC access by a
 * spatial join against the ESRI USA Parks layer.
 *
 * Honesty rule: only waters whose centroid falls inside a public park/forest are
 * kept (publicly fishable subject to park rules). Private community lakes and
 * unnamed stormwater ponds are excluded — never listed as fishing spots.
 *
 *   npx tsx scripts/ingest-nhd-waters.mts
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const NHD_WATERBODY = "https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer/12/query";
const USA_PARKS = "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Parks/FeatureServer/0/query";
const USA_COUNTIES = "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Counties_Generalized_Boundaries/FeatureServer/0/query";

// NOVA + Occoquan/Potomac/Rappahannock/Shenandoah watershed region.
const REGION = { xmin: -78.75, ymin: 38.05, xmax: -76.95, ymax: 39.35 };
const MIN_AREA_SQKM = 0.008; // ~2 acres — drops tiny stormwater/farm ponds
const INFRA = /sewage|treatment|waste|storm|retention|detention|settling|tailings|quarry|polish|lagoon|clarifier|golf|wastewater|sanitation|reflecting|tidal basin|monument|capitol|\bmall\b/i;

type Ring = number[][];
type PolyFeature = { name: string; rings: Ring[] };
type ArcFeature = {
  attributes?: Record<string, string | number | null | undefined>;
  geometry?: { rings?: Ring[] };
  centroid?: { x?: number; y?: number };
};
type ArcQueryResponse = { features?: ArcFeature[]; error?: unknown };
type WaterRecord = {
  permanentId: string;
  name: string;
  waterbodyType: string;
  county: string;
  latitude: number;
  longitude: number;
  areaAcres: number;
  park: string;
};

function envParam(sr = 4326) {
  return {
    geometry: JSON.stringify({ ...REGION, spatialReference: { wkid: sr } }),
    geometryType: "esriGeometryEnvelope",
    inSR: String(sr),
    spatialRel: "esriSpatialRelIntersects",
  };
}

async function fetchJson(url: string, params: Record<string, string>) {
  const response = await fetch(`${url}?${new URLSearchParams(params)}`);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  const data = await response.json() as ArcQueryResponse;
  if (data.error) throw new Error(`ArcGIS error: ${JSON.stringify(data.error).slice(0, 160)}`);
  return data;
}

async function fetchPaged(url: string, where: string, outFields: string, opts: Record<string, string> = {}) {
  const all: ArcFeature[] = [];
  let offset = 0;
  const page = 1000;
  for (let guard = 0; guard < 40; guard += 1) {
    const data = await fetchJson(url, {
      where,
      outFields,
      returnGeometry: opts.returnGeometry ?? "false",
      outSR: "4326",
      f: "json",
      resultOffset: String(offset),
      resultRecordCount: String(page),
      ...envParam(),
      ...opts,
    });
    const feats = data.features ?? [];
    all.push(...feats);
    if (feats.length < page) break;
    offset += page;
  }
  return all;
}

function pointInRing(x: number, y: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function pointInPolys(x: number, y: number, polys: PolyFeature[]): PolyFeature | null {
  for (const poly of polys) {
    for (const ring of poly.rings) {
      if (pointInRing(x, y, ring)) return poly;
    }
  }
  return null;
}

function centroidOf(feature: ArcFeature): [number, number] | null {
  if (feature.centroid && Number.isFinite(feature.centroid.x)) return [feature.centroid.x, feature.centroid.y];
  const rings = feature.geometry?.rings;
  if (!rings?.length) return null;
  let sx = 0, sy = 0, n = 0;
  for (const ring of rings) for (const [x, y] of ring) { sx += x; sy += y; n += 1; }
  return n ? [sx / n, sy / n] : null;
}

function inferType(ftype: number): string {
  return ftype === 436 ? "reservoir" : "lake";
}

async function main() {
  console.log("Fetching public parks...");
  const parkFeats = await fetchPaged(USA_PARKS, "1=1", "NAME", { returnGeometry: "true" });
  const parks: PolyFeature[] = parkFeats
    .filter((f) => f.geometry?.rings)
    .map((f) => ({ name: (f.attributes?.NAME || "public park").trim() || "public park", rings: f.geometry.rings }));
  console.log(`  ${parks.length} park polygons`);

  console.log("Fetching Virginia county boundaries...");
  const countyFeats = await fetchPaged(USA_COUNTIES, "STATE_NAME='Virginia'", "NAME", { returnGeometry: "true" });
  const counties: PolyFeature[] = countyFeats
    .filter((f) => f.geometry?.rings)
    .map((f) => ({ name: (f.attributes?.NAME || "").replace(/ County$/, "").trim(), rings: f.geometry.rings }));
  console.log(`  ${counties.length} county polygons`);

  console.log("Fetching named NHD waterbodies...");
  const waterFeats = await fetchPaged(
    NHD_WATERBODY,
    `GNIS_NAME IS NOT NULL AND (FTYPE=390 OR FTYPE=436) AND AREASQKM>=${MIN_AREA_SQKM}`,
    "GNIS_NAME,FTYPE,AREASQKM,PERMANENT_IDENTIFIER",
    { returnGeometry: "true", returnCentroid: "true" },
  );
  console.log(`  ${waterFeats.length} named waterbodies (>= ~2 acres)`);

  const waters: WaterRecord[] = [];
  const seenNames = new Set<string>();
  for (const feature of waterFeats) {
    const name = (feature.attributes?.GNIS_NAME || "").trim();
    if (!name || INFRA.test(name)) continue;
    const centroid = centroidOf(feature);
    if (!centroid) continue;
    const [x, y] = centroid;
    const park = pointInPolys(x, y, parks);
    if (!park) continue; // not on public land -> exclude (never list private lakes)
    const county = pointInPolys(x, y, counties)?.name || "";
    if (!county) continue; // keep Virginia waters only (drops MD/DC for the NOVA app)
    const key = `${name}|${Math.round(x * 50)}|${Math.round(y * 50)}`;
    if (seenNames.has(key)) continue;
    seenNames.add(key);
    waters.push({
      permanentId: String(feature.attributes?.PERMANENT_IDENTIFIER ?? ""),
      name,
      waterbodyType: inferType(feature.attributes.FTYPE),
      county,
      latitude: Number(y.toFixed(6)),
      longitude: Number(x.toFixed(6)),
      areaAcres: Math.round((feature.attributes.AREASQKM || 0) * 247.105),
      park: park.name,
    });
  }
  waters.sort((a, b) => b.areaAcres - a.areaAcres);

  const here = dirname(fileURLToPath(import.meta.url));
  const outPath = resolve(here, "../app/lib/generated/nhd-waters-nova.json");
  const payload = {
    meta: {
      source: "USGS NHD named waterbodies × ESRI USA Parks (public-land spatial join)",
      nhdUrl: "https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer/12",
      parksUrl: "https://www.arcgis.com/home/item.html?id=578968f975774d3fab79fe56c8c90941",
      license: "Public domain (USGS NHD); ESRI USA Parks reference layer",
      retrieved: new Date().toISOString().slice(0, 10),
      region: REGION,
      minAreaAcres: Math.round(MIN_AREA_SQKM * 247.105),
      waterCount: waters.length,
    },
    waters,
  };
  writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf-8");
  console.log(`\nKept ${waters.length} named public-park waterbodies -> ${outPath}`);
  console.log("Sample (largest):");
  for (const w of waters.slice(0, 25)) console.log(`  ${w.name.padEnd(32)} ${String(w.areaAcres).padStart(5)} ac  ${w.county.padEnd(16)} ${w.park}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
