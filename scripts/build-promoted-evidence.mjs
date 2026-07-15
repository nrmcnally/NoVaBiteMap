/**
 * Promote APPROVED agency candidates from the fish-community review pipeline into
 * real evidence the app can show. Candidates are ingested + adversarially reviewed
 * elsewhere (build-fish-community-review.mts + fish-community-verdicts.json); this
 * step only emits evidence for records whose objectId the verdict file has
 * explicitly approved. Because every promoted claim corresponds to an approved
 * candidate, the review --check recognises them as corroborated (never unverified).
 *
 * Scope (extensible): DWR Wild Trout Streams reaches. Anadromous-use waters and
 * VAFWIS observation claims can be added here the same way once wired for display.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = 'C:/Users/nrmcn/Documents/NoVa Bite Map';
const habitats = JSON.parse(readFileSync(`${ROOT}/app/lib/generated/dwr-fish-habitats-nova.json`, 'utf8'));
const verdicts = JSON.parse(readFileSync(`${ROOT}/docs/data/fish-community-verdicts.json`, 'utf8'));
const review = JSON.parse(readFileSync(`${ROOT}/docs/data/fish-community-review-nova.json`, 'utf8'));
// Only promote species the app can actually display (registry has a profile + image).
const seedForRegistry = JSON.parse(readFileSync(`${ROOT}/apps/api/app/data/seed_export.json`, 'utf8'));
const REGISTRY = new Set((seedForRegistry.species || []).map((s) => s.id));

const approvedWildTrout = new Set(verdicts.recordReviews.dwrWildTrout.approvedObjectIds);
const wtSourceUrl = habitats.meta.sourceUrls.wildTrout;
const reviewed = habitats.meta.retrieved || '2026-07-15';

function wildTroutAvailability(cls, speciesId) {
  const base = cls === 'I' ? 0.74 : cls === 'III' ? 0.58 : 0.66;
  return speciesId === 'brook-trout' ? base : Math.round((base - 0.14) * 100) / 100;
}

const nice = (id) => id.replace(/-/g, ' ');
const byLocation = {};
function add(locationId, evidence) {
  if (!REGISTRY.has(evidence.speciesId)) return; // skip species the app can't display
  const list = (byLocation[locationId] = byLocation[locationId] || []);
  const existing = list.find((e) => e.speciesId === evidence.speciesId);
  if (!existing) list.push(evidence);
  else if (evidence.availability > existing.availability) Object.assign(existing, evidence);
}

let wildTroutClaims = 0;
for (const reach of habitats.wildTrout) {
  if (!approvedWildTrout.has(reach.objectId)) continue;
  const cls = reach.classification || 'wild';
  for (const match of reach.locationMatches || []) {
    for (const speciesId of reach.speciesIds) {
      add(match.locationId, {
        speciesId,
        availability: wildTroutAvailability(reach.classification, speciesId),
        quality: null,
        evidenceConfidence: 0.85,
        evidenceType: 'official listing',
        evidenceSummary: `Virginia DWR classifies ${reach.name} as a Class ${cls} wild trout stream with a documented ${nice(speciesId)} population.`,
        lastEvidence: `DWR Wild Trout Streams (VAFWIS) reviewed ${reviewed}`,
        technique: 'Small inline spinner, dry fly, or nymph drifted through pockets and pool heads',
        depth: 'Plunge pools, undercut banks, and cool current seams',
        positive: [`Official DWR wild-trout designation (Class ${cls})`, `${nice(speciesId)} documented in the DWR Wild Trout Streams layer`],
        negative: ['Small wild-trout water — a fragile fishery; confirm special regulations and legal access before fishing'],
        sourceName: 'Virginia Department of Wildlife Resources',
        sourceUrl: wtSourceUrl,
      });
      wildTroutClaims++;
    }
  }
}

// Approved manual / primary-source claims (current-presence verdicts only;
// historical-only is excluded so we never present a stale record as current).
// This is also the path for reviewed local/angler-reported observations.
const CURRENT_MANUAL = new Set(['approved-direct-observation', 'approved-official-waterbody-listing', 'approved-exact-agency-report']);
let manualClaims = 0;
for (const m of verdicts.manualClaims) {
  if (!CURRENT_MANUAL.has(m.verdict)) continue;
  const year = m.publicationYear || (m.evidenceDate ? String(m.evidenceDate).slice(0, 4) : null);
  add(m.locationId, {
    speciesId: m.speciesId,
    availability: 0.6,
    quality: null,
    evidenceConfidence: 0.8,
    evidenceType: m.verdict.includes('observation') ? 'agency survey' : 'official listing',
    evidenceSummary: m.summary,
    lastEvidence: `${m.sourceName}${year ? ` (${year})` : ''} — reviewed ${reviewed}`,
    technique: 'Match presentation to the species, season, and current conditions',
    depth: 'Work accessible cover and structure first, then probe the first depth change',
    positive: [m.summary],
    negative: ['Reviewed primary-source record; conditions and access can change'],
    sourceName: m.sourceName,
    sourceUrl: m.sourceUrl,
  });
  manualClaims++;
}

// Approved DWR VAFWIS observations (reviewed in review-vafwis-observations.mjs;
// recorded as sourceClaimReviews). Real collection records — recency-scaled, dated.
const VAFWIS_URL = 'https://services.dwr.virginia.gov/arcgis/rest/services/VAFWIS/Species_Observations_All_Distrib/FeatureServer/0';
const reviewByLoc = {};
for (const L of (review.locations || review)) reviewByLoc[L.locationId] = L;
const vafwisApproved = {};
for (const s of verdicts.sourceClaimReviews) {
  if (s.sourceUrl !== VAFWIS_URL) continue;
  for (const id of s.locationIds) vafwisApproved[id] = new Set([...(vafwisApproved[id] || []), ...s.approvedSpeciesIds]);
}
const RECENCY = {
  'recent-0-to-5-years': { avail: 0.62, conf: 0.82, note: 'recent (within 5 years)' },
  'aging-5-to-10-years': { avail: 0.54, conf: 0.74, note: 'aging (5-10 years old)' },
  'historical-over-10-years': { avail: 0.46, conf: 0.64, note: 'historical (over 10 years old)' },
};
let vafwisClaims = 0;
for (const [locId, speciesSet] of Object.entries(vafwisApproved)) {
  const L = reviewByLoc[locId];
  if (!L) continue;
  const wb = L.waterbody || L.name;
  for (const c of (L.agencyObservationCandidates || [])) {
    if (!speciesSet.has(c.speciesId) || !c.exactNamedWaterMatch || !c.exactTaxonMatch) continue;
    const band = RECENCY[c.recency?.band] || RECENCY['historical-over-10-years'];
    const obs = (c.observerTypes || [])[0] || 'DWR biologists';
    const dates = c.firstObserved === c.lastObserved ? c.lastObserved : `${c.firstObserved}-${c.lastObserved}`;
    add(locId, {
      speciesId: c.speciesId,
      availability: band.avail,
      quality: null,
      evidenceConfidence: band.conf,
      evidenceType: 'agency survey',
      evidenceSummary: `Virginia DWR VAFWIS records document ${nice(c.speciesId)} in ${wb} - ${c.recordCount} record${c.recordCount === 1 ? '' : 's'} (${obs}), ${dates}.`,
      lastEvidence: `DWR VAFWIS collection records; last observed ${c.lastObserved}`,
      technique: 'Match presentation to the species, season, and current conditions',
      depth: 'Work accessible cover and structure first, then probe the first depth change',
      positive: [`${c.recordCount} DWR VAFWIS collection record${c.recordCount === 1 ? '' : 's'} - exact water + exact taxon`, `Observation ${band.note}`],
      negative: ['Documents presence as of the observation date(s), not current abundance'],
      sourceName: 'Virginia Department of Wildlife Resources (VAFWIS)',
      sourceUrl: VAFWIS_URL,
    });
    vafwisClaims++;
  }
}

// Deterministic ordering.
const ordered = {};
for (const id of Object.keys(byLocation).sort()) ordered[id] = byLocation[id].sort((a, b) => a.speciesId.localeCompare(b.speciesId));

const payload = {
  meta: {
    generated: 'promoted from approved agency candidates (fish-community-verdicts.json)',
    reviewed,
    wildTroutReachesApproved: [...approvedWildTrout].length,
    wildTroutClaims,
    manualClaims,
    vafwisClaims,
    locations: Object.keys(ordered).length,
  },
  byLocation: ordered,
};
writeFileSync(`${ROOT}/app/lib/generated/promoted-evidence-nova.json`, JSON.stringify(payload, null, 2) + '\n');
console.log(`Wrote promoted-evidence-nova.json: ${wildTroutClaims} wild-trout + ${manualClaims} manual + ${vafwisClaims} VAFWIS claims across ${Object.keys(ordered).length} locations`);
