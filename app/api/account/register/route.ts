import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  accountBackend,
  passwordApiRequest,
  responseErrorMessage,
  sessionCookieSecure,
} from "../../../lib/account-server";

type TokenResponse = {
  access_token: string;
  user: { id: number; email: string; display_name: string | null };
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    email?: string;
    password?: string;
    displayName?: string;
  } | null;
  if (!body?.email || !body.password) {
    return Response.json({ error: "Email and password are required." }, { status: 400 });
  }
  if (body.password.length < 12) {
    return Response.json({ error: "Use a password with at least 12 characters." }, { status: 400 });
  }
  let token: string;
  let user: { id: number; email: string; displayName: string; provider: "password" };
  if (accountBackend() === "d1") {
    const { D1AccountError, createD1Account } = await import("../../../lib/d1-accounts");
    try {
      const result = await createD1Account(body.email, body.password, body.displayName);
      token = result.token;
      user = result.user as typeof user;
    } catch (error) {
      if (error instanceof D1AccountError) return Response.json({ error: error.message }, { status: error.status });
      return Response.json({ error: "Account storage is unavailable." }, { status: 503 });
    }
  } else {
    const response = await passwordApiRequest("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: body.email,
        password: body.password,
        display_name: body.displayName?.trim() || null,
      }),
    });
    if (!response.ok) {
      return Response.json({ error: await responseErrorMessage(response, "Unable to create the account.") }, { status: response.status });
    }
    const result = await response.json() as TokenResponse;
    token = result.access_token;
    user = {
      id: result.user.id,
      email: result.user.email,
      displayName: result.user.display_name?.trim() || result.user.email,
      provider: "password",
    };
  }
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: sessionCookieSecure(request),
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  return Response.json({
    user,
  }, { status: 201 });
}
