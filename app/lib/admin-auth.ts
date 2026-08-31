import type { AccountUser } from "./account-server";

export function configuredAdminEmails(): string[] {
  return (process.env.BITEMAP_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isConfiguredAdmin(user: AccountUser | null): user is AccountUser {
  if (!user) return false;
  const admins = configuredAdminEmails();
  return admins.length > 0 && admins.includes(user.email.toLowerCase());
}
