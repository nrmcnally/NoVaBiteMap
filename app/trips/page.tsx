import { ClipboardList, LockKeyhole, ShieldCheck, Sparkles } from "../components/ClientIcons";
import { TopNav } from "../components/TopNav";
import { accountSignInPath, getAccountUser, listAccountFishingTrips } from "../lib/account-server";
import { locations, species, speciesById } from "../lib/data";
import { TripLogClient, type TripLocationOption } from "./TripLogClient";

// Keep the server/client boundary explicit so the trip form stays interactive.

export const dynamic = "force-dynamic";

type TripsPageProps = { searchParams: Promise<{ location?: string; species?: string }> };

export default async function TripsPage({ searchParams }: TripsPageProps) {
  const user = await getAccountUser();
  const query = await searchParams;
  let trips: Awaited<ReturnType<typeof listAccountFishingTrips>> = [];
  let databaseReady = true;
  if (user) {
    try {
      trips = await listAccountFishingTrips();
    } catch {
      databaseReady = false;
    }
  }

  const options: TripLocationOption[] = locations.map((location) => ({
    id: location.id,
    name: location.name,
    waterbody: location.waterbody,
    county: location.county,
    speciesIds: Array.from(new Set(location.evidence
      .filter((evidence) => evidence.availability >= 0.35 && speciesById(evidence.speciesId)?.targetable)
      .map((evidence) => evidence.speciesId))),
  })).filter((location) => location.speciesIds.length > 0).sort((a, b) => a.name.localeCompare(b.name));
  const speciesOptions = species
    .filter((fish) => fish.targetable)
    .map((fish) => ({ id: fish.id, name: fish.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="app-frame content-page trips-page">
      <TopNav active="trips" />
      <main className="content-shell trips-shell">
        <header className="spots-header trips-header">
          <div>
            <span className="eyebrow">Private trip log</span>
            <h1>Record what happened.</h1>
            <p>Enter the spot and time you actually fished. BiteMap does not freeze a forecast when you log a trip.</p>
          </div>
          {user && <span className="identity-chip"><ShieldCheck size={16} /> {user.displayName}</span>}
        </header>
        {!user ? (
          <section className="signin-panel">
            <div className="signin-illustration"><ClipboardList size={34} /></div>
            <span className="eyebrow">Private by default</span>
            <h2>Sign in to keep a trip log.</h2>
            <p>Trips are visible only in your account. You choose whether a de-identified record may help tune BiteMap later.</p>
            <a href={accountSignInPath(`/trips${query.location ? `?location=${encodeURIComponent(query.location)}` : ""}`)}><LockKeyhole size={17} /> Sign in to BiteMap</a>
          </section>
        ) : !databaseReady ? (
          <section className="signin-panel"><Sparkles size={30} /><h2>Trip log unavailable.</h2><p>The trip database is not ready in this environment yet.</p></section>
        ) : (
          <TripLogClient
            initialTrips={trips}
            locations={options}
            species={speciesOptions}
            initialLocationId={query.location ?? ""}
            initialSpeciesId={query.species ?? ""}
          />
        )}
      </main>
    </div>
  );
}
