import { locationById } from "../../lib/data";
import {
  accountBackend,
  getAccountUser,
  normalizePasswordAlphaFeedback,
  passwordApiRequest,
  passwordSessionToken,
  responseErrorMessage,
  type AlphaFeedbackCategory,
} from "../../lib/account-server";

type FeedbackBody = {
  category?: string;
  locationId?: string;
  pageUrl?: string;
  message?: string;
  contactOk?: boolean;
};

const categories = new Set<AlphaFeedbackCategory>([
  "incorrect-data",
  "bug",
  "idea",
  "other",
]);

export async function POST(request: Request) {
  const user = await getAccountUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });

  try {
    const body = await request.json() as FeedbackBody;
    const checked = validateFeedback(body);
    if ("error" in checked) {
      return Response.json({ error: checked.error }, { status: 400 });
    }

    if (accountBackend() === "d1") {
      const { createD1AlphaFeedback } = await import("../../lib/d1-feedback");
      const report = await createD1AlphaFeedback(user, checked.input);
      return Response.json({ report }, { status: 201 });
    }

    const token = await passwordSessionToken();
    if (!token) return Response.json({ error: "Sign in required." }, { status: 401 });
    const response = await passwordApiRequest("/api/users/me/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        category: checked.input.category,
        location_id: checked.input.locationId,
        page_url: checked.input.pageUrl,
        message: checked.input.message,
        contact_ok: checked.input.contactOk,
      }),
    }, token);
    if (!response.ok) {
      return Response.json({
        error: await responseErrorMessage(response, "Unable to send feedback."),
      }, { status: response.status });
    }
    return Response.json({
      report: normalizePasswordAlphaFeedback(await response.json()),
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const migrationMissing = message.includes("no such table") || message.includes("alpha_feedback");
    return Response.json({
      error: migrationMissing
        ? "Feedback storage migration has not been applied yet."
        : "Feedback storage is temporarily unavailable.",
    }, { status: 503 });
  }
}

function validateFeedback(body: FeedbackBody) {
  const category = categories.has(body.category as AlphaFeedbackCategory)
    ? body.category as AlphaFeedbackCategory
    : null;
  if (!category) return { error: "Choose a feedback type." } as const;
  const location = body.locationId ? locationById(body.locationId) : undefined;
  if (body.locationId && !location) return { error: "Choose a valid BiteMap spot." } as const;
  const message = body.message?.trim() ?? "";
  if (message.length < 10) return { error: "Please include at least 10 characters." } as const;
  if (message.length > 3000) return { error: "Feedback must be 3,000 characters or fewer." } as const;
  const rawPageUrl = body.pageUrl?.trim() ?? "";
  const pageUrl = rawPageUrl.startsWith("/") && !rawPageUrl.startsWith("//")
    ? rawPageUrl.slice(0, 500)
    : null;
  return {
    input: {
      category,
      locationId: location?.id ?? null,
      pageUrl,
      message,
      contactOk: body.contactOk === true,
    },
  } as const;
}
