"use client";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CloudSun,
  Info,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import type { NwsForecastPeriod } from "../lib/forecast";
import {
  forecastDays,
  forecastHourLabel,
  periodsForSelection,
  type ForecastSelection,
} from "../lib/prediction-timeline";

type PredictionTimelineProps = {
  status: "loading" | "ready" | "error";
  periods: NwsForecastPeriod[];
  selection: ForecastSelection | null;
  anchorLabel: string;
  retrievedAt?: string;
  error?: string;
  onChange: (selection: ForecastSelection) => void;
  onRefresh: () => void;
};

export function PredictionTimeline({
  status,
  periods,
  selection,
  anchorLabel,
  retrievedAt,
  error,
  onChange,
  onRefresh,
}: PredictionTimelineProps) {
  const days = forecastDays(periods);
  const selectedPeriods = periodsForSelection(periods, selection);
  const hourlyIndex = selection?.mode === "hourly"
    ? periods.findIndex((period) => period.startTime === selection.key)
    : -1;
  const dailyIndex = selection?.mode === "daily"
    ? days.findIndex((day) => day.key === selection.key)
    : -1;
  const selectedPeriod = selection?.mode === "hourly" ? selectedPeriods[0] : undefined;
  const activeIndex = selection?.mode === "daily" ? dailyIndex : hourlyIndex;
  const activeLength = selection?.mode === "daily" ? days.length : periods.length;

  function step(delta: number) {
    if (!selection || activeIndex < 0) return;
    const nextIndex = Math.max(0, Math.min(activeLength - 1, activeIndex + delta));
    selectIndex(nextIndex);
  }

  function selectIndex(index: number) {
    if (!selection) return;
    if (selection.mode === "daily") onChange({ mode: "daily", key: days[index].key });
    else onChange({ mode: "hourly", key: periods[index].startTime });
  }

  function setMode(mode: ForecastSelection["mode"]) {
    if (!selection || periods.length === 0) return;
    if (mode === "daily") {
      const currentDate = selection.mode === "hourly"
        ? new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/New_York",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date(selection.key))
        : selection.key;
      const day = days.find((item) => item.key === currentDate) ?? days[0];
      onChange({ mode: "daily", key: day.key });
      return;
    }
    const period = selection.mode === "daily"
      ? periods.find((item) => selectedPeriods.some((candidate) => candidate.startTime === item.startTime))
      : selectedPeriod;
    onChange({ mode: "hourly", key: (period ?? periods[0]).startTime });
  }

  const coverageStart = periods[0]?.startTime;
  const coverageEnd = periods.at(-1)?.startTime;
  const refreshedLabel = retrievedAt
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(retrievedAt))
    : null;

  const selectionTitle = status === "ready" && selection
    ? selection.mode === "daily"
      ? days[dailyIndex]?.label
      : forecastHourLabel(selectedPeriod!.startTime)
    : status === "loading"
      ? "Loading forecast…"
      : "Forecast unavailable";
  const selectionSummary = status === "ready" && selection
    ? selection.mode === "daily"
      ? `${selectedPeriods.length} forecast hours · best window by species`
      : `${selectedPeriod!.shortForecast} · ${selectedPeriod!.temperature}°${selectedPeriod!.temperatureUnit} · ${selectedPeriod!.windDirection} ${selectedPeriod!.windSpeed}`
    : status === "loading"
      ? "Checking NWS coverage and precomputing scores"
      : "Seasonal scores remain visible";

  return (
    <section className={`prediction-timeline timeline-${status} timeline-${selection?.mode ?? "hourly"}`} aria-label="Interactive fishing prediction timeline">
      <div className="timeline-main">
        <div className="timeline-readout" aria-live="polite">
          <span><Clock3 size={12} /> Bite forecast</span>
          <strong>{selectionTitle}</strong>
          <small>{selectionSummary}</small>
        </div>

        {status === "loading" && <LoaderCircle className="spin timeline-loader" size={18} />}

        {status === "error" && (
          <div className="timeline-error">
            <CloudSun size={16} />
            <span>{error || "BiteMap did not invent replacement weather."}</span>
            <button type="button" onClick={onRefresh}><RefreshCw size={13} /> Retry</button>
          </div>
        )}

        {status === "ready" && selection && periods.length > 0 && (
          <>
            <div className="timeline-scrubber">
              <button type="button" onClick={() => step(-1)} disabled={activeIndex <= 0} aria-label={`Previous ${selection.mode === "daily" ? "day" : "hour"}`}><ChevronLeft size={16} /></button>
              <label className="timeline-range">
                <span>{selection.mode === "daily" ? `${dailyIndex + 1}/${days.length}` : `${hourlyIndex + 1}/${periods.length}`}</span>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, activeLength - 1)}
                  value={Math.max(0, activeIndex)}
                  onChange={(event) => selectIndex(Number(event.target.value))}
                  aria-label={`Forecast ${selection.mode === "daily" ? "day" : "hour"}`}
                  aria-valuetext={selection.mode === "daily" ? days[dailyIndex]?.label : selectedPeriod ? forecastHourLabel(selectedPeriod.startTime) : undefined}
                />
              </label>
              <button type="button" onClick={() => step(1)} disabled={activeIndex >= activeLength - 1} aria-label={`Next ${selection.mode === "daily" ? "day" : "hour"}`}><ChevronRight size={16} /></button>
            </div>

            <div className="timeline-actions">
              <button type="button" className="timeline-now" onClick={() => onChange({ mode: "hourly", key: periods[0].startTime })}>Now</button>
              <div className="timeline-mode" role="group" aria-label="Forecast resolution">
                <button type="button" className={selection.mode === "hourly" ? "active" : ""} onClick={() => setMode("hourly")}><Clock3 size={12} /> Hour</button>
                <button type="button" className={selection.mode === "daily" ? "active" : ""} onClick={() => setMode("daily")}><CalendarDays size={12} /> Day</button>
              </div>
              <details className="timeline-info">
                <summary aria-label="Forecast coverage details"><Info size={15} /></summary>
                <div>
                  <strong>{anchorLabel}</strong>
                  <span>NWS coverage: {forecastHourLabel(coverageStart!)} through {forecastHourLabel(coverageEnd!)}. Times beyond this boundary are unavailable.</span>
                  <small>{selection.mode === "daily" ? "Day view: each species uses its best supported hour for the selected day. " : ""}{refreshedLabel ? `Provider updated ${refreshedLabel}. ` : ""}Air temperature is not treated as water temperature.</small>
                </div>
              </details>
              <button type="button" className="timeline-refresh" onClick={onRefresh} aria-label="Refresh NWS forecast"><RefreshCw size={14} /></button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
