/**
 * Generate honest "likely present" evidence for waters with no direct documentation,
 * replacing the retired county/basin stereotype. Two real, cited mechanisms:
 *
 *  1. Connectivity — trace the water downstream through the USGS river network
 *     (NLDI). If it passes, within 5 mi, a water where a warmwater sportfish is
 *     DOCUMENTED, that species is "likely present (connected downstream)".
 *  2. Subwatershed — species with real USGS Aquatic GAP survey records in the same
 *     HUC12 subwatershed.
 *
 * Deterministic (no model inference). Output is committed to app/lib/generated so the
 * app builds offline; re-running requires network (NLDI/WBD), like our other ingests.
 *
 * Inputs (committed derivations of public data):
 *  - apps/api/app/data/seed_export.json      documented waters + species (real evidence)
 *  - generated/location-huc.json             each location's HUC12 (USGS WBD)
 *  - generated/gap-huc12-rollup.json         HUC12 -> GAP survey species (USGS Aquatic GAP)
 */
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = 'C:/Users/nrmcn/Documents/NoVa Bite Map';
const GEN = `${ROOT}/app/lib/generated`;
const seed = JSON.parse(readFileSync(`${ROOT}/apps/api/app/data/seed_export.json`, 'utf8'));
const locs = seed.locations || seed;
const locHuc = JSON.parse(readFileSync(`${GEN}/location-huc.json`, 'utf8'));
const gapRoll = JSON.parse(readFileSync(`${GEN}/gap-huc12-rollup.json`, 'utf8'));

const WARMWATER = new Set(['smallmouth-bass','largemouth-bass','spotted-bass','rock-bass','bluegill','redbreast-sunfish','pumpkinseed','green-sunfish','warmouth','black-crappie','white-crappie','channel-catfish','blue-catfish','flathead-catfish','common-carp','yellow-perch','walleye','muskellunge','northern-snakehead']);
const NON_GAME = new Set(['creek-chub','fallfish','blacknose-dace','longnose-dace','white-sucker','northern-hogsucker','tessellated-darter','american-eel','mottled-sculpin','shorthead-redhorse','yellow-bullhead','brown-bullhead','gizzard-shad']);
const CAP_MI = 5;

// Any modeled inference (retired basin guess OR this script's own prior output) is
// NOT direct documentation — so the generator is idempotent no matter what the seed holds.
const isInferred = (e) => e.evidenceType === 'modeled' || /Basin inference|Likely-present/.test(e.lastEvidence || '');
const R = (x) => (x * Math.PI) / 180;
const milesBetween = (a, b, c, d) => { const dLat = R(c - a), dLon = R(d - b); const v = Math.sin(dLat/2)**2 + Math.cos(R(a))*Math.cos(R(c))*Math.sin(dLon/2)**2; return 3958.8 * 2 * Math.asin(Math.sqrt(v)); };

// Documented warmwater waters (real evidence only) to inherit from.
const documented = [];
for (const L of locs) {
  const sp = (L.evidence || []).filter((e) => !isInferred(e) && WARMWATER.has(e.speciesId));
  if (sp.length) documented.push({ name: L.name, lat: L.lat, lng: L.lng, species: sp.map((e) => ({ id: e.speciesId, sourceName: e.sourceName || 'Virginia Department of Wildlife Resources', sourceUrl: e.sourceUrl || null })) });
}

// Same-waterbody index: a point on a documented river IS that river. Any location
// sharing a normalized waterbody name with documented evidence inherits it directly
// (strongest inference — same water, not merely connected).
// Expand direction abbreviations so "S. Fork Shenandoah River" == "South Fork
// Shenandoah River", but keep the water-type suffix so "Cedar Run" != "Cedar Creek".
const normWb = (s) => (s || '').toLowerCase()
  .replace(/\bn\.?\s+fork\b/g, 'north fork').replace(/\bs\.?\s+fork\b/g, 'south fork')
  .replace(/\be\.?\s+fork\b/g, 'east fork').replace(/\bw\.?\s+fork\b/g, 'west fork')
  .replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
const documentedByWaterbody = {};
for (const L of locs) {
  const real = (L.evidence || []).filter((e) => !isInferred(e));
  if (!real.length) continue;
  const key = normWb(L.waterbody);
  if (!key) continue;
  const bucket = (documentedByWaterbody[key] = documentedByWaterbody[key] || { waterbody: L.waterbody, species: new Map() });
  for (const e of real) if (!bucket.species.has(e.speciesId)) bucket.species.set(e.speciesId, { id: e.speciesId, sourceName: e.sourceName || 'Virginia Department of Wildlife Resources', sourceUrl: e.sourceUrl || null });
}

