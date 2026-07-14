/**
 * Ingests the live DWR "Maintained Boating Access Locations" ArcGIS layer for the
 * NOVA region + adjacent watershed counties into a normalized snapshot. Every site
 * is a state-maintained PUBLIC access point with real coordinates.
 *
 *   npx tsx scripts/ingest-dwr-access.mts
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const LAYER =
  "https://services.dwr.virginia.gov/arcgis/rest/services/Public/BoatingAccessSites/FeatureServer/0/query";

const COUNTIES = [
  "Fairfax", "Prince William", "Loudoun", "Fauquier", "Arlington", "Alexandria",
  "Stafford", "Clarke", "Warren", "Frederick", "Culpeper", "Spotsylvania",
  "King George", "Fredericksburg", "Page", "Shenandoah", "Rappahannock",
  "Madison", "Orange", "Rockingham",
];

type DwrSite = {
  OBJECTID: number;
  SITENAME?: string;
  WATERBODY?: string;
  BODYOFWATE?: string;
  COUNTY?: string;
  ACCESSAREA?: string;
  TYPE?: string;
  NO_OFRAMPS?: number;
  Lat?: number;
  Long?: number;
};

function inferWaterbodyType(name: string): string {
  const n = name.toLowerCase();
  if (/reservoir/.test(n)) return "reservoir";
  if (/lake|pond/.test(n)) return "lake";
  if (/\bbay\b|embayment/.test(n)) return "bay";
  if (/creek|run|branch/.test(n)) return "stream";
  return "river"; // rivers, forks, and unlabeled flowing water
}

async function main() {
  const where = `COUNTY IN (${COUNTIES.map((c) => `'${c.replace(/'/g, "''")}'`).join(",")})`;
  const params = new URLSearchParams({
    where,
    outFields: "OBJECTID,SITENAME,WATERBODY,BODYOFWATE,COUNTY,ACCESSAREA,TYPE,NO_OFRAMPS,Lat,Long",
    returnGeometry: "false",
    f: "json",
  });
  const response = await fetch(`${LAYER}?${params}`);
  if (!response.ok) throw new Error(`DWR layer HTTP ${response.status}`);
  const data = (await response.json()) as { features?: { attributes: DwrSite }[] };
  const rows = (data.features ?? [])
    .map((f) => f.attributes)
    .filter((r) => r.SITENAME && Number.isFinite(r.Lat) && Number.isFinite(r.Long));

  const sites = rows.map((r) => {
    const waterbody = (r.WATERBODY || r.BODYOFWATE || r.SITENAME || "").trim();
    const ramps = Number(r.NO_OFRAMPS ?? 0);
    const access = ramps > 0 ? ["shore", "kayak", "boat"] : ["shore", "kayak"];
    return {
      objectId: r.OBJECTID,
      name: (r.SITENAME || "").trim(),
      waterbody,
      waterbodyType: inferWaterbodyType(waterbody),
      county: (r.COUNTY || "").trim(),
      latitude: r.Lat!,
      longitude: r.Long!,
      access,
      ramps,
      accessArea: (r.ACCESSAREA || "").trim() || null,
    };
  });

  const here = dirname(fileURLToPath(import.meta.url));
  const outPath = resolve(here, "../app/lib/generated/dwr-access-nova.json");
  const payload = {
    meta: {
      source: "Virginia DWR Maintained Boating Access Locations (ArcGIS)",
      sourceUrl: "https://services.dwr.virginia.gov/arcgis/rest/services/Public/BoatingAccessSites/FeatureServer/0",
      license: "Public data — Virginia Department of Wildlife Resources",
      retrieved: new Date().toISOString().slice(0, 10),
      counties: COUNTIES,
      siteCount: sites.length,
    },
    sites,
  };
  writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf-8");
  console.log(`Ingested ${sites.length} DWR boating-access sites -> ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
