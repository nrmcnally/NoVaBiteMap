import { getAccountUser } from "../../../../lib/account-server";
import { isConfiguredAdmin } from "../../../../lib/admin-auth";
import { validateHydrologyConnectionInput } from "../../../../lib/hydrology-graph";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: RouteContext) {
  const user = await getAccountUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!isConfiguredAdmin(user)) return Response.json({ error: "Administrator access required." }, { status: 403 });
  try {
    const checked = validateHydrologyConnectionInput(await request.json());
    if ("error" in checked) return Response.json({ error: checked.error }, { status: 400 });
    const { id } = await context.params;
    const { updateD1HydrologyConnection } = await import("../../../../lib/d1-hydrology-graph");
    const connection = await updateD1HydrologyConnection(id, user, checked.input);
    return connection
      ? Response.json({ connection })
      : Response.json({ error: "Connection not found." }, { status: 404 });
  } catch (error) {
    if (String(error).toLowerCase().includes("unique")) {
      return Response.json({ error: "That directed node connection already exists." }, { status: 409 });
    }
    return Response.json({ error: "Unable to update the connection." }, { status: 503 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getAccountUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!isConfiguredAdmin(user)) return Response.json({ error: "Administrator access required." }, { status: 403 });
  try {
    const { id } = await context.params;
    const { deleteD1HydrologyConnection } = await import("../../../../lib/d1-hydrology-graph");
    return await deleteD1HydrologyConnection(id)
      ? new Response(null, { status: 204 })
      : Response.json({ error: "Connection not found." }, { status: 404 });
  } catch {
    return Response.json({ error: "Unable to delete the connection." }, { status: 503 });
  }
}
