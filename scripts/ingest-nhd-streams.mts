/**
 * Ingests named NHD streams/creeks/runs that cross public parkland, one
 * representative access point per named stream. Public-land crossing = public
 * fishing access (subject to park rules); streams that never touch public land
 * are excluded (no private-property spots). Captures NOVA tributaries like Bull
 * Run, Goose Creek, Broad Run, Cedar Run, Difficult Run where they enter parks.
 *
 *   npx tsx scripts/ingest-nhd-streams.mts
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const NHD_FLOWLINE = "https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer/6/query";
const USA_PARKS = "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Parks/FeatureServer/0/query";
const USA_COUNTIES = "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Counties_Generalized_Boundaries/FeatureServer/0/query";

const REGION = { xmin: -78.4, ymin: 38.3, xmax: -77.0, ymax: 39.3 };
const INFRA = /canal|ditch|tailrace|millrace|drain/i;
// "Branch" names are almost always tiny headwater trickles, not fishing
// destinations. Drop them for credibility (Creeks/Runs/Rivers are kept). Flip
// SKIP_BRANCHES to false to include every named stream.
const SKIP_BRANCHES = true;
const isTinyBranch = (name: string) => SKIP_BRANCHES && /\bbranch\b/i.test(name);

type Ring = number[][];
type PolyFeature = { name: string; rings: Ring[] };
type ArcFeature = {
  attributes?: Record<string, string | number | null | undefined>;
  geometry?: { rings?: Ring[]; paths?: number[][][] };
};
type ArcQueryResponse = { features?: ArcFeature[]; error?: unknown };

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

async function fetchPaged(url: string, where: string, outFields: string, opts: Record<string, string> = {}, page = 800) {
  const all: ArcFeature[] = [];
  let offset = 0;
  for (let guard = 0; guard < 60; guard += 1) {
    const data = await fetchJson(url, {
      where, outFields, returnGeometry: opts.returnGeometry ?? "false", outSR: "4326", f: "json",
      resultOffset: String(offset), resultRecordCount: String(page), ...envParam(), ...opts,
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
  for (const poly of polys) for (const ring of poly.rings) if (pointInRing(x, y, ring)) return poly;
  return null;
}

async function main() {
  console.log("Fetching public parks...");
  const parkFeats = await fetchPaged(USA_PARKS, "1=1", "NAME", { returnGeometry: "true" });
  const parks: PolyFeature[] = parkFeats.filter((f) => f.geometry?.rings).map((f) => ({ name: (f.attributes?.NAME || "public park").trim() || "public park", rings: f.geometry.rings }));
  console.log(`  ${parks.length} park polygons`);

  console.log("Fetching Virginia county boundaries...");
  const countyFeats = await fetchPaged(USA_COUNTIES, "STATE_NAME='Virginia'", "NAME", { returnGeometry: "true" });
  const counties: PolyFeature[] = countyFeats.filter((f) => f.geometry?.rings).map((f) => ({ name: (f.attributes?.NAME || "").replace(/ County$/, "").trim(), rings: f.geometry.rings }));
  console.log(`  ${counties.length} county polygons`);

  console.log("Fetching named NHD stream segments...");
  // NHD HR flowline returns lowercase attribute keys (gnis_name, ftype).
  const segs = await fetchPaged(NHD_FLOWLINE, "gnis_name IS NOT NULL AND ftype=460", "gnis_name,ftype", { returnGeometry: "true" }, 800);
  console.log(`  ${segs.length} named StreamRiver segments`);

  // One representative in-park access point per named stream.
  const byName = new Map<string, { name: string; lat: number; lng: number; county: string; park: string }>();
  for (const seg of segs) {
    const name = (seg.attributes?.gnis_name || "").trim();
    if (!name || INFRA.test(name) || isTinyBranch(name) || byName.has(name)) continue;
    const path = seg.geometry?.paths?.[0];
    if (!path?.length) continue;
    const [x, y] = path[Math.floor(path.length / 2)];
    const park = pointInPolys(x, y, parks);
    if (!park) continue; // stream segment not on public land
    const county = pointInPolys(x, y, counties)?.name;
    if (!county) continue; // Virginia only
    byName.set(name, { name, lat: Number(y.toFixed(6)), lng: Number(x.toFixed(6)), county, park: park.name });
  }
  const streams = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));

  const here = dirname(fileURLToPath(import.meta.url));
  const outPath = resolve(here, "../app/lib/generated/nhd-streams-nova.json");
  writeFileSync(outPath, JSON.stringify({
    meta: {
      source: "USGS NHD named streams × ESRI USA Parks (public-land crossing)",
      nhdUrl: "https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer/6",
      license: "Public domain (USGS NHD); ESRI USA Parks reference layer",
      retrieved: new Date().toISOString().slice(0, 10),
      region: REGION,
      streamCount: streams.length,
    },
    streams,
  }, null, 2), "utf-8");
  console.log(`\nKept ${streams.length} named public-park streams -> ${outPath}`);
  for (const s of streams.slice(0, 40)) console.log(`  ${s.name.padEnd(28)} ${s.county.padEnd(16)} ${s.park}`);
}

main().catch((error) => { console.error(error); process.exit(1); });
