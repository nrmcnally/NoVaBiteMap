import { ExploreDashboard } from "./components/ExploreDashboard";
import { fetchExploreCatalog } from "./lib/api";
import { TopNav } from "./components/TopNav";

export const dynamic = "force-dynamic";

export default async function Home() {
  const catalog = await fetchExploreCatalog();
  return (
    <div className="app-frame">
      <TopNav active="explore" />
      <ExploreDashboard catalog={catalog} />
    </div>
  );
}
