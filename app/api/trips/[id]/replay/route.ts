import {
  accountBackend,
  getAccountUser,
  normalizePasswordFishingTrip,
  passwordApiRequest,
  passwordSessionToken,
  responseErrorMessage,
  type AccountFishingTrip,
  type PasswordFishingTripResponse,
} from "../../../../lib/account-server";
import { reconstructHistoricalConditions } from "../../../../lib/historical-replay";

type ReplayRouteProps = { params: Promise<{ id: string }> };

export async function POST(_: Request, { params }: ReplayRouteProps) {
  const user = await getAccountUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  if (!id || id.length > 64) return Response.json({ error: "Invalid trip id." }, { status: 400 });

  try {
    if (accountBackend() === "d1") {
      const { getD1FishingTrip, saveD1ConditionReplay } = await import("../../../../lib/d1-fishing-trips");
      const trip = await getD1FishingTrip(user, id);
      if (!trip) return Response.json({ error: "Trip not found." }, { status: 404 });
      const replay = await replayForTrip(trip);
      const updated = await saveD1ConditionReplay(user, id, replay);
      if (!updated) return Response.json({ error: "Trip not found." }, { status: 404 });
      return Response.json({ trip: updated });
    }

    const token = await passwordSessionToken();
    if (!token) return Response.json({ error: "Sign in required." }, { status: 401 });
    const listResponse = await passwordApiRequest(
      "/api/users/me/fishing-trips",
      { method: "GET" },
      token,
    );
    if (!listResponse.ok) {
      return Response.json({
        error: await responseErrorMessage(listResponse, "Unable to load this trip."),
      }, { status: listResponse.status });
    }
    const trips = (await listResponse.json() as PasswordFishingTripResponse[])
      .map(normalizePasswordFishingTrip);
    const trip = trips.find((item) => item.id === id);
    if (!trip) return Response.json({ error: "Trip not found." }, { status: 404 });
    const replay = await replayForTrip(trip);
    const updateResponse = await passwordApiRequest(
      `/api/users/me/fishing-trips/${encodeURIComponent(id)}/condition-replay`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          condition_replay_id: replay.replayId,
          condition_replay_status: replay.status,
          condition_replay_policy_version: replay.policyVersion,
          condition_replay: replay,
          condition_replayed_at: replay.reconstructedAt,
        }),
      },
      token,
    );
    if (!updateResponse.ok) {
      return Response.json({
        error: await responseErrorMessage(updateResponse, "Unable to save reconstructed conditions."),
      }, { status: updateResponse.status });
    }
    return Response.json({
      trip: normalizePasswordFishingTrip(await updateResponse.json() as PasswordFishingTripResponse),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const migrationMissing = message.includes("no such column") || message.includes("condition_replay");
    return Response.json({
      error: migrationMissing
        ? "Condition-replay storage migration has not been applied yet."
        : "Historical conditions could not be reconstructed.",
    }, { status: 503 });
  }
}

function replayForTrip(trip: AccountFishingTrip) {
  return reconstructHistoricalConditions({
    locationId: trip.locationId,
    startedAt: trip.startedAt,
    endedAt: trip.endedAt,
  });
}
