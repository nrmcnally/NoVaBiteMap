import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("build contains the BiteMap opportunity board product contract", async () => {
  const [page, dashboard, layout, data, apiClient, scoring] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/ExploreDashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/api.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/scoring.ts", import.meta.url), "utf8"),
  ]);
  await access(new URL("../dist/server/index.js", import.meta.url));
  assert.match(page, /ExploreDashboard/);
  assert.match(page, /fetchExploreCatalog/);
  assert.match(apiClient, /\/api\/explore/);
  assert.match(scoring, /runtimeSource === "canonical-api"/);
  assert.match(dashboard, /Find your next/);
  assert.match(dashboard, /useState<string\[\]>\(\[\]\)/);
  assert.match(dashboard, /useState\(false\)/);
  assert.match(dashboard, /Choose fish species/);
  assert.match(dashboard, /Keep-and-eat mode/);
  assert.match(dashboard, /scores are never averaged/i);
  assert.match(dashboard, /Water type/);
  assert.match(dashboard, /Starting address or ZIP/);
  assert.match(dashboard, /Google Maps directions/);
  assert.match(data, /Smallmouth bass/);
  assert.match(dashboard, /Access verified by official agency sources/);
  assert.match(layout, /BiteMap NOVA/);
  assert.doesNotMatch(`${page}${dashboard}${layout}`, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("favorites refresh live and data health is removed from public navigation", async () => {
  const [spots, nav, publicHealth, adminHealth] = await Promise.all([
    readFile(new URL("../app/my-spots/MySpotsClient.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/TopNav.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/data-health/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/data-health/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(spots, /cache: "no-store"/);
  assert.match(spots, /bitemap:favorites-changed/);
  assert.doesNotMatch(nav, /Data health/);
  assert.match(publicHealth, /notFound/);
  assert.match(adminHealth, /getAccountUser/);
});

test("alpha feedback is durable, attributed, and separated from evidence promotion", async () => {
  const [page, client, route, d1, schema, admin, nav, spot] = await Promise.all([
    readFile(new URL("../app/feedback/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/feedback/FeedbackClient.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/feedback/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/d1-feedback.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/data-health/DataHealthClient.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/TopNav.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/locations/[id]/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /Sign in to send feedback/);
  assert.match(client, /Send private feedback/);
  assert.match(client, /not fishing evidence/i);
  assert.match(route, /createD1AlphaFeedback/);
  assert.match(route, /\/api\/users\/me\/feedback/);
  assert.match(`${d1}${schema}`, /alpha_feedback/);
  assert.match(admin, /Alpha review queue/);
  assert.match(nav, /Send alpha feedback/);
  assert.match(spot, /Report spot data/);
});

test("alpha accounts use email and password with private cookie sessions", async () => {
  const [accountPage, register, login, logout, passwordAuth, dockerfile] = await Promise.all([
    readFile(new URL("../app/account/AccountClient.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/account/register/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/account/login/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/account/logout/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/password-auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../Dockerfile", import.meta.url), "utf8"),
  ]);
  assert.match(accountPage, /Create account/);
  assert.match(accountPage, /type="email"/);
  assert.match(`${register}${login}${logout}`, /httpOnly: true/);
  assert.match(`${register}${login}${logout}`, /sameSite: "lax"/);
  assert.match(passwordAuth, /PBKDF2_ITERATIONS = 600_000/);
  assert.match(passwordAuth, /SHA-256/);
  assert.match(dockerfile, /vinext\/dist\/cli\.js", "start"/);
});

test("private trip logs record actual spot and time without freezing a forecast", async () => {
  const [tripPage, tripClient, tripRoute, replayRoute, replay, d1Trips, schema, methodology] = await Promise.all([
    readFile(new URL("../app/trips/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/trips/TripLogClient.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/trips/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/trips/[id]/replay/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/historical-replay.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/d1-fishing-trips.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/methodology/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(tripPage, /does not freeze a forecast/i);
  assert.match(tripClient, /type="datetime-local"/);
  assert.match(tripClient, /A zero-catch trip is useful data too/);
  assert.match(tripRoute, /That species is not evidenced at this BiteMap spot/);
  assert.match(`${tripRoute}${d1Trips}`, /validationEligible: false/);
  assert.match(schema, /first-party-alpha-trip-log/);
  assert.match(tripClient, /Reconstruct conditions/);
  assert.match(replay, /modeled-historical-forecast/);
  assert.match(replay, /No manually verified USGS station relationship/);
  assert.match(replayRoute, /locationId: trip\.locationId[\s\S]*startedAt: trip\.startedAt[\s\S]*endedAt: trip\.endedAt/);
  assert.doesNotMatch(replay, /catchCount|lureOrBait|validationEligible/);
  assert.doesNotMatch(`${tripRoute}${d1Trips}${schema}`, /environmentSnapshot|snapshotId/);
  assert.match(methodology, /calibration evidence, not proof/i);
  assert.match(methodology, /Open-Meteo modeled history/);
  assert.match(methodology, /manually mapped USGS station/);
});

test("methodology explains the score without exposing provider health", async () => {
  const methodology = await readFile(new URL("../app/methodology/page.tsx", import.meta.url), "utf8");
  assert.match(methodology, /A useful forecast should show its work/);
  assert.match(methodology, /not a catch probability/i);
  assert.match(methodology, /No evidence = no ranking/);
  assert.match(methodology, /strongest supported target/);
  assert.match(methodology, /one labeled regional weather anchor/i);
  assert.match(methodology, /Times beyond the provider/);
  assert.doesNotMatch(methodology, /Inspect provider health|data-health/);
});

test("source code preserves the species gate, provenance, and precise advisory language", async () => {
  const [scoring, conditions, data, coverage, advisories] = await Promise.all([
    readFile(new URL("../app/lib/scoring.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/conditions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/coverage-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/advisories.ts", import.meta.url), "utf8"),
  ]);
  assert.match(scoring, /Math\.pow\(evidence\.availability, 1\.5\)/);
  assert.match(conditions, /did not create a fallback observation/);
  assert.match(data, /Public access is verified by Virginia DWR/);
  assert.match(advisories, /PotomacRiver_2026-1\.pdf/);
  assert.match(advisories, /ShenandoahRiver_2025\.pdf/);
  assert.match(advisories, /18 inches or longer/);
  assert.match(advisories, /no-selected-species-match/);
  assert.match(advisories, /not a general safety guarantee/i);
  assert.match(advisories, /consumptionAdviceFor/);
  assert.match(coverage, /Lake Fairfax Park/);
  assert.match(coverage, /Gravelly Point/);
  assert.match(coverage, /accessAuthority/);
  assert.equal((coverage.match(/verifiedLocation\(\{ id:/g) ?? []).length, 90);
});

test("live public-data spine includes canonical science forecast, hydrology, multi-day weather, trout, and Aquatic GAP", async () => {
  const [hydrology, conditions, nwsSource, canonical, detail, publicEvidence, importer, gap, trout] = await Promise.all([
    readFile(new URL("../app/api/hydrology/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/conditions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/server/nws.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/live-forecast/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/LocationIntelligence.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/public-evidence.ts", import.meta.url), "utf8"),
    readFile(new URL("../apps/api/app/ingestion/public_data.py", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/generated/aquatic-gap-nova.json", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/generated/dwr-trout-nova.json", import.meta.url), "utf8"),
  ]);
  assert.match(hydrology, /manually verified USGS association/i);
  assert.match(hydrology, /stale-while-revalidate=1800/);
  assert.match(nwsSource, /slice\(0, 120\)/);
  assert.match(nwsSource, /alerts/);
  assert.match(conditions, /fetchNwsConditions/);
  assert.match(canonical, /\/forecast/);
  assert.match(detail, /Today through day five/);
  assert.match(detail, /Canonical science model/);
  assert.match(detail, /estimated-regional/);
  assert.match(detail, /air temperature is shown but is not treated as water temperature/i);
  assert.match(publicEvidence, /nearby historic stream evidence, not proof at the access point/i);
  assert.match(publicEvidence, /designated stocked-water layer/);
  assert.match(importer, /dataset_md5/);
  assert.match(gap, /"sampleCount": 225/);
  assert.match(trout, /"waterCount": 13/);
});

test("forecast capability contracts bound timeline selection and keep snapshots species-agnostic", async () => {
  const [capabilities, snapshot, contracts, service] = await Promise.all([
    readFile(new URL("../app/api/forecast-capabilities/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/environmental-snapshot/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/environmental-snapshot.ts", import.meta.url), "utf8"),
    readFile(new URL("../apps/api/app/services/forecast_capabilities.py", import.meta.url), "utf8"),
  ]);
  assert.match(contracts, /forecast-capabilities-v0\.1\.0/);
  assert.match(contracts, /environmental-snapshot-v0\.1\.0/);
  assert.match(service, /unsupportedFutureDisabled/);
  assert.match(service, /selectedTimestampExplicit/);
  assert.match(service, /speciesAgnostic/);
  assert.match(service, /scoreIncluded/);
  assert.match(capabilities, /forecast-capabilities/);
  assert.match(snapshot, /time is outside the supported forecast window/i);
  assert.doesNotMatch(service, /catchCount|lureOrBait/);
});

test("Explore timeline uses a precomputed score matrix for the map, list, and menu", async () => {
  const [dashboard, timeline, timelineContract, matrixContract, matrixRoute, map, scoring] = await Promise.all([
    readFile(new URL("../app/components/ExploreDashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/PredictionTimeline.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/prediction-timeline.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/timeline-score-matrix.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/timeline-scores/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/FishingMap.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/scoring.ts", import.meta.url), "utf8"),
  ]);
  assert.match(dashboard, /selectionFromSearch\(window\.location\.search, periods\)/);
  assert.doesNotMatch(dashboard, /history\.replaceState|selectionSearch\(url\.search/);
  assert.match(dashboard, /selectedScoresFromMatrix/);
  assert.match(dashboard, /setScoringTimelineSelection\(timelineSelection\)/);
  assert.match(dashboard, /\/api\/timeline-scores/);
  assert.doesNotMatch(dashboard, /opportunityForForecast/);
  assert.match(dashboard, /opportunities=\{mapOpportunities\}/);
  assert.match(timeline, /Times beyond this boundary are unavailable/);
  assert.match(timeline, /type="range"/);
  assert.match(timeline, /each species uses its best supported hour/);
  assert.match(timelineContract, /periods\.find\(\(item\) => item\.startTime === selection\.key\)/);
  assert.match(matrixContract, /timeline-score-matrix-v0\.1\.0/);
  assert.match(matrixContract, /dailyBestPeriodIndexes/);
  assert.match(matrixRoute, /canonicalMatrix/);
  assert.match(matrixRoute, /bundledMatrix/);
  assert.match(matrixRoute, /x-bitemap-timeline-cache/);
  assert.match(map, /opportunities\.get\(location\.id\)/);
  assert.doesNotMatch(map, /opportunityFor\(/);
  assert.match(scoring, /profileFor\(speciesId\)/);
  assert.match(scoring, /seasonalActivityByMonth/);
});

test("spot details separate bite forecasts from presence-only fish and link every state to the guide", async () => {
  const [spot, whatsBiting] = await Promise.all([
    readFile(new URL("../app/locations/[id]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/WhatsBiting.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(spot, /Prefer direct documentation over modeled evidence/);
  assert.match(whatsBiting, /Bite forecast/);
  assert.match(whatsBiting, /Present in the evidence · no bite forecast/);
  assert.match(whatsBiting, /Nearby or modeled records · not confirmed here/);
  assert.match(whatsBiting, /none are labeled as biting or not biting/i);
  assert.match(whatsBiting, /Open fish guide/);
});
