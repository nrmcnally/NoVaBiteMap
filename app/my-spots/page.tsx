import { LockKeyhole, MapPin, ShieldCheck, Sparkles } from "../components/ClientIcons";
import { TopNav } from "../components/TopNav";
import { accountSignInPath, getAccountUser, listAccountFavorites } from "../lib/account-server";
import { fetchExploreCatalog } from "../lib/api";
import { MySpotsClient } from "./MySpotsClient";

export const dynamic = "force-dynamic";

export default async function MySpotsPage() {
  const user = await getAccountUser();
  const catalog = user ? await fetchExploreCatalog() : null;
  let favorites: Awaited<ReturnType<typeof listAccountFavorites>> = [];
  let databaseReady = true;
  if (user) {
    try {
      favorites = await listAccountFavorites();
    } catch {
      databaseReady = false;
    }
  }

  return (
    <div className="app-frame content-page spots-page">
      <TopNav active="spots" />
      <main className="content-shell">
        <header className="spots-header">
          <div><span className="eyebrow">My Fishing Spots</span><h1>Your water, at a glance.</h1><p>Save public access points and compare their next useful windows.</p></div>
          {user && <span className="identity-chip"><ShieldCheck size={16} /> {user.displayName}</span>}
        </header>
        {!user ? (
          <section className="signin-panel">
            <div className="signin-illustration"><MapPin size={34} /></div>
            <span className="eyebrow">Private by default</span>
            <h2>Sign in to keep your spots.</h2>
            <p>Browsing and forecasts stay public. An account is only needed to sync favorites, nicknames, notes, and preferred species.</p>
            <a href={accountSignInPath("/my-spots")}><LockKeyhole size={17} /> Sign in to BiteMap</a>
            <small>Favorites belong to your authenticated account and are not shared publicly.</small>
          </section>
        ) : !databaseReady ? (
          <section className="signin-panel"><Sparkles size={30} /><h2>Favorite storage is warming up.</h2><p>The signed-in dashboard is ready, but its database migration has not been applied in this environment yet.</p></section>
        ) : (
          <MySpotsClient initialFavorites={favorites} catalog={catalog} />
        )}
      </main>
    </div>
  );
}
