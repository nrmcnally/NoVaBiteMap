import { and, eq } from "drizzle-orm";
import {
  accountBackend,
  getAccountUser,
  passwordApiRequest,
  passwordSessionToken,
  responseErrorMessage,
} from "../../../lib/account-server";

type FavoriteRouteProps = { params: Promise<{ id: string }> };

export async function DELETE(_: Request, { params }: FavoriteRouteProps) {
  const user = await getAccountUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  const favoriteId = Number(id);
  if (!Number.isInteger(favoriteId)) return Response.json({ error: "Invalid favorite id." }, { status: 400 });
  try {
    if (accountBackend() === "api") {
      const token = await passwordSessionToken();
      if (!token) return Response.json({ error: "Sign in required." }, { status: 401 });
      const response = await passwordApiRequest(`/api/users/me/favorites/${favoriteId}`, { method: "DELETE" }, token);
      if (!response.ok) {
        return Response.json({ error: await responseErrorMessage(response, "Unable to remove this spot.") }, { status: response.status });
      }
      return new Response(null, { status: 204 });
    }

    const [{ getDb }, { savedLocations }] = await Promise.all([
      import("../../../../db"),
      import("../../../../db/schema"),
    ]);
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
