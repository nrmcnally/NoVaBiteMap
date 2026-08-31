import assert from "node:assert/strict";
import test from "node:test";
import { locations } from "../app/lib/data";
import { validateHydrologyConnectionInput } from "../app/lib/hydrology-graph";

const first = locations[0];
const second = locations.find((location) => location.id !== first.id)!;

test("hydrology paths snap hand-drawn endpoints to canonical fishing nodes", () => {
  const result = validateHydrologyConnectionInput({
    fromLocationId: first.id,
    toLocationId: second.id,
    flowKind: "downstream",
    directionBasis: "elevation-clear",
    elevationDropFeet: 17.26,
    path: [[0, 0], [38.9, -77.5], [1, 1]],
    notes: "  traced along the channel  ",
  });
  assert.ok("input" in result);
  assert.deepEqual(result.input.path[0], [first.lat, first.lng]);
  assert.deepEqual(result.input.path.at(-1), [second.lat, second.lng]);
  assert.equal(result.input.elevationDropFeet, 17.3);
  assert.equal(result.input.notes, "traced along the channel");
});

test("tidal connections never masquerade as elevation-directed flow", () => {
  const result = validateHydrologyConnectionInput({
    fromLocationId: first.id,
    toLocationId: second.id,
    flowKind: "tidal",
    directionBasis: "elevation-clear",
    elevationDropFeet: null,
    path: [[first.lat, first.lng], [second.lat, second.lng]],
  });
  assert.ok("input" in result);
  assert.equal(result.input.directionBasis, "tidal");
});

test("hydrology paths reject invalid or self-referential graph edges", () => {
  const selfEdge = validateHydrologyConnectionInput({
    fromLocationId: first.id,
    toLocationId: first.id,
    flowKind: "uncertain",
    path: [[first.lat, first.lng], [first.lat, first.lng]],
  });
  assert.deepEqual(selfEdge, { error: "A connection needs two different nodes." });

  const invalidCoordinate = validateHydrologyConnectionInput({
    fromLocationId: first.id,
    toLocationId: second.id,
    flowKind: "uncertain",
    path: [[first.lat, first.lng], [999, second.lng]],
  });
  assert.deepEqual(invalidCoordinate, { error: "The path contains an invalid coordinate." });
});
