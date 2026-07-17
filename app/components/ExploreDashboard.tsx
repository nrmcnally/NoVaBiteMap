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
import type { FormEvent, ReactNode } from "react";
import { FishingMap } from "./FishingMap";
import { PredictionTimeline } from "./PredictionTimeline";
import { consumptionAdviceFor } from "../lib/advisories";
import { locations as bundledLocations, targetSpecies as bundledSpecies, speciesById as bundledSpeciesById, type AccessMethod, type WaterbodyType } from "../lib/data";
import type { ExploreCatalog } from "../lib/api";
import type { NwsAlert, NwsForecastPeriod } from "../lib/forecast";
import {
  periodsForSelection,
  selectionFromSearch,
  selectionSearch,
  type ForecastSelection,
} from "../lib/prediction-timeline";
import { opportunityFor, opportunityForForecast } from "../lib/scoring";
import { estimateTravel, googleDirectionsUrl, type TravelOrigin } from "../lib/travel";

type LiveCondition = {
  status: "loading" | "ready" | "error";
  temperature?: number;
  temperatureUnit?: string;
  shortForecast?: string;
  windSpeed?: string;
  windDirection?: string;
};

type TimelineForecast = {
  status: "loading" | "ready" | "error";
  periods: NwsForecastPeriod[];
  alerts: NwsAlert[];
  retrievedAt?: string;
  error?: string;
};

type FavoriteRecord = { id: number; locationId: string };
type TimeFilter = "any" | "walkable" | "5" | "15" | "30" | "45" | "60" | "90" | "120" | "180";
type HarvestFilter = "any" | "hide-active" | "keep-and-eat";

type FilterMenuProps = {
  label: string;
  value: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
  highlighted?: boolean;
};

function FilterMenu({ label, value, icon, children, className = "", highlighted = false }: FilterMenuProps) {
  return (
    <div className={`filter-menu-wrap ${className} ${highlighted ? "selected" : ""}`}>
      <span>{label}</span>
      <details className="filter-menu">
        <summary><span className="filter-summary-icon">{icon}</span><strong>{value}</strong><ChevronDown size={15} /></summary>
        <div className="filter-popover">{children}</div>
      </details>
    </div>
  );
}

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

const waterTypeOptions: { value: WaterbodyType; label: string }[] = [
  { value: "river", label: "River" },
  { value: "reservoir", label: "Reservoir" },
  { value: "lake", label: "Lake" },
  { value: "pond", label: "Pond" },
  { value: "bay", label: "Bay / embayment" },
  { value: "stream", label: "Stream" },
];

const harvestOptions: { value: HarvestFilter; label: string; detail: string }[] = [
  { value: "any", label: "Show every water", detail: "Advisories remain visible on result cards." },
  { value: "hide-active", label: "Hide relevant restrictions", detail: "Uses selected species when available; boundary-check sites remain visible." },
  { value: "keep-and-eat", label: "Keep-and-eat mode", detail: "Requires no matching VDH restriction for the selected species and no boundary check." },
];

