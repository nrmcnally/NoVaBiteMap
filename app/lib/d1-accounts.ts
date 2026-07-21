import { and, eq, lt } from "drizzle-orm";
import { getDb } from "../../db";
import {
  accountSessions,
  accountUsers,
  alphaFeedback,
  fishingTrips,
  savedLocations,
} from "../../db/schema";
import { createSessionToken, hashPassword, sessionTokenHash, verifyPassword } from "./password-auth";
import type { AccountUser } from "./account-server";

export class D1AccountError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export async function createD1Account(emailInput: string, password: string, displayName?: string | null) {
  const email = normalizeEmail(emailInput);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) throw new D1AccountError(400, "Enter a valid email address.");
  if (password.length < 12 || password.length > 256) throw new D1AccountError(400, "Use a password between 12 and 256 characters.");
  const db = getDb();
  const existing = await db.select({ id: accountUsers.id }).from(accountUsers).where(eq(accountUsers.email, email)).limit(1);
  if (existing.length) throw new D1AccountError(409, "An account with this email already exists.");
  try {
    const [user] = await db.insert(accountUsers).values({
      email,
      passwordHash: await hashPassword(password),
      displayName: displayName?.trim().slice(0, 120) || null,
    }).returning();
    const token = await createD1Session(user.id);
    return { token, user: accountUser(user) };
  } catch (error) {
    if (String(error).toLowerCase().includes("unique")) throw new D1AccountError(409, "An account with this email already exists.");
    throw error;
  }
}

export async function authenticateD1Account(emailInput: string, password: string) {
  const db = getDb();
  const [user] = await db.select().from(accountUsers).where(eq(accountUsers.email, normalizeEmail(emailInput))).limit(1);
  if (!user || !await verifyPassword(password, user.passwordHash)) {
    throw new D1AccountError(401, "Invalid email or password.");
  }
  const token = await createD1Session(user.id);
  return { token, user: accountUser(user) };
}

export async function getD1AccountForSession(token: string): Promise<AccountUser | null> {
  const db = getDb();
  const tokenHash = await sessionTokenHash(token);
  const [record] = await db
    .select({
      sessionId: accountSessions.id,
      expiresAt: accountSessions.expiresAt,
      id: accountUsers.id,
      email: accountUsers.email,
      displayName: accountUsers.displayName,
    })
    .from(accountSessions)
    .innerJoin(accountUsers, eq(accountSessions.userId, accountUsers.id))
    .where(eq(accountSessions.tokenHash, tokenHash))
    .limit(1);
  if (!record) return null;
  if (Date.parse(record.expiresAt) <= Date.now()) {
    await db.delete(accountSessions).where(eq(accountSessions.id, record.sessionId));
    return null;
  }
  return accountUser(record);
}

export async function logoutD1Session(token: string): Promise<void> {
  await getDb().delete(accountSessions).where(eq(accountSessions.tokenHash, await sessionTokenHash(token)));
}

export async function deleteD1Account(token: string): Promise<boolean> {
  const user = await getD1AccountForSession(token);
  if (!user?.id) return false;
  const db = getDb();
  await db.delete(alphaFeedback).where(eq(alphaFeedback.userEmail, user.email));
  await db.delete(savedLocations).where(eq(savedLocations.userEmail, user.email));
  await db.delete(fishingTrips).where(eq(fishingTrips.userEmail, user.email));
  await db.delete(accountSessions).where(eq(accountSessions.userId, user.id));
  await db.delete(accountUsers).where(and(eq(accountUsers.id, user.id), eq(accountUsers.email, user.email)));
  return true;
}

async function createD1Session(userId: number): Promise<string> {
  const token = createSessionToken();
  const now = new Date();
  await getDb().batch([
    getDb().delete(accountSessions).where(lt(accountSessions.expiresAt, now.toISOString())),
    getDb().insert(accountSessions).values({
      userId,
      tokenHash: await sessionTokenHash(token),
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }),
  ]);
  return token;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function accountUser(user: { id: number; email: string; displayName: string | null }): AccountUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName?.trim() || user.email,
    provider: "password",
  };
}
