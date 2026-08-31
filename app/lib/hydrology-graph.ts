import { locationById } from "./data";

export const hydrologyFlowKinds = ["downstream", "tidal", "uncertain"] as const;
export type HydrologyFlowKind = typeof hydrologyFlowKinds[number];
export const hydrologyDirectionBases = ["manual", "elevation-clear", "elevation-marginal", "unknown", "tidal"] as const;
export type HydrologyDirectionBasis = typeof hydrologyDirectionBases[number];
export type HydrologyCoordinate = [number, number];

export type HydrologyConnection = {
  id: string;
  fromLocationId: string;
  toLocationId: string;
  flowKind: HydrologyFlowKind;
  directionBasis: HydrologyDirectionBasis;
  elevationDropFeet: number | null;
  path: HydrologyCoordinate[];
  notes: string | null;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
};

export type HydrologyConnectionInput = {
  fromLocationId: string;
  toLocationId: string;
  flowKind: HydrologyFlowKind;
  directionBasis: HydrologyDirectionBasis;
  elevationDropFeet: number | null;
  path: HydrologyCoordinate[];
  notes: string | null;
};

export function validateHydrologyConnectionInput(value: unknown):
  | { input: HydrologyConnectionInput }
  | { error: string } {
  if (!value || typeof value !== "object") return { error: "Connection data is required." };
  const body = value as Record<string, unknown>;
  const fromLocationId = typeof body.fromLocationId === "string" ? body.fromLocationId : "";
  const toLocationId = typeof body.toLocationId === "string" ? body.toLocationId : "";
  const from = locationById(fromLocationId);
  const to = locationById(toLocationId);
  if (!from || !to) return { error: "Choose two valid BiteMap nodes." };
  if (from.id === to.id) return { error: "A connection needs two different nodes." };

  const flowKind = hydrologyFlowKinds.includes(body.flowKind as HydrologyFlowKind)
    ? body.flowKind as HydrologyFlowKind
    : null;
  if (!flowKind) return { error: "Choose a valid flow type." };
  const directionBasis = hydrologyDirectionBases.includes(body.directionBasis as HydrologyDirectionBasis)
    ? body.directionBasis as HydrologyDirectionBasis
    : "unknown";
  const rawDrop = body.elevationDropFeet;
  const elevationDropFeet = rawDrop === null || rawDrop === undefined ? null : Number(rawDrop);
  if (elevationDropFeet !== null && (!Number.isFinite(elevationDropFeet) || elevationDropFeet < 0 || elevationDropFeet > 10000)) {
    return { error: "The elevation drop is invalid." };
  }
  if (!Array.isArray(body.path) || body.path.length < 2) {
    return { error: "Trace a path between the two nodes." };
  }
  if (body.path.length > 300) return { error: "A path can contain at most 300 points." };

  const path: HydrologyCoordinate[] = [];
  for (const point of body.path) {
    if (!Array.isArray(point) || point.length !== 2) return { error: "Every path point needs latitude and longitude." };
    const lat = Number(point[0]);
    const lng = Number(point[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return { error: "The path contains an invalid coordinate." };
    }
    path.push([roundCoordinate(lat), roundCoordinate(lng)]);
  }

  // Fishing locations are the graph nodes. Always snap the stored endpoints to
  // their canonical coordinates so hand-drawn geometry cannot detach from them.
  path[0] = [from.lat, from.lng];
  path[path.length - 1] = [to.lat, to.lng];
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  if (notes.length > 500) return { error: "Notes must be 500 characters or fewer." };

  return {
    input: {
      fromLocationId: from.id,
      toLocationId: to.id,
      flowKind,
      directionBasis: flowKind === "tidal" ? "tidal" : directionBasis,
      elevationDropFeet: elevationDropFeet === null ? null : Math.round(elevationDropFeet * 10) / 10,
      path,
      notes: notes || null,
    },
  };
}

function roundCoordinate(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}
