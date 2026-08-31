import { asc, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { hydrologyConnections } from "../../db/schema";
import type { AccountUser } from "./account-server";
import type { HydrologyConnection, HydrologyConnectionInput, HydrologyCoordinate, HydrologyDirectionBasis, HydrologyFlowKind } from "./hydrology-graph";

export async function listD1HydrologyConnections(): Promise<HydrologyConnection[]> {
  const rows = await getDb().select().from(hydrologyConnections).orderBy(asc(hydrologyConnections.createdAt));
  return rows.map(normalizeConnection);
}

export async function createD1HydrologyConnection(
  user: AccountUser,
  input: HydrologyConnectionInput,
): Promise<HydrologyConnection> {
  const now = new Date().toISOString();
  const [row] = await getDb().insert(hydrologyConnections).values({
    id: crypto.randomUUID(),
    fromLocationId: input.fromLocationId,
    toLocationId: input.toLocationId,
    flowKind: input.flowKind,
    directionBasis: input.directionBasis,
    elevationDropFeet: input.elevationDropFeet,
    pathJson: JSON.stringify(input.path),
    notes: input.notes,
    createdByEmail: user.email,
    createdAt: now,
    updatedAt: now,
  }).returning();
  return normalizeConnection(row);
}

export async function updateD1HydrologyConnection(
  id: string,
  user: AccountUser,
  input: HydrologyConnectionInput,
): Promise<HydrologyConnection | null> {
  const [row] = await getDb().update(hydrologyConnections).set({
    fromLocationId: input.fromLocationId,
    toLocationId: input.toLocationId,
    flowKind: input.flowKind,
    directionBasis: input.directionBasis,
    elevationDropFeet: input.elevationDropFeet,
    pathJson: JSON.stringify(input.path),
    notes: input.notes,
    createdByEmail: user.email,
    updatedAt: new Date().toISOString(),
  }).where(eq(hydrologyConnections.id, id)).returning();
  return row ? normalizeConnection(row) : null;
}

export async function deleteD1HydrologyConnection(id: string): Promise<boolean> {
  const rows = await getDb().delete(hydrologyConnections).where(eq(hydrologyConnections.id, id)).returning({ id: hydrologyConnections.id });
  return rows.length > 0;
}

function normalizeConnection(row: typeof hydrologyConnections.$inferSelect): HydrologyConnection {
  return {
    id: row.id,
    fromLocationId: row.fromLocationId,
    toLocationId: row.toLocationId,
    flowKind: normalizeFlowKind(row.flowKind),
    directionBasis: normalizeDirectionBasis(row.directionBasis),
    elevationDropFeet: row.elevationDropFeet,
    path: parsePath(row.pathJson),
    notes: row.notes,
    createdByEmail: row.createdByEmail,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function normalizeFlowKind(value: string): HydrologyFlowKind {
  return value === "tidal" || value === "uncertain" ? value : "downstream";
}

function normalizeDirectionBasis(value: string): HydrologyDirectionBasis {
  if (value === "manual" || value === "elevation-clear" || value === "elevation-marginal" || value === "tidal") return value;
  return "unknown";
}

function parsePath(value: string): HydrologyCoordinate[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((point): point is [number, number] => Array.isArray(point) && point.length === 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]))
      .map(([lat, lng]) => [lat, lng]);
  } catch {
    return [];
  }
}
