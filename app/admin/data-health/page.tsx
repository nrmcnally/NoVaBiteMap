import { notFound, redirect } from "next/navigation";
import {
  accountSignInPath,
  getAccountUser,
  listAdminAlphaFeedback,
} from "../../lib/account-server";
import { isConfiguredAdmin } from "../../lib/admin-auth";
import { DataHealthClient } from "./DataHealthClient";

export const dynamic = "force-dynamic";

export default async function AdminDataHealthPage() {
  const user = await getAccountUser();
  if (!user) redirect(accountSignInPath("/admin/data-health"));
  if (!isConfiguredAdmin(user)) notFound();

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