// Targets = waters whose ONLY evidence today is the basin guess (or none).
const targets = locs.filter((L) => { const ev = L.evidence || []; return ev.length === 0 || ev.every(isInferred); });

async function nldi(url) {
  for (let a = 0; a < 3; a++) {
    try { const r = await fetch(url, { signal: AbortSignal.timeout(30000) }); if (r.ok) return await r.json(); } catch {}
    await new Promise((res) => setTimeout(res, 700));
  }
  return null;
}

async function connectivity(L) {
  const pos = await nldi(`https://api.water.usgs.gov/nldi/linked-data/comid/position?coords=POINT(${L.lng}%20${L.lat})&f=json`);
  const comid = pos?.features?.[0]?.properties?.comid;
  if (!comid) return [];
  const dm = await nldi(`https://api.water.usgs.gov/nldi/linked-data/comid/${comid}/navigation/DM/flowlines?distance=60&f=json`);
  const verts = [];
  for (const f of (dm?.features || [])) {
    const g = f.geometry;
    const parts = g?.type === 'MultiLineString' ? g.coordinates.flat() : (g?.coordinates || []);
    for (const [lng, lat] of parts) verts.push([lat, lng]);
  }
  const hits = [];
  for (const w of documented) {
    let min = Infinity;
    for (const [vlat, vlng] of verts) { const d = milesBetween(w.lat, w.lng, vlat, vlng); if (d < min) min = d; }
    const downstreamMi = milesBetween(L.lat, L.lng, w.lat, w.lng);
    if (min <= 0.4 && downstreamMi <= CAP_MI && downstreamMi > 0.05) hits.push({ water: w.name, downstreamMi: +downstreamMi.toFixed(1), species: w.species });
  }
  hits.sort((a, b) => a.downstreamMi - b.downstreamMi);
  return hits.slice(0, 2);
}

const out = {};
let done = 0, withConn = 0, withSub = 0, withWb = 0;
const queue = [...targets];
async function worker() {
  while (queue.length) {
    const L = queue.shift();
    // Same-waterbody (strongest): does this location share a river/water with documented evidence?
    const wbKey = normWb(L.waterbody);
    const wbMatch = wbKey && documentedByWaterbody[wbKey] && normWb(documentedByWaterbody[wbKey].waterbody) === wbKey
      ? { waterbody: documentedByWaterbody[wbKey].waterbody, species: [...documentedByWaterbody[wbKey].species.values()] }
      : null;
    const conn = await connectivity(L);
    const h12 = locHuc[L.id]?.huc12 ?? null;
    const roll = h12 ? gapRoll[h12] : null;
    const subSpecies = roll ? Object.entries(roll.present || {}).map(([id, count]) => ({ id, count, nonGame: NON_GAME.has(id) })) : [];
    if (wbMatch || conn.length || subSpecies.length) {
      out[L.id] = {
        name: L.name, county: L.county, waterbodyType: L.waterbodyType,
        sameWaterbody: wbMatch,
        connectivity: conn,
        subwatershed: subSpecies.length ? { huc12: h12, sampleCount: roll.sampleCount, sources: roll.sources || [], species: subSpecies } : null,
      };
      if (wbMatch) withWb++;
      if (conn.length) withConn++;
      if (subSpecies.length) withSub++;
    }
    if (++done % 20 === 0) process.stderr.write(`  ${done}/${targets.length}\n`);
  }
}
await Promise.all(Array.from({ length: 8 }, worker));

const payload = {
  meta: {
    generated: 'reproducible from USGS NLDI (connectivity) + USGS Aquatic GAP (subwatershed)',
    method: 'downstream NLDI trace matched (<=0.4mi) to documented warmwater waters within 5mi; HUC12 GAP survey rollup',
    documentedWatersConsidered: documented.length,
    targetsProcessed: targets.length,
    withSameWaterbody: withWb,
    withConnectivity: withConn,
    withSubwatershed: withSub,
  },
  waters: out,
};
writeFileSync(`${GEN}/likely-present-nova.json`, JSON.stringify(payload, null, 2) + '\n');
console.log(`Wrote likely-present-nova.json: ${Object.keys(out).length} waters (${withWb} same-waterbody, ${withConn} connectivity, ${withSub} subwatershed) of ${targets.length} targets`);
