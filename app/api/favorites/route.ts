import { desc, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { savedLocations } from "../../../db/schema";
import { locationById, speciesById } from "../../lib/data";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  try {
    const favorites = await getDb()
      .select()
      .from(savedLocations)
      .where(eq(savedLocations.userEmail, user.email))
      .orderBy(savedLocations.sortOrder, desc(savedLocations.updatedAt));
    return Response.json({ favorites });
  } catch (error) {
    return databaseError(error);
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  try {
    const body = await request.json() as {
      locationId?: string;
      preferredSpecies?: string;
      nickname?: string;
      notes?: string;
      accessMethod?: string;
    };
    if (!body.locationId || !locationById(body.locationId)) {
      return Response.json({ error: "A valid verified location is required." }, { status: 400 });
    }
    if (body.preferredSpecies && !speciesById(body.preferredSpecies)) {
      return Response.json({ error: "Unknown species." }, { status: 400 });
    }
    const clean = (value?: string, max = 240) => value?.trim().slice(0, max) || null;
    const [favorite] = await getDb()
      .insert(savedLocations)
      .values({
        userEmail: user.email,
        locationId: body.locationId,
        preferredSpecies: body.preferredSpecies ?? null,
        nickname: clean(body.nickname, 80),
        notes: clean(body.notes, 1000),
        accessMethod: clean(body.accessMethod, 20),
      })
      .onConflictDoUpdate({
        target: [savedLocations.userEmail, savedLocations.locationId],
        set: {
          preferredSpecies: body.preferredSpecies ?? null,
          nickname: clean(body.nickname, 80),
          notes: clean(body.notes, 1000),
          accessMethod: clean(body.accessMethod, 20),
          updatedAt: new Date().toISOString(),
        },
      })
      .returning();
    return Response.json({ favorite }, { status: 201 });
  } catch (error) {
    return databaseError(error);
  }
}

function databaseError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected database error";
  const migrationMissing = message.includes("no such table") || message.includes("saved_locations");
  return Response.json({
    error: migrationMissing ? "Favorite storage migration has not been applied yet." : "Favorite storage is unavailable.",
  }, { status: 503 });
}

