import { locationById, speciesById } from "../../lib/data";
import {
  accountBackend,
  getAccountUser,
  listAccountFavorites,
  normalizePasswordFavorite,
  passwordApiRequest,
  passwordSessionToken,
  responseErrorMessage,
} from "../../lib/account-server";

export async function GET() {
  const user = await getAccountUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  try {
    return Response.json({ favorites: await listAccountFavorites() });
  } catch (error) {
    return databaseError(error);
  }
}

export async function POST(request: Request) {
  const user = await getAccountUser();
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

    if (accountBackend() === "api") {
      const token = await passwordSessionToken();
      if (!token) return Response.json({ error: "Sign in required." }, { status: 401 });
      const response = await passwordApiRequest("/api/users/me/favorites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          location_id: body.locationId,
          preferred_species_id: body.preferredSpecies ?? null,
          nickname: clean(body.nickname, 80),
          notes: clean(body.notes, 1000),
          default_access_method: clean(body.accessMethod, 20),
        }),
      }, token);
      if (!response.ok) {
        return Response.json({ error: await responseErrorMessage(response, "Unable to save this spot.") }, { status: response.status });
      }
      const favorite = normalizePasswordFavorite(await response.json());
      return Response.json({ favorite }, { status: 201 });
    }

    const [{ getDb }, { savedLocations }] = await Promise.all([
      import("../../../db"),
      import("../../../db/schema"),
    ]);
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

function clean(value?: string, max = 240) {
  return value?.trim().slice(0, max) || null;
}

function databaseError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected database error";
  const migrationMissing = message.includes("no such table") || message.includes("saved_locations");
  return Response.json({
    error: migrationMissing ? "Favorite storage migration has not been applied yet." : "Favorite storage is unavailable.",
  }, { status: 503 });
}
