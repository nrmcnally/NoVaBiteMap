import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("build contains the BiteMap opportunity board product contract", async () => {
  const [page, dashboard, layout, data] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/ExploreDashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/data.ts", import.meta.url), "utf8"),
  ]);
  await access(new URL("../dist/server/index.js", import.meta.url));
  assert.match(page, /ExploreDashboard/);
  assert.match(dashboard, /Find your next/);
  assert.match(dashboard, /useState\(""\)/);
  assert.match(dashboard, /useState\(false\)/);
  assert.match(dashboard, /Choose a fish species/);
  assert.match(dashboard, /Starting address or ZIP/);
  assert.match(dashboard, /Google Maps directions/);
  assert.match(data, /Smallmouth bass/);
  assert.match(dashboard, /Access verified by Virginia DWR/);
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
  assert.match(adminHealth, /requireChatGPTUser/);
});

test("methodology explains the score without calling it a probability", async () => {
  const methodology = await readFile(new URL("../app/methodology/page.tsx", import.meta.url), "utf8");
  assert.match(methodology, /A useful forecast should show its work/);
  assert.match(methodology, /not a catch probability/i);
  assert.match(methodology, /No evidence = no ranking/);
});

test("source code preserves the species gate and missing-data language", async () => {
  const [scoring, conditions, data] = await Promise.all([
    readFile(new URL("../app/lib/scoring.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/conditions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/data.ts", import.meta.url), "utf8"),
  ]);
  assert.match(scoring, /Math\.pow\(evidence\.availability, 1\.5\)/);
  assert.match(conditions, /did not create a fallback observation/);
  assert.match(data, /Public access is verified by Virginia DWR/);
});
