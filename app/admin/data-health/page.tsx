import { notFound, redirect } from "next/navigation";
import {
  accountSignInPath,
  getAccountUser,
  listAdminAlphaFeedback,
} from "../../lib/account-server";
import { DataHealthClient } from "./DataHealthClient";

export const dynamic = "force-dynamic";

export default async function AdminDataHealthPage() {
  const user = await getAccountUser();
  if (!user) redirect(accountSignInPath("/admin/data-health"));
  const configuredAdmins = (process.env.BITEMAP_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (configuredAdmins.length === 0 || !configuredAdmins.includes(user.email.toLowerCase())) notFound();

  let feedback: Awaited<ReturnType<typeof listAdminAlphaFeedback>> = [];
  let feedbackReady = true;
  try {
    feedback = await listAdminAlphaFeedback();
  } catch {
    feedbackReady = false;
  }

  return (
    <DataHealthClient
      adminName={user.displayName}
      feedback={feedback}
      feedbackReady={feedbackReady}
    />
  );
}
