import { getAccountUser } from "../../../lib/account-server";
import { isConfiguredAdmin } from "../../../lib/admin-auth";
import { validateHydrologyConnectionInput } from "../../../lib/hydrology-graph";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAccountUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!isConfiguredAdmin(user)) return Response.json({ error: "Administrator access required." }, { status: 403 });
  try {
    const { listD1HydrologyConnections } = await import("../../../lib/d1-hydrology-graph");
    return Response.json({ connections: await listD1HydrologyConnections() });
  } catch (error) {
    return storageError(error);
  }
}

export async function POST(request: Request) {
  const user = await getAccountUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!isConfiguredAdmin(user)) return Response.json({ error: "Administrator access required." }, { status: 403 });
  try {
    const checked = validateHydrologyConnectionInput(await request.json());
    if ("error" in checked) return Response.json({ error: checked.error }, { status: 400 });
    const { createD1HydrologyConnection } = await import("../../../lib/d1-hydrology-graph");
    return Response.json({ connection: await createD1HydrologyConnection(user, checked.input) }, { status: 201 });
  } catch (error) {
    if (String(error).toLowerCase().includes("unique")) {
      return Response.json({ error: "That directed node connection already exists." }, { status: 409 });
    }
    return storageError(error);
  }
}

function storageError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const missingMigration = /no such table|hydrology_connections/i.test(message);
  return Response.json({
    error: missingMigration
      ? "Hydrology graph storage is not ready. Apply the current database migration."
      : "Hydrology graph storage is temporarily unavailable.",
  }, { status: 503 });
}
