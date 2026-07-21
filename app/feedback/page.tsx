import { LockKeyhole, MessageSquare, ShieldCheck } from "../components/ClientIcons";
import { TopNav } from "../components/TopNav";
import {
  accountSignInPath,
  getAccountUser,
  type AlphaFeedbackCategory,
} from "../lib/account-server";
import { locationById, locations } from "../lib/data";
import { FeedbackClient } from "./FeedbackClient";

export const dynamic = "force-dynamic";

type FeedbackPageProps = {
  searchParams: Promise<{
    category?: string;
    location?: string;
    source?: string;
  }>;
};

const allowedCategories = new Set<AlphaFeedbackCategory>([
  "incorrect-data",
  "bug",
  "idea",
  "other",
]);

export default async function FeedbackPage({ searchParams }: FeedbackPageProps) {
  const user = await getAccountUser();
  const query = await searchParams;
  const initialCategory = allowedCategories.has(query.category as AlphaFeedbackCategory)
    ? query.category as AlphaFeedbackCategory
    : "other";
  const initialLocationId = query.location && locationById(query.location)
    ? query.location
    : "";
  const sourcePage = query.source?.startsWith("/") && !query.source.startsWith("//")
    ? query.source.slice(0, 500)
    : null;
  const returnTo = `/feedback?category=${encodeURIComponent(initialCategory)}${
    initialLocationId ? `&location=${encodeURIComponent(initialLocationId)}` : ""
  }${sourcePage ? `&source=${encodeURIComponent(sourcePage)}` : ""}`;
  const locationOptions = locations
    .map((location) => ({
      id: location.id,
      name: location.name,
      waterbody: location.waterbody,
      county: location.county,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="app-frame content-page feedback-page">
      <TopNav />
      <main className="content-shell feedback-shell">
        <header className="spots-header feedback-header">
          <div>
            <span className="eyebrow">Alpha feedback</span>
            <h1>Help make BiteMap more trustworthy.</h1>
            <p>Report incorrect spot data, a bug, or an idea. Reports go to the private administrator review queue and never change scores automatically.</p>
          </div>
          {user && <span className="identity-chip"><ShieldCheck size={16} /> {user.displayName}</span>}
        </header>

        {!user ? (
          <section className="signin-panel">
            <div className="signin-illustration"><MessageSquare size={34} /></div>
            <span className="eyebrow">Attributed reports</span>
            <h2>Sign in to send feedback.</h2>
            <p>Your account helps us follow up and prevents anonymous spam. Your report remains private to the BiteMap administrator.</p>
            <a href={accountSignInPath(returnTo)}><LockKeyhole size={17} /> Sign in to BiteMap</a>
          </section>
        ) : (
          <FeedbackClient
            initialCategory={initialCategory}
            initialLocationId={initialLocationId}
            sourcePage={sourcePage}
            locations={locationOptions}
          />
        )}
      </main>
    </div>
  );
}
