"use client";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CloudSun,
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
    if (selection.mode === "daily") onChange({ mode: "daily", key: days[nextIndex].key });
    else onChange({ mode: "hourly", key: periods[nextIndex].startTime });
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

  return (
    <section className="prediction-timeline" aria-label="Interactive fishing prediction timeline">
      <div className="timeline-heading">
        <div>
          <span className="eyebrow"><Clock3 size={13} /> Interactive prediction timeline</span>
          <strong>{anchorLabel}</strong>
          <small>One selected forecast state drives every score, result rank, and map color.</small>
        </div>
        <div className="timeline-mode" role="group" aria-label="Forecast resolution">
          <button
            type="button"
            className={selection?.mode !== "daily" ? "active" : ""}
            disabled={status !== "ready"}
            onClick={() => setMode("hourly")}
          ><Clock3 size={14} /> Hour</button>
          <button
            type="button"
            className={selection?.mode === "daily" ? "active" : ""}
            disabled={status !== "ready"}
            onClick={() => setMode("daily")}
          ><CalendarDays size={14} /> Day</button>
        </div>
      </div>

      {status === "loading" && (
        <div className="timeline-state"><LoaderCircle className="spin" size={18} /> Loading the exact NWS forecast window…</div>
      )}

      {status === "error" && (
        <div className="timeline-state timeline-error">
          <CloudSun size={18} />
          <span><strong>Live forecast unavailable.</strong> Seasonal evidence scores remain visible; BiteMap did not invent replacement weather. {error}</span>
          <button type="button" onClick={onRefresh}><RefreshCw size={14} /> Retry</button>
        </div>
      )}

      {status === "ready" && selection && periods.length > 0 && (
        <>
          <div className="timeline-controls">
            <button type="button" onClick={() => step(-1)} disabled={activeIndex <= 0} aria-label={`Previous ${selection.mode === "daily" ? "day" : "hour"}`}><ChevronLeft size={17} /></button>
            <button type="button" className="timeline-now" onClick={() => onChange({ mode: "hourly", key: periods[0].startTime })}>Now</button>
            <div className="timeline-selection" aria-live="polite">
              <span>{selection.mode === "daily" ? "Daily outlook" : "Hourly forecast"}</span>
              <strong>{selection.mode === "daily" ? days[dailyIndex]?.label : forecastHourLabel(selectedPeriod!.startTime)}</strong>
              <small>
                {selection.mode === "daily"
                  ? `${selectedPeriods.length} provider-backed hours · each species uses its best supported hour`
                  : `${selectedPeriod!.shortForecast} · ${selectedPeriod!.temperature}°${selectedPeriod!.temperatureUnit} · ${selectedPeriod!.windDirection} ${selectedPeriod!.windSpeed}`}
              </small>
            </div>
            <button type="button" onClick={() => step(1)} disabled={activeIndex >= activeLength - 1} aria-label={`Next ${selection.mode === "daily" ? "day" : "hour"}`}><ChevronRight size={17} /></button>
            <button type="button" className="timeline-refresh" onClick={onRefresh} aria-label="Refresh NWS forecast"><RefreshCw size={15} /></button>
          </div>

          {selection.mode === "hourly" ? (
            <label className="timeline-range">
              <span>Hour {hourlyIndex + 1} of {periods.length}</span>
              <input
                type="range"
                min={0}
                max={Math.max(0, periods.length - 1)}
                value={Math.max(0, hourlyIndex)}
                onChange={(event) => onChange({ mode: "hourly", key: periods[Number(event.target.value)].startTime })}
                aria-label="Forecast hour"
                aria-valuetext={selectedPeriod ? forecastHourLabel(selectedPeriod.startTime) : undefined}
              />
            </label>
          ) : (
            <div className="timeline-days" role="list" aria-label="Provider-backed forecast days">
              {days.map((day) => (
                <button
                  type="button"
                  role="listitem"
                  key={day.key}
                  className={selection.key === day.key ? "active" : ""}
                  onClick={() => onChange({ mode: "daily", key: day.key })}
                >
                  <strong>{day.label}</strong><span>{day.periods.length} hours</span>
                </button>
              ))}
            </div>
          )}

          <div className="timeline-coverage">
            <span>NWS coverage: {forecastHourLabel(coverageStart!)} through {forecastHourLabel(coverageEnd!)}. Times beyond this boundary are unavailable.</span>
            <small>{refreshedLabel ? `Provider updated ${refreshedLabel}` : "National Weather Service"} · air temperature is not treated as water temperature</small>
          </div>
        </>
      )}
    </section>
  );
}
