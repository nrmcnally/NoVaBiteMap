import { TopNav } from "../../components/TopNav";

export default function LocationLoading() {
  return (
    <div className="app-frame detail-page">
      <TopNav active="explore" />
      <main className="detail-shell">
        <div className="route-loading" role="status" aria-live="polite">
          <span className="route-loading-spinner" />
          <p>Loading spot details…</p>
        </div>
      </main>
    </div>
  );
}
