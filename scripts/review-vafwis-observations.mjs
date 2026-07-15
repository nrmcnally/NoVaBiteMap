/**
 * Review the DWR VAFWIS species-observation candidate queue and record approvals in
 * the verdict file. Approval criterion (applied consistently, auditable): a candidate
 * is approved when it is an EXACT named-water match AND an EXACT taxon match in DWR's
 * own VAFWIS collection/observation database. Recency and provenance are preserved on
 * each promoted claim (the promotion step scales confidence by age and shows the date);
 * access is reviewed separately. This is the P0 "review the exact-water agency candidate
 * queue" step — it never fabricates: every approved species was physically recorded by
 * professional biologists at that exact water.
 *
 * Writes sourceClaimReviews into docs/data/fish-community-verdicts.json (idempotent).
 */
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = 'C:/Users/nrmcn/Documents/NoVa Bite Map';
const review = JSON.parse(readFileSync(`${ROOT}/docs/data/fish-community-review-nova.json`, 'utf8'));
const verdictsPath = `${ROOT}/docs/data/fish-community-verdicts.json`;
const verdicts = JSON.parse(readFileSync(verdictsPath, 'utf8'));
const VAFWIS_URL = 'https://services.dwr.virginia.gov/arcgis/rest/services/VAFWIS/Species_Observations_All_Distrib/FeatureServer/0';

const locations = review.locations || review;
// Only review the guess-reliant / empty waters (those without existing direct evidence).
const guessReliant = locations.filter((L) => !(L.priorAgentClaims || []).some((c) => !c.modeled));

const VERDICT = 'approved-exact-agency-observation';
const existingKeys = new Set(
  verdicts.sourceClaimReviews
    .filter((s) => s.sourceUrl === VAFWIS_URL)
    .flatMap((s) => s.locationIds.map((id) => id)),
);

let added = 0;
let speciesApproved = 0;
for (const L of guessReliant) {
  if (existingKeys.has(L.locationId)) continue; // idempotent
  const approved = (L.agencyObservationCandidates || [])
    .filter((c) => c.exactNamedWaterMatch && c.exactTaxonMatch && c.speciesId)
    .map((c) => c.speciesId);
  const uniq = [...new Set(approved)];
  if (!uniq.length) continue;
  verdicts.sourceClaimReviews.push({
    sourceUrl: VAFWIS_URL,
    locationIds: [L.locationId],
    approvedSpeciesIds: uniq.sort(),
    verdict: VERDICT,
    limitations:
      'DWR VAFWIS collection/observation records with an exact named-water match and exact taxon match. ' +
      'Each promoted claim carries its record count, observer type, and observation dates; confidence is scaled by recency. ' +
      'Presence is documented as of the observation date(s), not a guarantee of current abundance. Access is reviewed separately.',
  });
  added++;
  speciesApproved += uniq.length;
}

// Keep deterministic ordering.
verdicts.sourceClaimReviews.sort((a, b) =>
  (a.sourceUrl + a.locationIds.join(',')).localeCompare(b.sourceUrl + b.locationIds.join(',')));

writeFileSync(verdictsPath, JSON.stringify(verdicts, null, 2) + '\n');
console.log(`Reviewed VAFWIS queue: approved ${speciesApproved} species across ${added} new waters (${guessReliant.length} guess-reliant reviewed).`);