export function ExploreDashboard({ catalog }: { catalog: ExploreCatalog | null }) {
  const locations = catalog?.locations ?? bundledLocations;
  const species = catalog?.species ?? bundledSpecies;
  const speciesById = useCallback(
    (id: string) => species.find((item) => item.id === id) ?? bundledSpeciesById(id),
    [species],
  );
  const [speciesIds, setSpeciesIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [access, setAccess] = useState<AccessMethod | "any">("any");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("any");
  const [waterbodyTypes, setWaterbodyTypes] = useState<WaterbodyType[]>([]);
  const [stockedOnly, setStockedOnly] = useState(false);
  const [harvestFilter, setHarvestFilter] = useState<HarvestFilter>("any");
  const [selectedId, setSelectedId] = useState<string>();
  const [resultsOpen, setResultsOpen] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Map<string, number>>(new Map());
  const [toast, setToast] = useState<string | null>(null);
  const [live, setLive] = useState<LiveCondition>({ status: "loading" });
  const [originInput, setOriginInput] = useState("");
  const [origin, setOrigin] = useState<TravelOrigin | null>(null);
  const [originStatus, setOriginStatus] = useState<"idle" | "loading" | "error">("idle");
  const [originMessage, setOriginMessage] = useState("");
  const [timelineForecast, setTimelineForecast] = useState<TimelineForecast>({
    status: "loading",
    periods: [],
    alerts: [],
  });
  const [timelineSelection, setTimelineSelection] = useState<ForecastSelection | null>(null);
  const [timelineRefreshKey, setTimelineRefreshKey] = useState(0);

  const timelineAnchor = useMemo(() => {
    const originIsSupported = origin
      && origin.lat >= 36
      && origin.lat <= 40.5
      && origin.lng >= -84
      && origin.lng <= -74;
    return originIsSupported
      ? { lat: origin.lat, lng: origin.lng, label: `Regional forecast near ${origin.label}` }
      : { lat: 38.8462, lng: -77.3064, label: "Fairfax regional forecast anchor" };
  }, [origin]);

  const selectedForecastPeriods = useMemo(
    () => periodsForSelection(timelineForecast.periods, timelineSelection),
    [timelineForecast.periods, timelineSelection],
  );

  const visibleRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return locations
      .map((location) => ({ location, travel: estimateTravel(location, origin), advisory: consumptionAdviceFor(location.consumptionAdvisory, speciesIds) }))
      .filter(({ location, travel, advisory }) => {
        if (access !== "any" && !location.access.includes(access)) return false;
        if (waterbodyTypes.length > 0 && !waterbodyTypes.includes(location.waterbodyType)) return false;
        if (stockedOnly && !location.stocking) return false;
        if (harvestFilter === "hide-active" && advisory.status === "active") return false;
        if (harvestFilter === "keep-and-eat" && !["no-advisory-found", "no-selected-species-match"].includes(advisory.status)) return false;
        if (timeFilter === "walkable" && (!origin || travel.walkMinutes > 30)) return false;
        if (timeFilter !== "any" && timeFilter !== "walkable" && travel.driveMinutes > Number(timeFilter)) return false;
        if (!normalized) return true;
        const haystack = [
          location.name,
          location.waterbody,
          location.county,
          ...location.aliases,
          ...speciesIds.map((speciesId) => speciesById(speciesId)?.name ?? ""),
        ].join(" ").toLowerCase();
        return haystack.includes(normalized);
      });
  }, [access, harvestFilter, origin, query, speciesById, speciesIds, stockedOnly, timeFilter, waterbodyTypes, locations]);

  const ranked = useMemo(() => {
    return visibleRows
      .map(({ location, travel, advisory }) => {
        // With a target species, rank by that species. Without one, default to the
        // location's highest-scoring evidenced fish so a place can be explored solo.
        const sourceSpecies = speciesIds.length > 0
          ? speciesIds
          : [...new Set(location.evidence.map((evidence) => evidence.speciesId))];
        const matches = sourceSpecies.flatMap((speciesId) => {
          const baseOpportunity = opportunityFor(location, speciesId);
          const fish = speciesById(speciesId);
          if (!baseOpportunity || !fish) return [];
          const forecasted = timelineForecast.status === "ready"
            ? opportunityForForecast(
                baseOpportunity,
                speciesId,
                selectedForecastPeriods,
                timelineForecast.alerts,
              )
            : null;
          return [{
            fish,
            opportunity: forecasted?.opportunity ?? baseOpportunity,
            forecastPeriod: forecasted?.period,
          }];
        }).sort((a, b) => b.opportunity.score - a.opportunity.score);
        return { location, travel, advisory, opportunity: matches[0]?.opportunity ?? null, matches };
      })
      .filter((row) => Boolean(row.opportunity))
      .sort((a, b) => (b.opportunity!.score - a.opportunity!.score) || (b.matches.length - a.matches.length));
  }, [selectedForecastPeriods, speciesById, speciesIds, timelineForecast.alerts, timelineForecast.status, visibleRows]);

  useEffect(() => {
    if (speciesIds.length === 0) return;
    const selectedIsVisible = visibleRows.some(({ location }) => location.id === selectedId);
    if (ranked.length && (!selectedId || !selectedIsVisible)) {
      const timer = window.setTimeout(() => setSelectedId(ranked[0].location.id), 0);
      return () => window.clearTimeout(timer);
    }
  }, [ranked, selectedId, speciesIds, visibleRows]);

  const selected = selectedId ? ranked.find(({ location }) => location.id === selectedId) : undefined;
  const selectedLocation = selected?.location;
  const selectedOpportunity = selected?.opportunity ?? null;
  const selectedSpecies = speciesIds.map((id) => speciesById(id)).filter((item): item is NonNullable<typeof item> => Boolean(item));
  const mapLocations = useMemo(() => visibleRows.map(({ location }) => location), [visibleRows]);
  const mapOpportunities = useMemo(() => new Map(ranked.map((row) => [
    row.location.id,
    {
      score: row.opportunity!.score,
      speciesName: row.matches[0]?.fish.name ?? "",
      matchCount: row.matches.length,
    },
  ])), [ranked]);
  const activeAdvisoryCount = useMemo(() => mapLocations.filter((location) => consumptionAdviceFor(location.consumptionAdvisory, speciesIds).status === "active").length, [mapLocations, speciesIds]);

  const speciesHealth = useMemo(() => new Map(species.map((fish) => {
    const bestScore = Math.max(0, ...visibleRows.map(({ location }) => {
      const baseOpportunity = opportunityFor(location, fish.id);
      if (!baseOpportunity || timelineForecast.status !== "ready") return baseOpportunity?.score ?? 0;
      return opportunityForForecast(
        baseOpportunity,
        fish.id,
        selectedForecastPeriods,
        timelineForecast.alerts,
      )?.opportunity.score ?? baseOpportunity.score;
    }));
    return [fish.id, bestScore] as const;
  })), [selectedForecastPeriods, species, timelineForecast.alerts, timelineForecast.status, visibleRows]);

  const waterTypeCounts = useMemo(() => new Map(waterTypeOptions.map((option) => [
    option.value,
    locations.filter((location) => location.waterbodyType === option.value).length,
  ])), [locations]);

  const selectedSpeciesLabel = selectedSpecies.length === 0
    ? "Choose fish species"
    : selectedSpecies.length === 1
      ? selectedSpecies[0].name
      : `${selectedSpecies.length} species selected`;
  const travelLabel = timeOptions.find((option) => option.value === timeFilter)?.label ?? "Any travel time";
  const waterLabel = waterbodyTypes.length === 0
    ? stockedOnly ? "Stocked trout waters" : "Any water type"
    : waterbodyTypes.length === 1
      ? `${waterTypeOptions.find((option) => option.value === waterbodyTypes[0])?.label ?? "1 type"}${stockedOnly ? " · stocked" : ""}`
      : `${waterbodyTypes.length} water types`;
  const harvestLabel = harvestOptions.find((option) => option.value === harvestFilter)?.label ?? "Show every water";

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
    const timer = window.setTimeout(() => void loadFavorites(), 0);
    const refresh = () => void loadFavorites();
    window.addEventListener("focus", refresh);
    window.addEventListener("bitemap:favorites-changed", refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("bitemap:favorites-changed", refresh);
    };
  }, [loadFavorites]);

  // Preselect a species from the URL (?species=id), e.g. the fish guide's
  // "See on map" link.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const requested = new URLSearchParams(window.location.search).get("species");
      if (requested && speciesById(requested)) {
        setSpeciesIds([requested]);
        setResultsOpen(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [speciesById]);

  const refreshTimeline = useCallback(() => {
    setTimelineForecast((current) => ({ ...current, status: "loading", error: undefined }));
    setTimelineRefreshKey((current) => current + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setTimelineForecast((current) => ({ ...current, status: "loading", error: undefined }));
      try {
        const response = await fetch(
          `/api/conditions?lat=${timelineAnchor.lat}&lon=${timelineAnchor.lng}`,
          { cache: "no-store", signal: controller.signal },
        );
        const body = await response.json() as {
          periods?: NwsForecastPeriod[];
          alerts?: NwsAlert[];
          retrievedAt?: string;
          error?: string;
          detail?: string;
        };
        if (!response.ok || !body.periods?.length) {
          throw new Error(body.detail || body.error || "National Weather Service forecast unavailable.");
        }
        const periods = [...body.periods]
          .filter((period) => Number.isFinite(new Date(period.startTime).getTime()))
          .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
        if (periods.length === 0) throw new Error("The provider returned no supported forecast hours.");
        setTimelineForecast({
          status: "ready",
          periods,
          alerts: body.alerts ?? [],
          retrievedAt: body.retrievedAt,
        });
        setTimelineSelection((current) => {
          if (current && periodsForSelection(periods, current).length > 0) return current;
          return selectionFromSearch(window.location.search, periods);
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        setTimelineForecast({
          status: "error",
          periods: [],
          alerts: [],
          error: error instanceof Error ? error.message : "National Weather Service forecast unavailable.",
        });
        setTimelineSelection(null);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [timelineAnchor.lat, timelineAnchor.lng, timelineRefreshKey]);

  useEffect(() => {
    if (!timelineSelection || timelineForecast.status !== "ready") return;
    const url = new URL(window.location.href);
    const nextSearch = selectionSearch(url.search, timelineSelection);
    if (nextSearch === url.searchParams.toString()) return;
    url.search = nextSearch;
    window.history.replaceState(window.history.state, "", url);
  }, [timelineForecast.status, timelineSelection]);

  // Close any open top-of-page filter dropdown when clicking/pressing outside it
  // or pressing Escape. Selections inside a menu keep it open (multi-select).
  useEffect(() => {
    function closeOutside(event: Event) {
      const target = event.target as Node | null;
      document.querySelectorAll<HTMLDetailsElement>("details.filter-menu[open]").forEach((menu) => {
        if (!target || !menu.contains(target)) menu.removeAttribute("open");
      });
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        document.querySelectorAll<HTMLDetailsElement>("details.filter-menu[open]").forEach((menu) => menu.removeAttribute("open"));
      }
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  // When a spot is selected (e.g. by clicking its map marker), bring its result
  // card into view within the results list.
  useEffect(() => {
    if (!selectedId || !resultsOpen) return;
    const timer = setTimeout(() => {
      const list = document.querySelector<HTMLElement>(".results-list");
      const card = document.querySelector<HTMLElement>(`[data-location-id="${selectedId}"]`);
      if (!list || !card) return;
      const target = card.offsetTop - list.offsetTop - 96;
      list.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
    }, 150); // allow the panel open-transition + render to settle
    return () => clearTimeout(timer);
  }, [selectedId, resultsOpen]);

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
    if (!selectedLocation) return;
    const timer = window.setTimeout(() => void refreshConditions(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshConditions, selectedLocation]);

  async function toggleSaved(id: string) {
    const favoriteId = favoriteIds.get(id);
    try {
      const response = favoriteId
        ? await fetch(`/api/favorites/${favoriteId}`, { method: "DELETE" })
        : await fetch("/api/favorites", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ locationId: id, preferredSpecies: speciesIds[0] || undefined }),
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

  function toggleSpecies(value: string) {
    setSpeciesIds((current) => current.includes(value) ? current.filter((id) => id !== value) : [...current, value]);
    setSelectedId(undefined);
    setResultsOpen(true);
  }

  function toggleWaterType(value: WaterbodyType) {
    setWaterbodyTypes((current) => current.includes(value) ? current.filter((type) => type !== value) : [...current, value]);
    setSelectedId(undefined);
  }

  const selectMapLocation = useCallback((id: string) => {
    setSelectedId(id);
    const location = locations.find((item) => item.id === id);
    if (!location) return;
    const targets = speciesIds.length > 0 ? speciesIds : [...new Set(location.evidence.map((e) => e.speciesId))];
    if (targets.some((speciesId) => opportunityFor(location, speciesId))) {
      setResultsOpen(true);
    } else if (speciesIds.length > 0) {
      setToast(`${location.name} has no qualifying evidence for the selected species yet.`);
    } else {
      setToast(`${location.name} is verified public access, but no species has cleared the evidence gate yet.`);
    }
  }, [locations, speciesIds]);

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
            <FilterMenu label="Target species" value={selectedSpeciesLabel} icon={<Fish size={17} />} className="species-filter-menu" highlighted={speciesIds.length > 0}>
              <div className="filter-popover-heading">
                <div><strong>Choose one or more</strong><span>Colors show the best evidence-backed score in your current map.</span></div>
                {speciesIds.length > 0 && <button type="button" onClick={() => { setSpeciesIds([]); setSelectedId(undefined); }}>Clear</button>}
              </div>
              <div className="species-option-list">
                {species.map((item) => {
                  const score = speciesHealth.get(item.id) ?? 0;
                  const tier = score >= 70 ? "strong" : score >= 55 ? "fair" : score > 0 ? "limited" : "pending";
                  const selected = speciesIds.includes(item.id);
                  return (
                    <button type="button" className={`filter-option species-option ${selected ? "active" : ""}`} key={item.id} onClick={() => toggleSpecies(item.id)} aria-pressed={selected}>
                      <span className="option-check">{selected && <Check size={13} />}</span>
                      <span className="species-option-copy"><strong>{item.name}</strong><small>{item.habitat}</small></span>
                      <em className={`species-signal signal-${tier}`}>{score ? `${score} ${tier}` : "Evidence pending"}</em>
                    </button>
                  );
                })}
              </div>
              <p className="menu-footnote">With multiple targets, results use the strongest individual species score and show every supported match. Scores are never averaged.</p>
            </FilterMenu>

            <FilterMenu label="Travel range" value={travelLabel} icon={<Clock3 size={17} />} highlighted={timeFilter !== "any"}>
              <div className="compact-option-list">
                {timeOptions.map((option) => (
                  <button type="button" className={`filter-option compact-option ${timeFilter === option.value ? "active" : ""}`} key={option.value} disabled={option.value === "walkable" && !origin} onClick={(event) => {
                    setTimeFilter(option.value);
                    event.currentTarget.closest("details")?.removeAttribute("open");
                  }}>
                    <span className="option-check">{timeFilter === option.value && <Check size={13} />}</span>
                    <strong>{option.label}</strong>
                    {option.value === "walkable" && !origin && <small>Set a starting point first</small>}
                  </button>
                ))}
              </div>
            </FilterMenu>

            <FilterMenu label="Water type" value={waterLabel} icon={<Waves size={17} />} highlighted={waterbodyTypes.length > 0 || stockedOnly}>
              <div className="compact-option-list">
                {waterTypeOptions.map((option) => {
                  const count = waterTypeCounts.get(option.value) ?? 0;
                  const selected = waterbodyTypes.includes(option.value);
                  return (
                    <button type="button" className={`filter-option compact-option ${selected ? "active" : ""}`} key={option.value} disabled={count === 0} onClick={() => toggleWaterType(option.value)} aria-pressed={selected}>
                      <span className="option-check">{selected && <Check size={13} />}</span>
                      <strong>{option.label}</strong><small>{count || "Coverage coming"}</small>
                    </button>
                  );
                })}
              </div>
              <button type="button" className={`filter-option compact-option stocked-option ${stockedOnly ? "active" : ""}`} onClick={() => setStockedOnly((current) => !current)} aria-pressed={stockedOnly}>
                <span className="option-check">{stockedOnly && <Check size={13} />}</span>
                <strong>Official stocked trout waters</strong><small>{locations.filter((location) => location.stocking).length}</small>
              </button>
              {(waterbodyTypes.length > 0 || stockedOnly) && <button type="button" className="menu-clear" onClick={() => { setWaterbodyTypes([]); setStockedOnly(false); }}>Clear water filters</button>}
            </FilterMenu>

            <FilterMenu label="Harvest guidance" value={harvestLabel} icon={<ShieldCheck size={17} />} className="harvest-filter-menu" highlighted={harvestFilter !== "any"}>
              <div className="harvest-option-list">
                {harvestOptions.map((option) => (
                  <button type="button" className={`filter-option harvest-option ${harvestFilter === option.value ? "active" : ""}`} key={option.value} onClick={(event) => {
                    setHarvestFilter(option.value);
                    event.currentTarget.closest("details")?.removeAttribute("open");
                  }}>
                    <span className="option-check">{harvestFilter === option.value && <Check size={13} />}</span>
                    <span><strong>{option.label}</strong><small>{option.detail}</small></span>
                  </button>
                ))}
              </div>
              <p className="advisory-disclaimer"><AlertTriangle size={14} /> The filter follows the selected species, exact mapped access segment, and size rules where VDH provides them. No listed restriction is not proof that fish are safe.</p>
              <a className="official-advisory-link" href="https://www.vdh.virginia.gov/environmental-health/public-health-toxicology/fish-consumption-advisory/" target="_blank" rel="noreferrer">Open current Virginia advisories <ArrowRight size={13} /></a>
            </FilterMenu>

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
            <div className="map-summary">
              <span className="map-kicker">Northern Virginia</span>
              <strong>{visibleRows.length} verified access points{speciesIds.length > 0 ? ` · ${ranked.length} ranked` : ""}</strong>
            </div>
            <PredictionTimeline
              status={timelineForecast.status}
              periods={timelineForecast.periods}
              selection={timelineSelection}
              anchorLabel={timelineAnchor.label}
              retrievedAt={timelineForecast.retrievedAt}
              error={timelineForecast.error}
              onChange={setTimelineSelection}
              onRefresh={refreshTimeline}
            />
            <button className="results-toggle" onClick={() => setResultsOpen((open) => !open)} aria-expanded={resultsOpen}>
              <ListFilter size={17} /> {resultsOpen ? "Hide results" : speciesIds.length > 0 ? `Show ${ranked.length} ranked results` : "Open results"}
            </button>
          </div>
          <FishingMap
            locations={mapLocations}
            speciesIds={speciesIds}
            opportunities={mapOpportunities}
            selectedId={selectedId}
            origin={origin}
            onSelect={selectMapLocation}
          />
          <div className="map-legend">
            <span><i className="marker-hot" /> 70+ strong</span>
            <span><i className="marker-mid" /> 55-69 fair</span>
            <span><i className="marker-low" /> under 55</span>
            <span><i className="marker-pending" /> {speciesIds.length === 0 ? "access · evidence pending" : "evidence pending"}</span>
            {activeAdvisoryCount > 0 && <span><i className="marker-advisory" /> {activeAdvisoryCount} relevant VDH restriction{activeAdvisoryCount === 1 ? "" : "s"}</span>}
          </div>
          <div className="map-source"><ShieldCheck size={14} /> Access verified by official agency sources</div>
        </div>

        <aside className={`results-panel ${resultsOpen ? "open" : ""}`} aria-hidden={!resultsOpen}>
          <div className="results-heading">
            <div>
              <span className="eyebrow">{selectedSpecies.length === 1 ? `Ranked for ${selectedSpecies[0].short}` : selectedSpecies.length > 1 ? "Best supported selected target" : "Opportunity results"}</span>
              <h2>{selectedSpecies.length === 1 ? selectedSpecies[0].name : selectedSpecies.length > 1 ? `${selectedSpecies.length} selected species` : "Best fish by water"}</h2>
            </div>
            <button className="close-results" onClick={() => setResultsOpen(false)} aria-label="Collapse results"><PanelRightClose size={20} /></button>
          </div>

          <div className="ranking-note">
            <Info size={15} /> {timelineForecast.status === "ready"
              ? selectedSpecies.length > 1
                ? "Selected NWS time applied. Each spot uses its strongest selected species; scores stay separate."
                : selectedSpecies.length === 1
                  ? "Selected NWS time applied to official species evidence and the reviewed species activity profile."
                  : "Selected NWS time applied. Each water uses its strongest evidenced, forecast-supported target."
              : selectedSpecies.length > 1
                ? "Each spot is ranked by its strongest selected species; matching scores stay separate."
                : selectedSpecies.length === 1
                  ? "Rankings use official species evidence plus a seasonal activity estimate."
                  : "Each water is ranked by its strongest evidenced species. Pick a target species above to rank for a specific fish."}
            <Link href="/methodology">What this means</Link>
          </div>

          {ranked.length === 0 ? (
            <div className="empty-state">
              <Fish size={34} />
              <h3>No evidence-qualified matches</h3>
              <p>{selectedSpecies.length === 0
                ? "No evidenced fish match your current filters. Try a wider travel range or a different water type — access-only spots stay on the map."
                : "Try a wider travel range, another access method, or a different species. BiteMap will not fill gaps with invented species claims."}</p>
              <button onClick={() => { setQuery(""); setAccess("any"); setTimeFilter("any"); setWaterbodyTypes([]); setHarvestFilter("any"); }}>Clear filters</button>
            </div>
          ) : (
            <div className="results-list">
              {ranked.map(({ location, opportunity, travel, matches, advisory }, index) => {
                if (!opportunity) return null;
                const isSelected = location.id === selectedLocation?.id;
                const isSaved = favoriteIds.has(location.id);
                const walkable = origin && travel.walkMinutes <= 30;
                return (
                  <article className={`result-card ${isSelected ? "selected" : ""}`} key={location.id} data-location-id={location.id} onClick={() => setSelectedId(location.id)}>
                    <div className="rank-number">{String(index + 1).padStart(2, "0")}</div>
                    <div className={`score-orb score-${opportunity.score >= 70 ? "hot" : opportunity.score >= 55 ? "mid" : "low"}`}>
                      <strong>{opportunity.score}</strong><span>/100</span>
                    </div>
                    <div className="result-copy">
                      <div className="result-title">
                        <div>
                          <h3>{location.name}</h3>
                          <p>{location.waterbody} · {location.county} County</p>
                          {location.accessStatus === "listed" && (
                            <span className="access-chip access-listed"><Info size={11} /> Public parkland · confirm access</span>
                          )}
                          {location.accessStatus === "unverified" && (
                            <span className="access-chip access-unverified"><AlertTriangle size={11} /> Access unverified</span>
                          )}
                          {speciesIds.length === 0 && matches[0] && (
                            <span className="best-fish-chip"><Fish size={12} /> Top target: {matches[0].fish.name}</span>
                          )}
                        </div>
                        <button className={`heart-button ${isSaved ? "saved" : ""}`} onClick={(event) => { event.stopPropagation(); void toggleSaved(location.id); }} aria-label={`${isSaved ? "Remove" : "Save"} ${location.name}`}>
                          <Heart size={18} fill={isSaved ? "currentColor" : "none"} />
                        </button>
                      </div>
                      <div className="result-metrics">
                        <span><Navigation size={14} /> {travel.distanceMiles} mi · ~{travel.driveMinutes} min{travel.personalized ? " from start" : " estimate"}</span>
                        {walkable && <span><Footprints size={14} /> ~{travel.walkMinutes} min walk</span>}
                        <span><Clock3 size={14} /> {location.bestWindow}</span>
                        {matches[0]?.forecastPeriod && (
                          <span><CloudSun size={14} /> Modeled for {new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric" }).format(new Date(matches[0].forecastPeriod.startTime))}</span>
                        )}
                        <span className={`confidence confidence-${opportunity.confidenceLabel.toLowerCase()}`}>{opportunity.confidenceLabel} confidence</span>
                        <span className={`advisory-badge advisory-${advisory.status}`}>
                          {advisory.status === "active" ? <AlertTriangle size={13} /> : advisory.status === "jurisdiction-check" ? <Info size={13} /> : <ShieldCheck size={13} />}
                          {advisory.label}
                        </span>
                      </div>
                      {advisory.status === "active" && advisory.matchingRestrictions.length > 0 && (
                        <div className="advisory-rule-preview">
                          {advisory.matchingRestrictions.slice(0, 3).map((restriction) => (
                            <span className={`restriction-${restriction.severity}`} key={restriction.id}>
                              <strong>{restriction.label}</strong> {restriction.speciesLabel}{restriction.sizeQualifier ? ` · ${restriction.sizeQualifier}` : ""}
                            </span>
                          ))}
                          {advisory.matchingRestrictions.length > 3 && <small>+{advisory.matchingRestrictions.length - 3} more rules</small>}
                        </div>
                      )}
                      {matches.length > 1 && <div className="species-match-row" aria-label="Matching selected species">
                        {matches.map((match) => <span key={match.fish.id}>{match.fish.short} <strong>{match.opportunity.score}</strong></span>)}
                      </div>}
                      <p className="why-line"><strong>Why it ranks:</strong> {opportunity.evidence.evidenceSummary}</p>
                      <div className="result-actions">
                        <a href={googleDirectionsUrl(location, origin)} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}><Navigation size={14} /> Google Maps directions</a>
                        <Link href={`/locations/${location.id}${speciesIds.length > 0 ? `?species=${speciesIds.join(",")}` : ""}`} onClick={(event) => event.stopPropagation()}>Spot details <ArrowRight size={14} /></Link>
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
            <div><span>{selected?.matches[0]?.forecastPeriod ? "Selected forecast" : "NWS forecast"}</span><strong>{selected?.matches[0]?.forecastPeriod ? `${selected.matches[0].forecastPeriod.temperature}°${selected.matches[0].forecastPeriod.temperatureUnit}` : live.status === "ready" ? `${live.temperature}°${live.temperatureUnit ?? "F"}` : live.status === "loading" ? "Refreshing..." : "Unavailable"}</strong></div>
            <small>{selected?.matches[0]?.forecastPeriod?.shortForecast ?? (live.status === "ready" ? live.shortForecast : "No fabricated fallback")}</small>
          </div>
          <div className="condition-cell">
            <Wind size={19} />
            <div><span>Wind</span><strong>{selected?.matches[0]?.forecastPeriod ? `${selected.matches[0].forecastPeriod.windDirection} ${selected.matches[0].forecastPeriod.windSpeed}` : live.status === "ready" ? `${live.windDirection ?? ""} ${live.windSpeed ?? ""}` : "—"}</strong></div>
            <small>{selected?.matches[0]?.forecastPeriod ? "Selected NWS period" : live.status === "ready" ? "Official hourly period" : "Awaiting provider"}</small>
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
          <button className="refresh-button" onClick={() => { refreshTimeline(); void refreshConditions(); }} aria-label="Refresh live conditions"><RefreshCw size={17} /></button>
        </section>
      )}
    </main>
  );
}
