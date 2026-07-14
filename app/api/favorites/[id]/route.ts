import { and, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDb } from "../../../../db";
import { savedLocations } from "../../../../db/schema";

type FavoriteRouteProps = { params: Promise<{ id: string }> };

export async function DELETE(_: Request, { params }: FavoriteRouteProps) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  const favoriteId = Number(id);
  if (!Number.isInteger(favoriteId)) return Response.json({ error: "Invalid favorite id." }, { status: 400 });
  try {
    const removed = await getDb()
      .delete(savedLocations)
      .where(and(eq(savedLocations.id, favoriteId), eq(savedLocations.userEmail, user.email)))
      .returning({ id: savedLocations.id });
    if (!removed.length) return Response.json({ error: "Favorite not found." }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch {
    return Response.json({ error: "Favorite storage is unavailable." }, { status: 503 });
  }
}

