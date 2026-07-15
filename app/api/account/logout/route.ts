import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  accountBackend,
  passwordApiRequest,
  passwordSessionToken,
  sessionCookieSecure,
} from "../../../lib/account-server";

export async function POST(request: Request) {
  const token = await passwordSessionToken();
  try {
    if (token && accountBackend() === "d1") {
      const { logoutD1Session } = await import("../../../lib/d1-accounts");
      await logoutD1Session(token);
    } else if (token) {
      await passwordApiRequest("/api/auth/logout", { method: "POST" }, token);
    }
  } catch {
    // Clearing the browser cookie still signs this device out. Expired orphaned
    // sessions are pruned the next time a new hosted session is created.
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
