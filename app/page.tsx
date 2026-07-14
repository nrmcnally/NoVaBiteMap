import { ExploreDashboard } from "./components/ExploreDashboard";
import { TopNav } from "./components/TopNav";

export default function Home() {
  return (
    <div className="app-frame">
      <TopNav active="explore" />
      <ExploreDashboard />
    </div>
  );
}

