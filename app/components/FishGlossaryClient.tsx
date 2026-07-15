"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Fish, Search, X } from "lucide-react";

export type GlossaryFish = {
  id: string;
  name: string;
  scientificName: string;
  habitat: string;
  family: string;
  familyShort: string;
  nativeStatus: "native" | "introduced" | "invasive" | null;
  typicalSize: string;
  topWater: string;
  evidenceCount: number;
  image: string | null;
  targetable: boolean;
};

const NATIVE_LABEL: Record<string, string> = { native: "Native", introduced: "Introduced", invasive: "Invasive" };
type GroupMode = "az" | "family";

export function FishGlossaryClient({ fish }: { fish: GlossaryFish[] }) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<GroupMode>("az");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return fish;
    return fish.filter((f) =>
      [f.name, f.scientificName, f.family, f.habitat].join(" ").toLowerCase().includes(q),
    );
  }, [fish, query]);

  const groups = useMemo(() => {
    const map = new Map<string, GlossaryFish[]>();
    const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    for (const f of sorted) {
      const key = group === "family" ? f.familyShort : f.name[0].toUpperCase();
      map.set(key, [...(map.get(key) ?? []), f]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, group]);

  return (
    <div className="fish-glossary">
      <div className="fish-glossary-controls">
        <label className="fish-search">
          <Search size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search species, family, or habitat…" />
          {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear"><X size={14} /></button>}
        </label>
        <div className="fish-group-toggle" role="group" aria-label="Group species by">
          <button className={group === "az" ? "active" : ""} onClick={() => setGroup("az")}>A–Z</button>
          <button className={group === "family" ? "active" : ""} onClick={() => setGroup("family")}>By family</button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="fish-empty">No species match &ldquo;{query}&rdquo;.</p>
      ) : (
        groups.map(([label, items]) => (
          <section key={label} className="fish-guide-group">
            <h2 className="fish-guide-letter">{label}</h2>
            <div className="fish-guide-grid">
              {items.map((item) => (
                <Link key={item.id} href={`/fish/${item.id}`} className="fish-guide-card">
                  <div className="fish-guide-thumb">
                    {item.image ? <img src={item.image} alt={item.name} loading="lazy" /> : <span className="fish-guide-thumb-placeholder"><Fish size={26} /></span>}
                  </div>
                  <div className="fish-guide-card-body">
                    <div className="fish-guide-title">
                      <h3>{item.name}</h3>
                      {!item.targetable && <span className="community-badge">Community record</span>}
                      {item.nativeStatus && <span className={`native-badge native-${item.nativeStatus}`}>{NATIVE_LABEL[item.nativeStatus]}</span>}
                    </div>
                    <p className="fish-guide-sci"><em>{item.scientificName}</em></p>
                    <p className="fish-guide-signature">
                      {[item.typicalSize, item.topWater ? `favors ${item.topWater}` : item.habitat].filter(Boolean).join(" · ")}
                    </p>
                    <span className="fish-guide-evidence">
                      {item.evidenceCount > 0 ? `${item.evidenceCount} water${item.evidenceCount === 1 ? "" : "s"}` : "No evidenced waters"}
                      <ArrowRight size={13} />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
