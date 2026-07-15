import { accountMode, getAccountUser } from "../../../lib/account-server";

export async function GET() {
  return Response.json({
    authMode: accountMode(),
    user: await getAccountUser(),
  }, {
    headers: { "cache-control": "no-store" },
  });
}
