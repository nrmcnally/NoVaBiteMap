import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../app/lib/advisories.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const advisories = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("Occoquan rules follow the selected species", () => {
  const base = advisories.advisoryForLocation({ id: "fountainhead", waterbody: "Occoquan Reservoir" });
  const largemouth = advisories.consumptionAdviceFor(base, ["largemouth-bass"]);
  const bluegill = advisories.consumptionAdviceFor(base, ["bluegill"]);
  const walleye = advisories.consumptionAdviceFor(base, ["walleye"]);

  assert.equal(largemouth.status, "active");
  assert.equal(largemouth.matchingRestrictions[0].severity, "do-not-eat");
  assert.equal(bluegill.matchingRestrictions[0].severity, "two-meals-per-month");
  assert.equal(walleye.status, "no-selected-species-match");
});

test("channel catfish keeps both Potomac size-qualified rules", () => {
  const base = advisories.advisoryForLocation({ id: "pohick-bay", waterbody: "Pohick Bay" });
  const channel = advisories.consumptionAdviceFor(base, ["channel-catfish"]);

  assert.equal(channel.status, "active");
  assert.deepEqual(
    new Set(channel.matchingRestrictions.map((rule) => rule.sizeQualifier)),
    new Set(["18 inches or longer", "shorter than 18 inches"]),
  );
});

test("Shenandoah access points use distinct official boundaries", () => {
  const bentonville = advisories.advisoryForLocation({ id: "bentonville", waterbody: "South Fork Shenandoah River" });
  const morgans = advisories.advisoryForLocation({ id: "morgans-ford", waterbody: "Main Stem Shenandoah River" });
  const catletts = advisories.advisoryForLocation({ id: "catletts-ford", waterbody: "North Fork Shenandoah River" });

  assert.deepEqual(bentonville.segments.map((segment) => segment.id), ["shenandoah-mercury"]);
  assert.deepEqual(morgans.segments.map((segment) => segment.id), ["shenandoah-pcb-lower-reaches"]);
  assert.equal(advisories.consumptionAdviceFor(morgans, ["walleye"]).status, "no-selected-species-match");
  assert.equal(advisories.consumptionAdviceFor(morgans, ["white-sucker"]).status, "active");
  assert.equal(advisories.consumptionAdviceFor(morgans, ["rock-bass"]).status, "active");
  assert.equal(advisories.consumptionAdviceFor(morgans, ["green-sunfish"]).status, "active");
  assert.equal(catletts.status, "no-advisory-found");
});

test("uncertain boundaries are never treated as advisory-free", () => {
  const upperOccoquan = advisories.advisoryForLocation({ id: "occoquan-hand-carry", waterbody: "Occoquan River" });
  const potomac = advisories.advisoryForLocation({ id: "riverbend-park", waterbody: "Potomac River" });

  assert.equal(upperOccoquan.status, "jurisdiction-check");
  assert.equal(potomac.status, "jurisdiction-check");
});
