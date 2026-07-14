import { Heart, LockKeyhole, MapPin, ShieldCheck, Sparkles } from "../components/ClientIcons";
import { eq } from "drizzle-orm";
import { TopNav } from "../components/TopNav";
import { chatGPTSignInPath, getChatGPTUser } from "../chatgpt-auth";
import { getDb } from "../../db";
import { savedLocations } from "../../db/schema";
import { locationById, speciesById } from "../lib/data";
import { opportunityFor } from "../lib/scoring";

export const dynamic = "force-dynamic";

export default async function MySpotsPage() {
  const user = await getChatGPTUser();
  let favorites: (typeof savedLocations.$inferSelect)[] = [];
  let databaseReady = true;
  if (user) {
    try {
      favorites = await getDb().select().from(savedLocations).where(eq(savedLocations.userEmail, user.email));
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
            <div className="signin-illustration"><MapPin size={34} /><Heart size={24} fill="currentColor" /></div>
            <span className="eyebrow">Private by default</span>
            <h2>Sign in to keep your spots.</h2>
            <p>Browsing and forecasts stay public. An account is only needed to sync favorites, nicknames, notes, and preferred species.</p>
            <a href={chatGPTSignInPath("/my-spots")}><LockKeyhole size={17} /> Sign in with ChatGPT</a>
            <small>Favorites belong to your authenticated account and are not shared publicly.</small>
          </section>
        ) : !databaseReady ? (
          <section className="signin-panel"><Sparkles size={30} /><h2>Favorite storage is warming up.</h2><p>The signed-in dashboard is ready, but its database migration has not been applied in this environment yet.</p></section>
        ) : favorites.length === 0 ? (
          <section className="signin-panel"><Heart size={30} /><h2>No saved spots yet.</h2><p>Choose a heart on the opportunity map to start your private shortlist.</p><a href="/">Explore the map</a></section>
        ) : (
          <section className="favorite-grid">
            {favorites.map((favorite) => {
              const location = locationById(favorite.locationId);
              if (!location) return null;
              const evidence = favorite.preferredSpecies ? opportunityFor(location, favorite.preferredSpecies) : null;
              return (
                <a className="favorite-card" href={`/locations/${location.id}`} key={favorite.id}>
                  <span className="eyebrow">{favorite.nickname || location.county}</span>
                  <h2>{location.name}</h2>
                  <p>{location.waterbody}</p>
                  <div><strong>{evidence?.score ?? "—"}</strong><span>{favorite.preferredSpecies ? speciesById(favorite.preferredSpecies)?.name : "Choose a target"}<br />{location.bestWindow}</span></div>
                </a>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}
