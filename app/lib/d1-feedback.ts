import { desc } from "drizzle-orm";
import { getDb } from "../../db";
import { alphaFeedback } from "../../db/schema";
import type { AccountAlphaFeedback, AccountUser } from "./account-server";

export type CreateAlphaFeedbackInput = {
  category: AccountAlphaFeedback["category"];
  locationId: string | null;
  pageUrl: string | null;
  message: string;
  contactOk: boolean;
};

export async function createD1AlphaFeedback(
  user: AccountUser,
  input: CreateAlphaFeedbackInput,
): Promise<AccountAlphaFeedback> {
  const [report] = await getDb().insert(alphaFeedback).values({
    id: crypto.randomUUID(),
    userEmail: user.email,
    locationId: input.locationId,
    category: input.category,
    pageUrl: input.pageUrl,
    message: input.message,
    contactOk: input.contactOk,
  }).returning();
  return normalizeD1AlphaFeedback(report);
}

export async function listD1AlphaFeedbackForAdmin(): Promise<AccountAlphaFeedback[]> {
  const reports = await getDb()
    .select()
    .from(alphaFeedback)
    .orderBy(desc(alphaFeedback.createdAt))
    .limit(200);
  return reports.map(normalizeD1AlphaFeedback);
}

function normalizeD1AlphaFeedback(
  report: typeof alphaFeedback.$inferSelect,
): AccountAlphaFeedback {
  return {
    id: report.id,
    userEmail: report.userEmail,
    userDisplayName: null,
    locationId: report.locationId,
    locationName: null,
    category: normalizeCategory(report.category),
    pageUrl: report.pageUrl,
    message: report.message,
    contactOk: report.contactOk,
    status: report.status,
    createdAt: report.createdAt,
  };
}

function normalizeCategory(value: string): AccountAlphaFeedback["category"] {
  return value === "incorrect-data" || value === "bug" || value === "idea"
    ? value
    : "other";
}
