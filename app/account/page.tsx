import { ShieldCheck } from "../components/ClientIcons";
import { TopNav } from "../components/TopNav";
import { getAccountUser, safeRelativeReturnPath } from "../lib/account-server";
import { AccountClient } from "./AccountClient";

export const dynamic = "force-dynamic";

type AccountPageProps = {
  searchParams: Promise<{ return_to?: string }>;
};

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const returnTo = safeRelativeReturnPath((await searchParams).return_to);
  const user = await getAccountUser();

  return (
    <div className="app-frame content-page account-page">
      <TopNav active="account" />
      <main className="content-shell account-shell">
        <header className="spots-header account-header">
          <div>
            <span className="eyebrow">BiteMap account</span>
            <h1>Keep your fishing plans together.</h1>
            <p>Your saved spots, notes, preferred species, and access choices stay private to your account.</p>
          </div>
          <span className="identity-chip"><ShieldCheck size={16} /> Private by default</span>
        </header>

        <AccountClient initialUser={user} returnTo={returnTo} />
      </main>
    </div>
  );
}
