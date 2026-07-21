/**
 * Builds the adversarial fish-community review ledger. Existing agent claims
 * and new agency-observation matches are preserved as candidates; this script
 * never promotes evidence into the app or marks a human review as approved.
 *
 *   npx tsx scripts/build-fish-community-review.mts
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type Evidence = {
  speciesId: string;
  evidenceType?: string;
  evidenceSummary?: string;
  lastEvidence?: string;
  sourceName?: string;
  sourceUrl?: string;
  modeled?: boolean;
};
type Location = {
  id: string;
  name: string;
  waterbody: string;
  waterbodyType: string;
  county: string;
  accessStatus?: "verified" | "listed" | "unverified";
  accessAuthority?: string;
  accessSourceUrl?: string;
  aliases?: string[];
  evidence: Evidence[];
};
type Observation = {
  speciesObservationId: number | null;
  observationId: number | null;
  scientificName: string | null;
  commonName: string | null;
  count: number | null;
  observationDate: string | null;
  observer: string | null;
  observerType: string | null;
  waterbody: string | null;
  locationDescription: string | null;
  exclude: string | null;
  databaseDescription: string | null;
  sourceDatabaseId: string | null;
  spatialMatchMethod: "public-point-distance" | "generalized-geometry-center-distance" | "no-public-geometry";
  locationMatches: Array<{ locationId: string; distanceMiles: number }>;
};
type HabitatSnapshot = {
  meta: { sourceUrls: { wildTrout: string; anadromous: string }; retrieved: string };
  wildTrout: Array<{
    objectId: number | null;
    name: string | null;
    speciesIds: string[];
    reachCode: string | null;
    classification: string | null;
    locationMatches: Array<{ locationId: string; distanceMiles: number }>;
  }>;
  anadromous: Array<{
    objectId: number | null;
    name: string | null;
    status: string | null;
    scientificName: string | null;
    commonName: string | null;
    upperBoundary: string | null;
    locationMatches: Array<{ locationId: string; distanceMiles: number }>;
  }>;
};
type StockedTroutSnapshot = {
  meta: { source: string; sourceUrls: string[]; retrieved: string; sourceCaveat: string };
  records: Array<{
    layerId: number;
    evidenceKind: string;
    objectId: number | null;
    waterbody: string | null;
    designation: string | null;
    stockingSchedule: string | null;
    speciesIds: string[];
    speciesFlags: { rainbow: number | null; brown: number | null; brook: number | null };
    notes: string | null;
    locationMatches: Array<{ locationId: string; distanceMiles: number; matchBasis: string }>;
  }>;
};
type ReviewVerdicts = {
  meta: Record<string, unknown>;
  recordReviews: {
    dwrWildTrout: { approvedObjectIds: number[]; verdict: string };
    dwrAnadromous: {
      approvedObjectIds: number[];
      potentialDoNotPromoteObjectIds: number[];
      verdict: string;
    };
    dwrStockedTrout: { approvedObjectIds: number[]; verdict: string };
  };
  priorClaimReviews: Array<{ locationId: string; speciesId: string; verdict: string; [key: string]: unknown }>;
  sourceClaimRejections: Array<{
    sourceUrl: string;
    locationIds: string[];
    rejectedSpeciesIds: string[];
    verdict: string;
    [key: string]: unknown;
  }>;
  sourceClaimReviews: Array<{
    sourceUrl: string;
    locationIds: string[];
    approvedSpeciesIds: string[];
    verdict: string;
    [key: string]: unknown;
  }>;
  manualClaims: Array<{ locationId: string; speciesId: string; verdict: string; [key: string]: unknown }>;
  contradictionReviews: Array<{ locationId: string; speciesId: string; verdict: string; [key: string]: unknown }>;
  accessReviews: Array<{ locationId: string; fishingPermission: string; waypointAccess: string; [key: string]: unknown }>;
};

const SPECIES_BY_SCIENTIFIC_NAME: Record<string, string> = {
  "Micropterus dolomieu": "smallmouth-bass",
  "Micropterus nigricans": "largemouth-bass",
  "Micropterus salmoides": "largemouth-bass",
  "Micropterus punctulatus": "spotted-bass",
  "Ambloplites rupestris": "rock-bass",
  "Lepomis macrochirus": "bluegill",
  "Lepomis auritus": "redbreast-sunfish",
  "Lepomis gibbosus": "pumpkinseed",
  "Lepomis cyanellus": "green-sunfish",
  "Lepomis gulosus": "warmouth",
  "Pomoxis nigromaculatus": "black-crappie",
  "Pomoxis annularis": "white-crappie",
  "Ictalurus punctatus": "channel-catfish",
  "Ictalurus furcatus": "blue-catfish",
  "Pylodictis olivaris": "flathead-catfish",
  "Oncorhynchus mykiss": "rainbow-trout",
  "Salmo trutta": "brown-trout",
  "Salvelinus fontinalis": "brook-trout",
  "Sander vitreus": "walleye",
  "Perca flavescens": "yellow-perch",
  "Morone americana": "white-perch",
  "Morone saxatilis": "striped-bass",
  "Esox masquinongy": "muskellunge",
  "Channa argus": "northern-snakehead",
  "Semotilus atromaculatus": "creek-chub",
  "Semotilus corporalis": "fallfish",
  "Rhinichthys atratulus": "blacknose-dace",
  "Rhinichthys cataractae": "longnose-dace",
  "Catostomus commersonii": "white-sucker",
  "Hypentelium nigricans": "northern-hogsucker",
  "Etheostoma olmstedi": "tessellated-darter",
  "Anguilla rostrata": "american-eel",
  "Cottus bairdii": "mottled-sculpin",
  "Cottus caeruleomentum": "blue-ridge-sculpin",
  "Moxostoma macrolepidotum": "shorthead-redhorse",
  "Ameiurus natalis": "yellow-bullhead",
  "Ameiurus nebulosus": "brown-bullhead",
  "Dorosoma cepedianum": "gizzard-shad",
  "Lepisosteus osseus": "longnose-gar",
  "Alosa mediocris": "hickory-shad",
  "Alosa sapidissima": "american-shad",
};

const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const nameVariants = (value: string) => [...new Set([
  value,
  value.replace(/\bN\.\s*Fork\b/gi, "North Fork").replace(/\bS\.\s*Fork\b/gi, "South Fork"),
])];
const modeledEvidence = (record: Evidence) =>
  record.evidenceType === "modeled" ||
  Boolean(record.modeled) ||
  (record.sourceName ?? "").toLowerCase().includes("aquatic gap");
const direct = (record: Evidence) => !modeledEvidence(record);
const dateSort = (a: string | null, b: string | null) => (a ?? "").localeCompare(b ?? "");
const observationKey = (record: Observation) => record.sourceDatabaseId
  ? [record.sourceDatabaseId, record.scientificName, record.observationDate, record.waterbody, record.observer, record.locationDescription].join("|")
  : ["observation", record.observationId, record.speciesObservationId].join("|");
const CHECK = process.argv.includes("--check");
const requestedAsOf = process.argv.find((argument) => argument.startsWith("--as-of="))?.slice("--as-of=".length);
// Review age is intentionally pinned. Advancing it is a deliberate evidence-review
// event that regenerates the checked-in ledger, not an incidental effect of running
// tests on a later calendar day.
const REVIEW_AS_OF = requestedAsOf ?? process.env.BITEMAP_REVIEW_AS_OF ?? "2026-07-21";
const CURRENT_MANUAL_VERDICTS = new Set([
  "approved-direct-observation",
  "approved-official-waterbody-listing",
  "approved-exact-agency-report",
]);
if (!/^\d{4}-\d{2}-\d{2}$/.test(REVIEW_AS_OF) || Number.isNaN(Date.parse(`${REVIEW_AS_OF}T12:00:00Z`))) {
  throw new Error(`Invalid review as-of date: ${REVIEW_AS_OF}`);
}
const reviewAsOfMs = Date.parse(`${REVIEW_AS_OF}T12:00:00Z`);
const localDate = () => REVIEW_AS_OF;
const recency = (value: string | null) => {
  if (!value) return { band: "undated", ageYears: null };
  const ageYears = (reviewAsOfMs - Date.parse(`${value}T12:00:00Z`)) / (365.2425 * 24 * 60 * 60 * 1000);
  if (ageYears < -0.1) return { band: "future-date-review", ageYears: Number(ageYears.toFixed(1)) };
  if (ageYears <= 5) return { band: "recent-0-to-5-years", ageYears: Number(Math.max(0, ageYears).toFixed(1)) };
  if (ageYears <= 10) return { band: "aging-5-to-10-years", ageYears: Number(ageYears.toFixed(1)) };
  return { band: "historical-over-10-years", ageYears: Number(ageYears.toFixed(1)) };
};

function writeOrCheck(path: string, content: string) {
  if (!CHECK) {
    writeFileSync(path, content, "utf8");
    return;
  }
  const current = readFileSync(path, "utf8");
  if (current !== content) {
    throw new Error(`Generated review artifact is stale: ${path}. Run the review builder without --check.`);
  }
}

function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const seed = JSON.parse(readFileSync(resolve(here, "../apps/api/app/data/seed_export.json"), "utf8")) as {
    species: Array<{ id: string; name: string; targetable?: boolean }>;
    locations: Location[];
  };
  const vafwis = JSON.parse(
    readFileSync(resolve(here, "../app/lib/generated/vafwis-fish-observations-nova.json"), "utf8"),
  ) as { meta: Record<string, unknown>; observations: Observation[] };
  const habitats = JSON.parse(
    readFileSync(resolve(here, "../app/lib/generated/dwr-fish-habitats-nova.json"), "utf8"),
  ) as HabitatSnapshot;
  const stockedTrout = JSON.parse(
    readFileSync(resolve(here, "../app/lib/generated/dwr-stocked-trout-nova.json"), "utf8"),
  ) as StockedTroutSnapshot;
  const verdicts = JSON.parse(
    readFileSync(resolve(here, "../docs/data/fish-community-verdicts.json"), "utf8"),
  ) as ReviewVerdicts;
  const targetSpeciesIds = new Set(seed.species.filter((species) => species.targetable !== false).map((species) => species.id));
  const approvedWildTroutIds = new Set(verdicts.recordReviews.dwrWildTrout.approvedObjectIds);
  const approvedAnadromousIds = new Set(verdicts.recordReviews.dwrAnadromous.approvedObjectIds);
  const rejectedPotentialAnadromousIds = new Set(verdicts.recordReviews.dwrAnadromous.potentialDoNotPromoteObjectIds);
  const approvedStockedTroutIds = new Set(verdicts.recordReviews.dwrStockedTrout.approvedObjectIds);

  const locations = seed.locations.map((location) => {
    const names = new Set(
      [location.waterbody, location.name, ...(location.aliases ?? [])].flatMap(nameVariants).map(normalized).filter(Boolean),
    );
    const matched = [...new Map(
      vafwis.observations
        .filter((record) =>
          record.waterbody && names.has(normalized(record.waterbody)) &&
          record.locationMatches.some((match) => match.locationId === location.id),
        )
        .map((record) => [observationKey(record), record] as const),
    ).values()];
    const mapped = matched
      .map((record) => ({ record, speciesId: record.scientificName ? SPECIES_BY_SCIENTIFIC_NAME[record.scientificName] : undefined }))
      .filter((item): item is { record: Observation; speciesId: string } => Boolean(item.speciesId));
    const bySpecies = new Map<string, Observation[]>();
    for (const item of mapped) {
      bySpecies.set(item.speciesId, [...(bySpecies.get(item.speciesId) ?? []), item.record]);
    }
    const candidates = [...bySpecies.entries()].map(([speciesId, records]) => {
      const dated = records.filter((record) => record.observationDate).sort((a, b) => dateSort(a.observationDate, b.observationDate));
      const eventIds = new Set(records.map((record) => record.observationId).filter((id) => id !== null));
      const lastObserved = dated.at(-1)?.observationDate ?? null;
      return {
        speciesId,
        targetSpecies: targetSpeciesIds.has(speciesId),
        exactTaxonMatch: true,
        exactNamedWaterMatch: true,
        recordCount: records.length,
        surveyEventCount: eventIds.size,
        firstObserved: dated.at(0)?.observationDate ?? null,
        lastObserved,
        recency: recency(lastObserved),
        observerTypes: [...new Set(records.map((record) => record.observerType).filter(Boolean))].sort(),
        sourceDatabases: [...new Set(records.map((record) => record.databaseDescription).filter(Boolean))].sort(),
        sampleRecords: records.slice().sort((a, b) => dateSort(b.observationDate, a.observationDate)).slice(0, 3).map((record) => ({
          speciesObservationId: record.speciesObservationId,
          observationId: record.observationId,
          observationDate: record.observationDate,
          observer: record.observer,
          locationDescription: record.locationDescription,
          sourceDatabaseId: record.sourceDatabaseId,
          distanceMiles: record.locationMatches.find((match) => match.locationId === location.id)?.distanceMiles ?? null,
          spatialMatchMethod: record.spatialMatchMethod,
        })),
        automatedChecks: {
          officialAgencyService: true,
          excludedFlagClear: records.every((record) => !record.exclude),
          atLeastOneDatedRecord: dated.length > 0,
          exactWaterbodyName: true,
          exactSpeciesTaxon: true,
          publicGeometryNearCatalogWater: true,
          abundanceNotInferred: true,
        },
        reviewStatus: "candidate-awaiting-adversarial-review",
        sourceName: "Virginia Department of Wildlife Resources — VAFWIS",
        sourceUrl: vafwis.meta.sourceUrl,
      };
    }).sort((a, b) => Number(b.targetSpecies) - Number(a.targetSpecies) || a.speciesId.localeCompare(b.speciesId));

    const wildTroutCandidates = habitats.wildTrout
      .filter((record) => record.locationMatches.some((match) => match.locationId === location.id))
      .flatMap((record) => record.speciesIds.map((speciesId) => ({
        speciesId,
        targetSpecies: targetSpeciesIds.has(speciesId),
        evidenceKind: "DWR wild-trout reach",
        exactNamedWaterMatch: true,
        publicGeometryNearCatalogWater: true,
        distanceMiles: record.locationMatches.find((match) => match.locationId === location.id)?.distanceMiles ?? null,
        reachCode: record.reachCode,
        classification: record.classification,
        sourceObjectId: record.objectId,
        retrieved: habitats.meta.retrieved,
        sourceUrl: habitats.meta.sourceUrls.wildTrout,
        reviewStatus: record.objectId !== null && approvedWildTroutIds.has(record.objectId)
          ? verdicts.recordReviews.dwrWildTrout.verdict
          : "candidate-awaiting-adversarial-review",
      })));
    const anadromousCandidates = habitats.anadromous
      .filter((record) => record.locationMatches.some((match) => match.locationId === location.id))
      .map((record) => ({
        speciesId: record.scientificName ? SPECIES_BY_SCIENTIFIC_NAME[record.scientificName] ?? null : null,
        targetSpecies: record.scientificName ? targetSpeciesIds.has(SPECIES_BY_SCIENTIFIC_NAME[record.scientificName]) : false,
        evidenceKind: "DWR anadromous-use reach",
        status: record.status,
        exactNamedWaterMatch: true,
        publicGeometryNearCatalogWater: true,
        distanceMiles: record.locationMatches.find((match) => match.locationId === location.id)?.distanceMiles ?? null,
        upperBoundary: record.upperBoundary,
        commonName: record.commonName,
        sourceObjectId: record.objectId,
        sourceUrl: habitats.meta.sourceUrls.anadromous,
        reviewStatus: record.objectId !== null && approvedAnadromousIds.has(record.objectId)
          ? verdicts.recordReviews.dwrAnadromous.verdict
          : record.objectId !== null && rejectedPotentialAnadromousIds.has(record.objectId)
            ? "potential-use-area-do-not-promote"
            : record.status?.toLowerCase() === "confirmed"
              ? "candidate-awaiting-adversarial-review"
              : "potential-use-area-do-not-promote",
      }));
    const habitatCandidates = [...wildTroutCandidates, ...anadromousCandidates];
    const stockingCandidates = stockedTrout.records
      .filter((record) => record.locationMatches.some((match) => match.locationId === location.id))
      .flatMap((record) => record.speciesIds.map((speciesId) => ({
        speciesId,
        targetSpecies: targetSpeciesIds.has(speciesId),
        evidenceKind: `DWR stocked trout ${record.evidenceKind}`,
        exactNamedWaterMatch: true,
        sourceAssociation: record.locationMatches.find((match) => match.locationId === location.id) ?? null,
        designation: record.designation,
        stockingSchedule: record.stockingSchedule,
        notes: record.notes,
        sourceObjectId: record.objectId,
        retrieved: stockedTrout.meta.retrieved,
        sourceUrls: stockedTrout.meta.sourceUrls,
        sourceCaveat: stockedTrout.meta.sourceCaveat,
        reviewStatus: record.objectId !== null && approvedStockedTroutIds.has(record.objectId)
          ? verdicts.recordReviews.dwrStockedTrout.verdict
          : "candidate-awaiting-adversarial-review",
      })));
    const accessDecision = verdicts.accessReviews.find((review) => review.locationId === location.id) ?? null;
    const priorClaimReviews = verdicts.priorClaimReviews.filter((review) => review.locationId === location.id);
    const sourceClaimRejections = verdicts.sourceClaimRejections.filter((review) => review.locationIds.includes(location.id));
    const sourceClaimReviews = verdicts.sourceClaimReviews.filter((review) => review.locationIds.includes(location.id));
    const manualClaimReviews = verdicts.manualClaims.filter((review) => review.locationId === location.id);
    const contradictionReviews = verdicts.contradictionReviews.filter((review) => review.locationId === location.id);
    const approvedManualClaims = manualClaimReviews.filter((review) => review.verdict.startsWith("approved-"));
    const currentApprovedManualClaims = approvedManualClaims.filter((review) => CURRENT_MANUAL_VERDICTS.has(review.verdict));
    const historicalApprovedManualClaims = approvedManualClaims.filter((review) => !CURRENT_MANUAL_VERDICTS.has(review.verdict));
    const independentlyApprovedSpeciesIds = new Set([
      ...habitatCandidates.filter((candidate) => candidate.reviewStatus.startsWith("approved-")).map((candidate) => candidate.speciesId),
      ...stockingCandidates.filter((candidate) => candidate.reviewStatus.startsWith("approved-")).map((candidate) => candidate.speciesId),
      ...currentApprovedManualClaims.map((claim) => claim.speciesId),
    ].filter((speciesId): speciesId is string => Boolean(speciesId)));

    const existingDirect = location.evidence.filter(direct);
    const priorClaimReviewFor = (record: Evidence) =>
      priorClaimReviews.find((review) =>
        review.speciesId === record.speciesId &&
        (!("sourceUrl" in review) || review.sourceUrl === record.sourceUrl)
      ) ??
      sourceClaimRejections.find((review) =>
        review.sourceUrl === record.sourceUrl && review.rejectedSpeciesIds.includes(record.speciesId)
      ) ??
      sourceClaimReviews.find((review) =>
        review.sourceUrl === record.sourceUrl && review.approvedSpeciesIds.includes(record.speciesId)
      ) ?? null;
    const unverifiedExistingDirect = existingDirect.filter((record) =>
      !priorClaimReviewFor(record) && !independentlyApprovedSpeciesIds.has(record.speciesId)
    );
    const targetCandidates = [
      ...candidates.filter((candidate) => candidate.targetSpecies),
      ...habitatCandidates.filter((candidate) => candidate.targetSpecies && candidate.reviewStatus !== "potential-use-area-do-not-promote"),
      ...stockingCandidates.filter((candidate) => candidate.targetSpecies),
    ];
    const evidenceQueue = unverifiedExistingDirect.length
      ? "existing-direct-claim-needs-reverification"
      : existingDirect.length
        ? "existing-direct-claims-reviewed"
      : currentApprovedManualClaims.length
        ? "manual-primary-source-claim-approved"
      : historicalApprovedManualClaims.length
        ? "historical-primary-source-only"
      : targetCandidates.length
        ? "direct-agency-candidate-found"
        : candidates.length || habitatCandidates.length
          ? "non-target-fish-candidate-found"
          : "no-direct-candidate-found";
    return {
      locationId: location.id,
      name: location.name,
      waterbody: location.waterbody,
      waterbodyType: location.waterbodyType,
      county: location.county,
      accessReview: {
        currentStatus: location.accessStatus ?? "verified",
        authority: location.accessAuthority ?? null,
        sourceUrl: location.accessSourceUrl ?? null,
        reviewStatus: "separate-access-review-required",
        decision: accessDecision,
      },
      evidenceQueue,
      releaseEligible: false,
      priorAgentClaims: location.evidence.map((record) => {
        const priorReview = priorClaimReviewFor(record);
        return ({
        speciesId: record.speciesId,
        evidenceType: record.evidenceType ?? null,
        modeled: modeledEvidence(record),
        summary: record.evidenceSummary ?? null,
        lastEvidence: record.lastEvidence ?? null,
        sourceName: record.sourceName ?? null,
        sourceUrl: record.sourceUrl ?? null,
        reviewStatus: direct(record)
          ? priorReview
            ? priorReview.verdict
            : independentlyApprovedSpeciesIds.has(record.speciesId)
            ? "corroborated-by-approved-agency-record"
            : "needs-adversarial-reverification"
          : "modeled-do-not-promote",
        review: priorReview,
      }); }),
      agencyObservationCandidates: candidates,
      agencyHabitatCandidates: habitatCandidates,
      agencyStockingCandidates: stockingCandidates,
      priorClaimReviews,
      sourceClaimRejections,
      sourceClaimReviews,
      manualClaimReviews,
      contradictionReviews,
      finalVerdict: "pending",
      reviewerNotes: [],
    };
  });

  const guessReliant = locations.filter((location) =>
    !location.priorAgentClaims.some((claim) => !claim.modeled),
  );
  const queueCounts = Object.fromEntries(
    [...new Set(locations.map((location) => location.evidenceQueue))].map((queue) => [
      queue,
      locations.filter((location) => location.evidenceQueue === queue).length,
    ]),
  );
  const targetCandidateCount = guessReliant.filter((location) =>
    location.agencyObservationCandidates.some((candidate) => candidate.targetSpecies) ||
    location.agencyHabitatCandidates.some((candidate) => candidate.targetSpecies && candidate.reviewStatus !== "potential-use-area-do-not-promote") ||
    location.agencyStockingCandidates.some((candidate) => candidate.targetSpecies),
  ).length;
  const nonTargetOnlyCount = guessReliant.filter((location) =>
    (location.agencyObservationCandidates.length > 0 || location.agencyHabitatCandidates.length > 0 || location.agencyStockingCandidates.length > 0) &&
    !location.agencyObservationCandidates.some((candidate) => candidate.targetSpecies) &&
    !location.agencyHabitatCandidates.some((candidate) => candidate.targetSpecies && candidate.reviewStatus !== "potential-use-area-do-not-promote") &&
    !location.agencyStockingCandidates.some((candidate) => candidate.targetSpecies),
  ).length;
  const noCandidateCount = guessReliant.filter((location) =>
    location.agencyObservationCandidates.length === 0 &&
    location.agencyHabitatCandidates.length === 0 &&
    location.agencyStockingCandidates.length === 0 &&
    !location.manualClaimReviews.some((claim) => claim.verdict.startsWith("approved-"))
  ).length;
  const historicalOnlyCount = guessReliant.filter((location) =>
    location.agencyObservationCandidates.length === 0 &&
    location.agencyHabitatCandidates.length === 0 &&
    location.agencyStockingCandidates.length === 0 &&
    location.manualClaimReviews.some((claim) =>
      claim.verdict.startsWith("approved-") && !CURRENT_MANUAL_VERDICTS.has(claim.verdict)
    ) &&
    !location.manualClaimReviews.some((claim) => CURRENT_MANUAL_VERDICTS.has(claim.verdict))
  ).length;
  const approvedClaimCount = locations.reduce((count, location) => count +
    location.agencyHabitatCandidates.filter((candidate) => candidate.reviewStatus.startsWith("approved-")).length +
    location.agencyStockingCandidates.filter((candidate) => candidate.reviewStatus.startsWith("approved-")).length +
    location.manualClaimReviews.filter((claim) => claim.verdict.startsWith("approved-")).length,
  0);
  const approvedClaimLocationCount = locations.filter((location) =>
    location.agencyHabitatCandidates.some((candidate) => candidate.reviewStatus.startsWith("approved-")) ||
    location.agencyStockingCandidates.some((candidate) => candidate.reviewStatus.startsWith("approved-")) ||
    location.manualClaimReviews.some((claim) => claim.verdict.startsWith("approved-")),
  ).length;
  const verifiedRuntimeClaimCount = locations.reduce((count, location) => count +
    location.priorAgentClaims.filter((claim) =>
      claim.reviewStatus === "corroborated-by-approved-agency-record" || claim.reviewStatus.startsWith("approved-")
    ).length,
  0);
  const unverifiedRuntimeDirectClaimCount = locations.reduce((count, location) => count +
    location.priorAgentClaims.filter((claim) => claim.reviewStatus === "needs-adversarial-reverification").length,
  0);
  const missingSourceRuntimeDirectClaimCount = locations.reduce((count, location) => count +
    location.priorAgentClaims.filter((claim) => !claim.modeled && !claim.sourceUrl).length,
  0);
  const rejectedClaimCount = verdicts.priorClaimReviews.filter((review) =>
    review.verdict.startsWith("removed-") || review.verdict.startsWith("rejected-")
  ).length + verdicts.sourceClaimRejections.reduce(
    (count, review) => count + review.locationIds.length * review.rejectedSpeciesIds.length,
    0,
  );
  const payload = {
    meta: {
      generated: localDate(),
      locationCount: locations.length,
      guessReliantLocationCount: guessReliant.length,
      policy: "Candidates never affect rankings until finalVerdict is approved after exact-water, species, date, provenance, contradiction, and access review.",
      priorAgentWork: "All existing seed evidence is retained under priorAgentClaims and explicitly queued for re-verification or quarantine.",
      vafwisSource: vafwis.meta,
      queueCounts,
      reviewProgress: {
        targetCandidateLocationCount: targetCandidateCount,
        nonTargetOnlyLocationCount: nonTargetOnlyCount,
        noCandidateLocationCount: noCandidateCount,
        historicalOnlyLocationCount: historicalOnlyCount,
        approvedClaimCount,
        approvedClaimLocationCount,
        verifiedRuntimeClaimCount,
        removedOrRejectedPriorClaimCount: rejectedClaimCount,
        unverifiedRuntimeDirectClaimCount,
        missingSourceRuntimeDirectClaimCount,
        newlyPromotedClaimCount: 0,
      },
    },
    locations,
  };

  const dataDir = resolve(here, "../docs/data");
  if (!CHECK) mkdirSync(dataDir, { recursive: true });
  writeOrCheck(resolve(dataDir, "fish-community-review-nova.json"), JSON.stringify(payload, null, 2) + "\n");

  const directRejections = [
    ...verdicts.priorClaimReviews
      .filter((review) => review.verdict.startsWith("removed-") || review.verdict.startsWith("rejected-"))
      .map((review) => ({
        locationId: review.locationId,
        speciesId: review.speciesId,
        sourceUrl: typeof review.sourceUrl === "string" ? review.sourceUrl : null,
        verdict: review.verdict,
      })),
    ...verdicts.sourceClaimRejections.flatMap((review) =>
      review.locationIds.flatMap((locationId) =>
        review.rejectedSpeciesIds.map((speciesId) => ({
          locationId,
          speciesId,
          sourceUrl: review.sourceUrl,
          verdict: review.verdict,
        })),
      ),
    ),
  ];
  const rejectionSnapshot = {
    meta: {
      generated: localDate(),
      source: "docs/data/fish-community-verdicts.json",
      policy: "Exact rejected claim triples are excluded from runtime; other evidence for the same species remains eligible for separate review.",
    },
    claims: directRejections,
  };
  const generatedDir = resolve(here, "../app/lib/generated");
  if (!CHECK) mkdirSync(generatedDir, { recursive: true });
  writeOrCheck(resolve(generatedDir, "evidence-rejections.json"), JSON.stringify(rejectionSnapshot, null, 2) + "\n");

  const markdown = `# Fish-community evidence review\n\n` +
    `Generated ${payload.meta.generated}. This is a review queue, not runtime evidence.\n\n` +
    `- ${locations.length} total catalog locations retained for adversarial review\n` +
    `- ${guessReliant.length} locations currently rely only on modeled/nearby evidence\n` +
    `- ${targetCandidateCount} guess-reliant locations now have exact-named-water agency target-fish candidates\n` +
    `- ${nonTargetOnlyCount} have exact-water agency records only for community fish without a reviewed target profile\n` +
    `- ${historicalOnlyCount} have exact-water historical primary-source records that are not promoted as current presence\n` +
    `- ${noCandidateCount} have no exact-water primary-source candidate and still require another source\n\n` +
    `- ${approvedClaimCount} exact-water claims across ${approvedClaimLocationCount} locations have passed the first adversarial source review\n` +
    `- ${verifiedRuntimeClaimCount} prior-agent claims already present in runtime are now independently verified or corroborated\n` +
    `- ${rejectedClaimCount} unsupported prior-agent claims have been removed or rejected\n` +
    `- ${unverifiedRuntimeDirectClaimCount} live direct claims still need adversarial re-verification\n` +
    `- ${missingSourceRuntimeDirectClaimCount} live direct claims are missing a source URL\n` +
    `- 0 newly researched candidate claims have been promoted into live rankings\n\n` +
    `## Promotion gate\n\n` +
    `A claim can be approved only after exact-water/segment, exact species, observation date, source provenance, contradictory evidence, and public-access status are reviewed. Automated candidates are never promoted by this script.\n`;
  writeOrCheck(resolve(here, "../docs/FISH_COMMUNITY_REVIEW.md"), markdown);
  console.log(
    `Built review ledger: ${guessReliant.length} guess-reliant; ${targetCandidateCount} target candidates; ` +
    `${nonTargetOnlyCount} non-target-only; ${noCandidateCount} unresolved.`,
  );
  if (CHECK && (unverifiedRuntimeDirectClaimCount || missingSourceRuntimeDirectClaimCount)) {
    throw new Error(
      `Direct evidence review incomplete: ${unverifiedRuntimeDirectClaimCount} unverified and ` +
      `${missingSourceRuntimeDirectClaimCount} missing source URLs.`,
    );
  }
}

main();
