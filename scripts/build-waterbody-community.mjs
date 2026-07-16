/**
 * Same-waterbody community completion (#3: no species overlooked). Access points on
 * ONE water (a river reach, a reservoir) share that water's fish, but each catalog
 * entry only carried the species that happened to be documented at its exact point.
 * This builds, per normalized waterbody, the union of DIRECTLY-documented species
 * across all its access points (with the best citation), so the assembler can fill
 * the ones a given point is missing — labeled as the shared-water listing, not an
 * exact-point survey. Only direct agency evidence propagates (never modeled/likely).
 */
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = 'C:/Users/nrmcn/Documents/NoVa Bite Map';
const seed = JSON.parse(readFileSync(`${ROOT}/apps/api/app/data/seed_export.json`, 'utf8'));
const locs = seed.locations || seed;

// Normalized waterbody key: same river/reservoir regardless of abbreviation, but keep
// the water-type word so "Cedar Run" != "Cedar Creek".
const normWb = (w) => (w || '').toLowerCase()
  .replace(/\bn\.?\s+fork\b/g, 'north fork').replace(/\bs\.?\s+fork\b/g, 'south fork')
  .replace(/\be\.?\s+fork\b/g, 'east fork').replace(/\bw\.?\s+fork\b/g, 'west fork')
  .replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

const R = (x) => (x * Math.PI) / 180;
const mi = (a, b, c, d) => { const dLat = R(c - a), dLon = R(d - b); const v = Math.sin(dLat/2)**2 + Math.cos(R(a))*Math.cos(R(c))*Math.sin(dLon/2)**2; return 3958.8 * 2 * Math.asin(Math.sqrt(v)); };

// A record is DIRECT documentation (safe to share) if it's not modeled inference and
// not itself an inherited same-waterbody record.
const isDirect = (e) => !e.modeled
  && ['official listing', 'agency survey', 'stocking'].includes(e.evidenceType)
  && !/Likely-present|shared water this access point/i.test((e.lastEvidence || '') + (e.evidenceSummary || ''));

// waterbody key -> { waterbody, points:[{lat,lng}], species: Map(id -> best record) }
const byWb = {};
for (const L of locs) {
  const key = normWb(L.waterbody);
  if (!key) continue;
  const b = (byWb[key] = byWb[key] || { waterbody: L.waterbody, points: [], species: new Map() });
  b.points.push({ lat: L.lat, lng: L.lng });
  for (const e of (L.evidence || [])) {
    if (!isDirect(e)) continue;
    const cur = b.species.get(e.speciesId);
    if (!cur || (e.availability || 0) > (cur.availability || 0)) {
      b.species.set(e.speciesId, {
        speciesId: e.speciesId, availability: e.availability, quality: e.quality ?? null,
        evidenceType: e.evidenceType, sourceName: e.sourceName || null, sourceUrl: e.sourceUrl || null,
      });
    }
  }
}

// Emit only waterbodies that (a) appear at 2+ access points and (b) whose points are
// within 60 mi of each other (one real water, not two same-named creeks in different
// regions) and (c) have >=1 direct species.
const out = {};
let wbCount = 0, spCount = 0;
for (const [key, b] of Object.entries(byWb)) {
  if (b.points.length < 2 || b.species.size === 0) continue;
  let span = 0;
  for (let i = 0; i < b.points.length; i++) for (let j = i + 1; j < b.points.length; j++) {
    span = Math.max(span, mi(b.points[i].lat, b.points[i].lng, b.points[j].lat, b.points[j].lng));
  }
  if (span > 60) continue;
  out[key] = { waterbody: b.waterbody, species: [...b.species.values()].sort((a, c) => a.speciesId.localeCompare(c.speciesId)) };
  wbCount++; spCount += b.species.size;
}

writeFileSync(`${ROOT}/app/lib/generated/waterbody-community-nova.json`, JSON.stringify({ meta: { waterbodies: wbCount, speciesRecords: spCount }, byWaterbody: out }, null, 2) + '\n');
console.log(`Wrote waterbody-community-nova.json: ${wbCount} shared waters, ${spCount} direct species records`);
