"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  CloudSun,
  Crosshair,
  Droplets,
  Fish,
  Heart,
  Info,
  MapPin,
  Navigation,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Waves,
  Wind,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FishingMap } from "./FishingMap";
import { locations, species, speciesById, type AccessMethod } from "../lib/data";
import { opportunityFor } from "../lib/scoring";

type LiveCondition = {
  status: "loading" | "ready" | "error";
  temperature?: number;
  temperatureUnit?: string;
  shortForecast?: string;
  windSpeed?: string;
  windDirection?: string;
  precipitationProbability?: number | null;
  validTime?: string;
  retrievedAt?: string;
};

const accessLabels: Record<AccessMethod, string> = {
  shore: "Shore",
  wade: "Wade",
  kayak: "Kayak",
  boat: "Boat",
};

export function ExploreDashboard() {
  const [speciesId, setSpeciesId] = useState("smallmouth-bass");
  const [query, setQuery] = useState("");
  const [access, setAccess] = useState<AccessMethod | "any">("any");
  const [maxMinutes, setMaxMinutes] = useState(60);
  const [selectedId, setSelectedId] = useState("morgans-ford");
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [live, setLive] = useState<LiveCondition>({ status: "loading" });

  const ranked = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return locations
      .map((location) => ({ location, opportunity: opportunityFor(location, speciesId) }))
      .filter(({ location, opportunity }) => {
        if (!opportunity) return false;
        if (location.travelMinutes > maxMinutes) return false;
        if (access !== "any" && !location.access.includes(access)) return false;
        if (!normalized) return true;
        const haystack = [
          location.name,
          location.waterbody,
          location.county,
          ...location.aliases,
          speciesById(speciesId)?.name ?? "",
        ].join(" ").toLowerCase();
        return haystack.includes(normalized);
      })
      .sort((a, b) => b.opportunity!.score - a.opportunity!.score);
  }, [access, maxMinutes, query, speciesId]);

  useEffect(() => {
    if (ranked.length && !ranked.some(({ location }) => location.id === selectedId)) {
      setSelectedId(ranked[0].location.id);
    }
  }, [ranked, selectedId]);

  const selected = ranked.find(({ location }) => location.id === selectedId) ?? ranked[0];
  const selectedLocation = selected?.location;
  const selectedOpportunity = selected?.opportunity ?? null;

  const selectLocation = useCallback((id: string) => setSelectedId(id), []);

  const refreshConditions = useCallback(async () => {
    if (!selectedLocation) return;
    setLive({ status: "loading" });
    try {
      const response = await fetch(`/api/conditions?lat=${selectedLocation.lat}&lon=${selectedLocation.lng}`);
      if (!response.ok) throw new Error("Provider unavailable");
      const body = await response.json() as Omit<LiveCondition, "status">;
      setLive({ status: "ready", ...body });
    } catch {
      setLive({ status: "error" });
    }
  }, [selectedLocation]);

  useEffect(() => {
    void refreshConditions();
  }, [refreshConditions]);

  async function toggleSaved(id: string) {
    const next = new Set(saved);
    if (next.has(id)) {
      next.delete(id);
      setSaved(next);
      setToast("Removed from this preview.");
      return;
    }
    next.add(id);
    setSaved(next);
    try {
      const response = await fetch("/api/favorites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locationId: id, preferredSpecies: speciesId }),
      });
      if (response.ok) setToast("Saved to My Fishing Spots.");
      else setToast("Saved for this preview. Sign in to sync it across devices.");
    } catch {
      setToast("Saved for this preview. Sign in to sync it across devices.");
    }
  }

  const selectedSpecies = speciesById(speciesId)!;
  const mapLocations = useMemo(() => ranked.map(({ location }) => location), [ranked]);

  return (
    <main className="explore-shell">
      {toast && (
        <button className="toast" onClick={() => setToast(null)} aria-label="Dismiss message">
          <Check size={16} /> {toast}
        </button>
      )}

      <section className="command-bar" aria-label="Fishing opportunity search">
        <div className="command-intro">
          <span className="eyebrow"><Sparkles size={14} /> Today’s opportunity board</span>
          <h1>Find your next <em>bite.</em></h1>
          <p>Species evidence first. Conditions second. Every score explained.</p>
        </div>
        <div className="search-stack">
          <label className="unified-search">
            <Search size={20} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search a waterbody, access point, county…"
              list="location-options"
            />
            <kbd>⌘ K</kbd>
          </label>
          <datalist id="location-options">
            {locations.map((location) => <option key={location.id} value={location.name} />)}
          </datalist>
          <div className="quick-filters">
            <label>
              <Fish size={16} />
              <select value={speciesId} onChange={(event) => setSpeciesId(event.target.value)} aria-label="Target species">
                {species.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <ChevronDown size={14} />
            </label>
            <label>
              <Clock3 size={16} />
              <select value={maxMinutes} onChange={(event) => setMaxMinutes(Number(event.target.value))} aria-label="Maximum drive time">
                <option value={45}>45 min drive</option>
                <option value={60}>60 min drive</option>
                <option value={75}>75 min drive</option>
              </select>
              <ChevronDown size={14} />
            </label>
            <label>
              <CalendarDays size={16} /> Today
              <ChevronDown size={14} />
            </label>
            <button className="location-button"><Crosshair size={16} /> Fairfax, VA</button>
          </div>
        </div>
      </section>

      <section className="workspace-grid">
        <div className="map-panel">
          <div className="map-toolbar">
            <div>
              <span className="map-kicker">Northern Virginia</span>
              <strong>{ranked.length} evidence-qualified spots</strong>
            </div>
            <button><SlidersHorizontal size={16} /> Map layers</button>
          </div>
          <FishingMap
            locations={mapLocations}
            speciesId={speciesId}
            selectedId={selectedLocation?.id}
            onSelect={selectLocation}
          />
          <div className="map-legend">
            <span><i className="marker-hot" /> 70+ strong</span>
            <span><i className="marker-mid" /> 55–69 fair</span>
            <span><i className="marker-low" /> under 55</span>
          </div>
          <div className="map-source"><ShieldCheck size={14} /> Access verified by Virginia DWR</div>
        </div>

        <div className="results-panel">
          <div className="results-heading">
            <div>
              <span className="eyebrow">Ranked for {selectedSpecies.short}</span>
              <h2>{selectedSpecies.name} <span>within {maxMinutes} minutes</span></h2>
            </div>
            <div className="access-tabs" aria-label="Access method filter">
              <button onClick={() => setAccess("any")} className={access === "any" ? "active" : ""}>Any</button>
              {(["shore", "wade", "kayak", "boat"] as AccessMethod[]).map((method) => (
                <button key={method} onClick={() => setAccess(method)} className={access === method ? "active" : ""}>
                  {accessLabels[method]}
                </button>
              ))}
            </div>
          </div>

          <div className="ranking-note">
            <Info size={15} /> Rankings use official species evidence plus a seasonal activity estimate until live provider refresh completes.
            <Link href="/methodology">What this means</Link>
          </div>

          {ranked.length === 0 ? (
            <div className="empty-state">
              <Fish size={34} />
              <h3>No evidence-qualified matches</h3>
              <p>Try a longer drive, another access method, or a different species. BiteMap won’t fill gaps with invented species claims.</p>
              <button onClick={() => { setQuery(""); setAccess("any"); setMaxMinutes(75); }}>Clear filters</button>
            </div>
          ) : (
            <div className="results-list">
              {ranked.slice(0, 6).map(({ location, opportunity }, index) => {
                if (!opportunity) return null;
                const isSelected = location.id === selectedLocation?.id;
                return (
                  <article
                    className={`result-card ${isSelected ? "selected" : ""}`}
                    key={location.id}
                    onClick={() => setSelectedId(location.id)}
                  >
                    <div className="rank-number">{String(index + 1).padStart(2, "0")}</div>
                    <div className={`score-orb score-${opportunity.score >= 70 ? "hot" : opportunity.score >= 55 ? "mid" : "low"}`}>
                      <strong>{opportunity.score}</strong><span>/100</span>
                    </div>
                    <div className="result-copy">
                      <div className="result-title">
                        <div><h3>{location.name}</h3><p>{location.waterbody} · {location.county} County</p></div>
                        <button
                          className={`heart-button ${saved.has(location.id) ? "saved" : ""}`}
                          onClick={(event) => { event.stopPropagation(); void toggleSaved(location.id); }}
                          aria-label={`${saved.has(location.id) ? "Remove" : "Save"} ${location.name}`}
                        ><Heart size={18} fill={saved.has(location.id) ? "currentColor" : "none"} /></button>
                      </div>
                      <div className="result-metrics">
                        <span><Navigation size={14} /> {location.distanceMiles} mi · {location.travelMinutes} min</span>
                        <span><Clock3 size={14} /> {location.bestWindow}</span>
                        <span className={`confidence confidence-${opportunity.confidenceLabel.toLowerCase()}`}>
                          {opportunity.confidenceLabel} confidence
                        </span>
                      </div>
                      <p className="why-line"><strong>Why it ranks:</strong> {opportunity.evidence.evidenceSummary}</p>
                      <div className="technique-row">
                        <span><Fish size={14} /> {opportunity.evidence.technique}</span>
                        <span><Waves size={14} /> {opportunity.evidence.depth}</span>
                      </div>
                    </div>
                    <Link href={`/locations/${location.id}`} className="card-arrow" aria-label={`View ${location.name} details`} onClick={(event) => event.stopPropagation()}>
                      <ArrowRight size={18} />
                    </Link>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {selectedLocation && selectedOpportunity && (
        <section className="condition-dock">
          <div className="dock-location">
            <span className="mini-map-pin"><MapPin size={18} /></span>
            <div><span>On deck</span><strong>{selectedLocation.name}</strong></div>
          </div>
          <div className="condition-cell">
            <CloudSun size={19} />
            <div><span>NWS forecast</span><strong>{live.status === "ready" ? `${live.temperature}°${live.temperatureUnit ?? "F"}` : live.status === "loading" ? "Refreshing…" : "Unavailable"}</strong></div>
            <small>{live.status === "ready" ? live.shortForecast : "No fabricated fallback"}</small>
          </div>
          <div className="condition-cell">
            <Wind size={19} />
            <div><span>Wind</span><strong>{live.status === "ready" ? `${live.windDirection ?? ""} ${live.windSpeed ?? ""}` : "—"}</strong></div>
            <small>{live.status === "ready" ? "Official hourly period" : "Awaiting provider"}</small>
          </div>
          <div className="condition-cell">
            <Droplets size={19} />
            <div><span>Water status</span><strong>{selectedLocation.flowStatus}</strong></div>
            <small>Association status shown</small>
          </div>
          <div className="condition-cell risk-cell">
            <AlertTriangle size={19} />
            <div><span>Access & safety</span><strong>{selectedLocation.access.includes("wade") ? "Check flow before wading" : "Check posted conditions"}</strong></div>
            <small>Never enter closed or unsafe water</small>
          </div>
          <button className="refresh-button" onClick={() => void refreshConditions()} aria-label="Refresh live conditions">
            <RefreshCw size={17} />
          </button>
        </section>
      )}
    </main>
  );
}
