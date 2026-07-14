"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  Clock3,
  CloudSun,
  Crosshair,
  Droplets,
  Fish,
  Footprints,
  Heart,
  Info,
  ListFilter,
  LoaderCircle,
  MapPin,
  Navigation,
  PanelRightClose,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Waves,
  Wind,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { FishingMap } from "./FishingMap";
import { locations, species, speciesById, type AccessMethod } from "../lib/data";
import { opportunityFor } from "../lib/scoring";
import { estimateTravel, googleDirectionsUrl, type TravelOrigin } from "../lib/travel";

type LiveCondition = {
  status: "loading" | "ready" | "error";
  temperature?: number;
  temperatureUnit?: string;
  shortForecast?: string;
  windSpeed?: string;
  windDirection?: string;
};

type FavoriteRecord = { id: number; locationId: string };
type TimeFilter = "any" | "walkable" | "5" | "15" | "30" | "45" | "60" | "90" | "120" | "180";

const accessLabels: Record<AccessMethod, string> = {
  shore: "Shore",
  wade: "Wade",
  kayak: "Kayak",
  boat: "Boat",
};

const timeOptions: { value: TimeFilter; label: string }[] = [
  { value: "any", label: "Any travel time" },
  { value: "walkable", label: "Walkable (30 min)" },
  { value: "5", label: "5 min drive" },
  { value: "15", label: "15 min drive" },
  { value: "30", label: "30 min drive" },
  { value: "45", label: "45 min drive" },
  { value: "60", label: "60 min drive" },
  { value: "90", label: "90 min drive" },
  { value: "120", label: "2 hour drive" },
  { value: "180", label: "3 hour drive" },
];

