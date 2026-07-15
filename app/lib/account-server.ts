import { eq } from "drizzle-orm";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "bitemap_session";

export type AccountMode = "password";
export type AccountBackend = "d1" | "api";

export type AccountUser = {
  id: number | null;
  email: string;
  displayName: string;
  provider: AccountMode;
};

export type AccountFavorite = {
  id: number;
  locationId: string;
  nickname: string | null;
  notes: string | null;
  preferredSpecies: string | null;
  accessMethod: string | null;
  sortOrder: number;
};

type PasswordUserResponse = {
  id: number;
  email: string;
  display_name: string | null;
};

type PasswordFavoriteResponse = {
  id: number;
  location_id: string;
  nickname: string | null;
  notes: string | null;
  preferred_species_id: string | null;
  default_access_method: string | null;
  sort_order: number;
};

export function accountMode(): AccountMode {
  return "password";
}

export function accountBackend(): AccountBackend {
  if (process.env.BITEMAP_ACCOUNT_BACKEND === "d1") return "d1";
  if (process.env.BITEMAP_ACCOUNT_BACKEND === "api") return "api";
  return process.env.API_BASE_URL?.trim() ? "api" : "d1";
}

export function accountSignInPath(returnTo = "/"): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `/account?return_to=${encodeURIComponent(safeReturnTo)}`;
}

export function safeRelativeReturnPath(value: string | null | undefined): string {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const url = new URL(value, "https://app.local");
    if (url.origin !== "https://app.local") return "/";
    if (url.pathname.startsWith("/api/account")) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

export async function getAccountUser(): Promise<AccountUser | null> {
  const token = await passwordSessionToken();
  if (!token) return null;
  if (accountBackend() === "d1") {
    try {
      const { getD1AccountForSession } = await import("./d1-accounts");
      return await getD1AccountForSession(token);
    } catch {
      return null;
    }
  }
  const response = await passwordApiRequest("/api/users/me", { method: "GET" }, token);
  if (!response.ok) return null;
  const user = await response.json() as PasswordUserResponse;
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name?.trim() || user.email,
    provider: "password",
  };
}

export async function listAccountFavorites(): Promise<AccountFavorite[]> {
  if (accountBackend() === "api") {
    const token = await passwordSessionToken();
    if (!token) return [];
    const response = await passwordApiRequest("/api/users/me/favorites", { method: "GET" }, token);
    if (!response.ok) throw new Error("Favorite storage is unavailable.");
    const favorites = await response.json() as PasswordFavoriteResponse[];
    return favorites.map(normalizePasswordFavorite);
  }

  const user = await getAccountUser();
  if (!user) return [];
  const [{ getDb }, { savedLocations }] = await Promise.all([
    import("../../db"),
    import("../../db/schema"),
  ]);
  const favorites = await getDb().select().from(savedLocations).where(eq(savedLocations.userEmail, user.email));
  return favorites.map((favorite) => ({
    id: favorite.id,
    locationId: favorite.locationId,
    nickname: favorite.nickname,
    notes: favorite.notes,
    preferredSpecies: favorite.preferredSpecies,
    accessMethod: favorite.accessMethod,
    sortOrder: favorite.sortOrder,
  }));
}

export async function passwordSessionToken(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

export async function passwordApiRequest(
  path: string,
  init: RequestInit = {},
  token?: string | null,
): Promise<Response> {
  const base = process.env.API_BASE_URL?.trim().replace(/\/$/, "");
  if (!base) return Response.json({ detail: "Account API is not configured." }, { status: 503 });
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);
  try {
    return await fetch(`${base}${path}`, {
      ...init,
      headers,
      cache: "no-store",
      signal: init.signal ?? AbortSignal.timeout(5000),
    });
  } catch {
    return Response.json({ detail: "Account service is temporarily unavailable." }, { status: 503 });
  }
}

export function normalizePasswordFavorite(favorite: PasswordFavoriteResponse): AccountFavorite {
  return {
    id: favorite.id,
    locationId: favorite.location_id,
    nickname: favorite.nickname,
    notes: favorite.notes,
    preferredSpecies: favorite.preferred_species_id,
    accessMethod: favorite.default_access_method,
    sortOrder: favorite.sort_order,
  };
}

export async function responseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.clone().json() as { detail?: string; error?: string };
    return body.detail || body.error || fallback;
  } catch {
    return fallback;
  }
}

export function sessionCookieSecure(request: Request): boolean {
  const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwarded === "https") return true;
  if (forwarded === "http") return false;
  return new URL(request.url).protocol === "https:";
}
