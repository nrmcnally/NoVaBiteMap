import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  accountBackend,
  passwordApiRequest,
  passwordSessionToken,
  responseErrorMessage,
  sessionCookieSecure,
} from "../../lib/account-server";

export async function DELETE(request: Request) {
  const token = await passwordSessionToken();
  if (!token) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (accountBackend() === "d1") {
    const { deleteD1Account } = await import("../../lib/d1-accounts");
    if (!await deleteD1Account(token)) return Response.json({ error: "Sign in required." }, { status: 401 });
  } else {
    const response = await passwordApiRequest("/api/users/me", { method: "DELETE" }, token);
    if (!response.ok) {
      return Response.json({ error: await responseErrorMessage(response, "Unable to delete the account.") }, { status: response.status });
    }
  }
  (await cookies()).set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: sessionCookieSecure(request),
    maxAge: 0,
    path: "/",
  });
  return new Response(null, { status: 204 });
}