export function ExploreDashboard() {
  const [speciesId, setSpeciesId] = useState("");
  const [query, setQuery] = useState("");
  const [access, setAccess] = useState<AccessMethod | "any">("any");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("any");
  const [selectedId, setSelectedId] = useState<string>();
  const [resultsOpen, setResultsOpen] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Map<string, number>>(new Map());
  const [toast, setToast] = useState<string | null>(null);
  const [live, setLive] = useState<LiveCondition>({ status: "loading" });
  const [originInput, setOriginInput] = useState("");
  const [origin, setOrigin] = useState<TravelOrigin | null>(null);
  const [originStatus, setOriginStatus] = useState<"idle" | "loading" | "error">("idle");
  const [originMessage, setOriginMessage] = useState("");

  const visibleRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return locations
      .map((location) => ({ location, travel: estimateTravel(location, origin) }))
      .filter(({ location, travel }) => {
        if (access !== "any" && !location.access.includes(access)) return false;
        if (timeFilter === "walkable" && (!origin || travel.walkMinutes > 30)) return false;
        if (timeFilter !== "any" && timeFilter !== "walkable" && travel.driveMinutes > Number(timeFilter)) return false;
        if (!normalized) return true;
        const haystack = [
          location.name,
          location.waterbody,
          location.county,
          ...location.aliases,
          speciesId ? speciesById(speciesId)?.name ?? "" : "",
        ].join(" ").toLowerCase();
        return haystack.includes(normalized);
      });
  }, [access, origin, query, speciesId, timeFilter]);

  const ranked = useMemo(() => {
    if (!speciesId) return [];
    return visibleRows
      .map(({ location, travel }) => ({ location, travel, opportunity: opportunityFor(location, speciesId) }))
      .filter((row) => Boolean(row.opportunity))
      .sort((a, b) => b.opportunity!.score - a.opportunity!.score);
  }, [speciesId, visibleRows]);

  useEffect(() => {
    if (!speciesId) return;
    const selectedIsVisible = visibleRows.some(({ location }) => location.id === selectedId);
    if (ranked.length && (!selectedId || !selectedIsVisible)) {
      setSelectedId(ranked[0].location.id);
    }
  }, [ranked, selectedId, speciesId, visibleRows]);

  const selected = selectedId ? ranked.find(({ location }) => location.id === selectedId) : ranked[0];
  const selectedLocation = selected?.location;
  const selectedOpportunity = selected?.opportunity ?? null;
  const selectedSpecies = speciesId ? speciesById(speciesId) : undefined;
  const mapLocations = useMemo(() => visibleRows.map(({ location }) => location), [visibleRows]);

  const loadFavorites = useCallback(async () => {
    try {
      const response = await fetch("/api/favorites", { cache: "no-store" });
      if (!response.ok) return;
      const body = await response.json() as { favorites?: FavoriteRecord[] };
      setFavoriteIds(new Map((body.favorites ?? []).map((favorite) => [favorite.locationId, favorite.id])));
    } catch {
      // Favorites remain account-backed; a failed refresh does not invent local records.
    }
  }, []);

  useEffect(() => {
    void loadFavorites();
    const refresh = () => void loadFavorites();
    window.addEventListener("focus", refresh);
    window.addEventListener("bitemap:favorites-changed", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("bitemap:favorites-changed", refresh);
    };
  }, [loadFavorites]);

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
    if (selectedLocation) void refreshConditions();
  }, [refreshConditions, selectedLocation]);

  async function toggleSaved(id: string) {
    const favoriteId = favoriteIds.get(id);
    try {
      const response = favoriteId
        ? await fetch(`/api/favorites/${favoriteId}`, { method: "DELETE" })
        : await fetch("/api/favorites", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ locationId: id, preferredSpecies: speciesId || undefined }),
          });

      if (!response.ok) {
        setToast(response.status === 401 ? "Sign in to save spots to your account." : "My Spots is temporarily unavailable.");
        return;
      }

      if (favoriteId) {
        setFavoriteIds((current) => {
          const next = new Map(current);
          next.delete(id);
          return next;
        });
        setToast("Removed from My Spots.");
      } else {
        const body = await response.json() as { favorite: FavoriteRecord };
        setFavoriteIds((current) => new Map(current).set(id, body.favorite.id));
        setToast("Saved to My Spots.");
      }
      window.dispatchEvent(new Event("bitemap:favorites-changed"));
    } catch {
      setToast("My Spots is temporarily unavailable.");
    }
  }

  async function submitOrigin(event: FormEvent) {
    event.preventDefault();
    const value = originInput.trim();
    if (!value) return;
    setOriginStatus("loading");
    setOriginMessage("");
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(value)}`);
      const body = await response.json() as { label?: string; lat?: number; lng?: number; error?: string };
      if (!response.ok || !Number.isFinite(body.lat) || !Number.isFinite(body.lng)) {
        throw new Error(body.error || "Starting point not found.");
      }
      setOrigin({ label: body.label ?? value, query: value, lat: body.lat!, lng: body.lng! });
      setOriginStatus("idle");
      setOriginMessage(body.label ?? value);
    } catch (error) {
      setOriginStatus("error");
      setOriginMessage(error instanceof Error ? error.message : "Starting point not found.");
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setOriginStatus("error");
      setOriginMessage("Location access is not supported by this browser.");
      return;
    }
    setOriginStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setOrigin({
          label: "Current location",
          query: "Current location",
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setOriginInput("");
        setOriginStatus("idle");
        setOriginMessage("Using your current location");
      },
      () => {
        setOriginStatus("error");
        setOriginMessage("Location permission was not granted.");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }

  function clearOrigin() {
    setOrigin(null);
    setOriginInput("");
    setOriginMessage("");
    if (timeFilter === "walkable") setTimeFilter("any");
  }

  function chooseSpecies(value: string) {
    setSpeciesId(value);
    setSelectedId(undefined);
    if (value) setResultsOpen(true);
  }

  const selectMapLocation = useCallback((id: string) => {
    setSelectedId(id);
    const location = locations.find((item) => item.id === id);
    if (!speciesId) {
      setToast(`${location?.name ?? "This spot"} is verified access. Choose a species to see a ranking.`);
      return;
    }
    if (location && opportunityFor(location, speciesId)) {
      setResultsOpen(true);
    } else {
      setToast(`${location?.name ?? "This spot"} has no qualifying evidence for the selected species yet.`);
    }
  }, [speciesId]);

  return (
    <main className="explore-shell">
      {toast && (
        <button className="toast" onClick={() => setToast(null)} aria-label="Dismiss message">
          <Check size={16} /> {toast}
        </button>
      )}

      <section className="command-bar" aria-label="Fishing opportunity search">
        <div className="command-intro">
          <span className="eyebrow"><Sparkles size={14} /> Today&apos;s opportunity board</span>
          <h1>Find your next <em>bite.</em></h1>
          <p>Start with a place, then choose a target species when you want ranked opportunities.</p>
        </div>
        <div className="search-stack">
          <label className="unified-search">
            <Search size={20} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search a waterbody, access point, county..."
              list="location-options"
            />
            {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><X size={16} /></button>}
          </label>
          <datalist id="location-options">
            {locations.map((location) => <option key={location.id} value={location.name} />)}
          </datalist>

          <div className="filter-row">
            <label className={`filter-field species-filter ${speciesId ? "selected" : "needs-choice"}`}>
              <span>Target species</span>
              <div><Fish size={17} />
                <select value={speciesId} onChange={(event) => chooseSpecies(event.target.value)} aria-label="Target species">
                  <option value="">Choose a fish species</option>
                  {species.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <ChevronDown size={15} />
              </div>
            </label>

            <label className="filter-field">
              <span>Travel range</span>
              <div><Clock3 size={17} />
                <select value={timeFilter} onChange={(event) => setTimeFilter(event.target.value as TimeFilter)} aria-label="Maximum travel time">
                  {timeOptions.map((option) => (
                    <option key={option.value} value={option.value} disabled={option.value === "walkable" && !origin}>
                      {option.label}{option.value === "walkable" && !origin ? " - set an origin" : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown size={15} />
              </div>
            </label>

            <div className="access-filter" role="group" aria-label="Access method filter">
              <span>Access</span>
              <div>
                <button onClick={() => setAccess("any")} className={access === "any" ? "active" : ""}>Any</button>
                {(["shore", "wade", "kayak", "boat"] as AccessMethod[]).map((method) => (
                  <button key={method} onClick={() => setAccess(method)} className={access === method ? "active" : ""}>{accessLabels[method]}</button>
                ))}
              </div>
            </div>

            <form className="origin-form" onSubmit={submitOrigin}>
              <span>Starting address or ZIP</span>
              <div>
                <MapPin size={17} />
                <input value={originInput} onChange={(event) => setOriginInput(event.target.value)} placeholder="e.g. 22030 or 123 Main St, Fairfax" aria-label="Starting address or ZIP code" />
                <button type="submit" disabled={originStatus === "loading" || !originInput.trim()}>{originStatus === "loading" ? <LoaderCircle className="spin" size={16} /> : "Set"}</button>
                <button type="button" className="locate-button" onClick={useCurrentLocation} aria-label="Use current location"><Crosshair size={16} /></button>
              </div>
              {originMessage && <small className={originStatus === "error" ? "error" : ""}>{originMessage}</small>}
              {origin && <button type="button" className="clear-origin" onClick={clearOrigin}>Clear starting point</button>}
            </form>
          </div>
        </div>
      </section>

      <section className={`workspace-grid ${resultsOpen ? "results-open" : ""}`}>
        <div className="map-panel">
          <div className="map-toolbar">
            <div>
              <span className="map-kicker">Northern Virginia</span>
              <strong>{visibleRows.length} verified access points{speciesId ? ` · ${ranked.length} ranked` : ""}</strong>
            </div>
            <button className="results-toggle" onClick={() => setResultsOpen((open) => !open)} aria-expanded={resultsOpen}>
              <ListFilter size={17} /> {resultsOpen ? "Hide results" : speciesId ? `Show ${ranked.length} ranked results` : "Open results"}
            </button>
          </div>
          <FishingMap
            locations={mapLocations}
            speciesId={speciesId}
            selectedId={selectedId}
            origin={origin}
            onSelect={selectMapLocation}
          />
          <div className="map-legend">
            {!speciesId ? (
              <span><i className="marker-access" /> Verified public access</span>
            ) : (
              <>
                <span><i className="marker-hot" /> 70+ strong</span>
                <span><i className="marker-mid" /> 55-69 fair</span>
                <span><i className="marker-low" /> under 55</span>
                <span><i className="marker-pending" /> evidence pending</span>
              </>
            )}
          </div>
          <div className="map-source"><ShieldCheck size={14} /> Access verified by Virginia DWR</div>
        </div>

        <aside className={`results-panel ${resultsOpen ? "open" : ""}`} aria-hidden={!resultsOpen}>
          <div className="results-heading">
            <div>
              <span className="eyebrow">{selectedSpecies ? `Ranked for ${selectedSpecies.short}` : "Opportunity results"}</span>
              <h2>{selectedSpecies ? selectedSpecies.name : "Choose a target species"}</h2>
            </div>
            <button className="close-results" onClick={() => setResultsOpen(false)} aria-label="Collapse results"><PanelRightClose size={20} /></button>
          </div>

          {selectedSpecies && (
            <div className="ranking-note">
              <Info size={15} /> Rankings use official species evidence plus a seasonal activity estimate.
              <Link href="/methodology">What this means</Link>
            </div>
          )}

          {!selectedSpecies ? (
            <div className="empty-state choose-species-state">
              <Fish size={34} />
              <h3>No species selected</h3>
              <p>All verified access points remain visible. Choose a target species above when you want BiteMap to rank the evidence-qualified options.</p>
            </div>
          ) : ranked.length === 0 ? (
            <div className="empty-state">
              <Fish size={34} />
              <h3>No evidence-qualified matches</h3>
              <p>Try a wider travel range, another access method, or a different species. BiteMap will not fill gaps with invented species claims.</p>
              <button onClick={() => { setQuery(""); setAccess("any"); setTimeFilter("any"); }}>Clear filters</button>
            </div>
          ) : (
            <div className="results-list">
              {ranked.map(({ location, opportunity, travel }, index) => {
                if (!opportunity) return null;
                const isSelected = location.id === selectedLocation?.id;
                const isSaved = favoriteIds.has(location.id);
                const walkable = origin && travel.walkMinutes <= 30;
                return (
                  <article className={`result-card ${isSelected ? "selected" : ""}`} key={location.id} onClick={() => setSelectedId(location.id)}>
                    <div className="rank-number">{String(index + 1).padStart(2, "0")}</div>
                    <div className={`score-orb score-${opportunity.score >= 70 ? "hot" : opportunity.score >= 55 ? "mid" : "low"}`}>
                      <strong>{opportunity.score}</strong><span>/100</span>
                    </div>
                    <div className="result-copy">
                      <div className="result-title">
                        <div><h3>{location.name}</h3><p>{location.waterbody} · {location.county} County</p></div>
                        <button className={`heart-button ${isSaved ? "saved" : ""}`} onClick={(event) => { event.stopPropagation(); void toggleSaved(location.id); }} aria-label={`${isSaved ? "Remove" : "Save"} ${location.name}`}>
                          <Heart size={18} fill={isSaved ? "currentColor" : "none"} />
                        </button>
                      </div>
                      <div className="result-metrics">
                        <span><Navigation size={14} /> {travel.distanceMiles} mi · ~{travel.driveMinutes} min{travel.personalized ? " from start" : " estimate"}</span>
                        {walkable && <span><Footprints size={14} /> ~{travel.walkMinutes} min walk</span>}
                        <span><Clock3 size={14} /> {location.bestWindow}</span>
                        <span className={`confidence confidence-${opportunity.confidenceLabel.toLowerCase()}`}>{opportunity.confidenceLabel} confidence</span>
                      </div>
                      <p className="why-line"><strong>Why it ranks:</strong> {opportunity.evidence.evidenceSummary}</p>
                      <div className="result-actions">
                        <a href={googleDirectionsUrl(location, origin)} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}><Navigation size={14} /> Google Maps directions</a>
                        <Link href={`/locations/${location.id}`} onClick={(event) => event.stopPropagation()}>Spot details <ArrowRight size={14} /></Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </aside>
      </section>

      {selectedLocation && selectedOpportunity && (
        <section className="condition-dock">
          <div className="dock-location">
            <span className="mini-map-pin"><MapPin size={18} /></span>
            <div><span>On deck</span><strong>{selectedLocation.name}</strong></div>
          </div>
          <div className="condition-cell">
            <CloudSun size={19} />
            <div><span>NWS forecast</span><strong>{live.status === "ready" ? `${live.temperature}°${live.temperatureUnit ?? "F"}` : live.status === "loading" ? "Refreshing..." : "Unavailable"}</strong></div>
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
          <button className="refresh-button" onClick={() => void refreshConditions()} aria-label="Refresh live conditions"><RefreshCw size={17} /></button>
        </section>
      )}
    </main>
  );
}
