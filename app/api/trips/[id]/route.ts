import {
  accountBackend,
  getAccountUser,
  passwordApiRequest,
  passwordSessionToken,
  responseErrorMessage,
} from "../../../lib/account-server";

type TripRouteProps = { params: Promise<{ id: string }> };

export async function DELETE(_: Request, { params }: TripRouteProps) {
  const user = await getAccountUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  if (!id || id.length > 64) return Response.json({ error: "Invalid trip id." }, { status: 400 });
  try {
    if (accountBackend() === "d1") {
      const { deleteD1FishingTrip } = await import("../../../lib/d1-fishing-trips");
      if (!await deleteD1FishingTrip(user, id)) return Response.json({ error: "Trip not found." }, { status: 404 });
      return new Response(null, { status: 204 });
    }
    const token = await passwordSessionToken();
    if (!token) return Response.json({ error: "Sign in required." }, { status: 401 });
    const response = await passwordApiRequest(`/api/users/me/fishing-trips/${encodeURIComponent(id)}`, { method: "DELETE" }, token);
    if (!response.ok) {
      return Response.json({ error: await responseErrorMessage(response, "Unable to delete trip log.") }, { status: response.status });
    }
    return new Response(null, { status: 204 });
  } catch {
    return Response.json({ error: "Trip-log storage is unavailable." }, { status: 503 });
  }
}
