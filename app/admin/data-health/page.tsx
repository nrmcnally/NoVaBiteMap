import { notFound, redirect } from "next/navigation";
import { accountSignInPath, getAccountUser } from "../../lib/account-server";
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

  return <DataHealthClient adminName={user.displayName} />;
}
