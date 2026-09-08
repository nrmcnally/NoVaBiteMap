"use client";

import { AlertTriangle, CheckCircle2, Droplets, ExternalLink, Gauge, LoaderCircle, Waves } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  buildForecast,
  type HydrologyMetric,
  type HydrologyResponse,
  type NwsAlert,
  type NwsForecastPeriod,
} from "../lib/forecast";

type ConditionsResponse = {
  periods?: NwsForecastPeriod[];
  alerts?: NwsAlert[];
  retrievedAt?: string;
  provider?: string;
  error?: string;
};

type Props = {
  locationId: string;
  latitude: number;
  longitude: number;
  speciesId: string;
  speciesName: string;
  availability: number;
  quality: number | null;
  accessFit: number;
  baseConfidence: number;
  associationFactor: number;
  hydrologyRelevant: boolean;
  wadingAvailable: boolean;
};

type WaterTemperatureState = {
  status: "observed" | "estimated-calibrated" | "estimated-regional" | "unavailable";
  valueF: number | null;
  rangeF: [number, number] | null;
  confidence: number;
  source: string | null;
  modelVersion: string | null;
  reason?: string;
};

type CanonicalForecastResponse = {
  waterTempStatus: WaterTemperatureState["status"];
  waterTemperature: WaterTemperatureState;
  forecast: {
    hourly: Array<{
      startTime: string;
      temperature: number;
      temperatureUnit: string;
      shortForecast: string;
      windMph: number;
      precipitationProbability: number | null;
      score: number;
      waterTemperatureF: number | null;
      waterTemperatureStatus: WaterTemperatureState["status"];
      waterTemperatureRangeF: [number, number] | null;
    }>;
    days: Array<{
      dateKey: string;
      score: number;
      bestHour: number;
      forecast: string;
      temperature: number;
      temperatureUnit: string;
      confidence: number;
      confidenceLabel: "High" | "Moderate" | "Low";
      waterTemperatureF: number | null;
      waterTemperatureStatus: WaterTemperatureState["status"];
      waterTemperatureRangeF: [number, number] | null;
    }>;
    activeSafetyAlerts: NwsAlert[];
    rapidRise: boolean;
    explanation: string[];
  };
};

type LiveState = {
  status: "loading" | "ready" | "partial" | "unavailable";
  conditions: ConditionsResponse | null;
  hydrology: HydrologyResponse | null;
  canonical: CanonicalForecastResponse | null;
};

function metricValue(key: string, metric: HydrologyMetric) {
  if (key === "waterTemperature") {
    const fahrenheit = metric.value * 9 / 5 + 32;
    return `${metric.value.toFixed(1)}°C · ${fahrenheit.toFixed(0)}°F`;
  }
  const decimals = key === "discharge" ? 0 : 2;
  return `${metric.value.toFixed(decimals)} ${metric.unit}`;
}

function metricTrend(metric: HydrologyMetric) {
  const prefix = metric.delta > 0 ? "+" : "";
  return `${metric.direction} · ${prefix}${metric.delta} over ${metric.windowHours}h`;
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
  }).format(new Date(value));
}

function hourLabel(hour24: number) {
  const suffix = hour24 < 12 ? "AM" : "PM";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:00 ${suffix}`;
}

function dayLabel(dateKey: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${dateKey}T12:00:00-04:00`));
}

function canonicalForDisplay(payload: CanonicalForecastResponse) {
  return {
    activeSafetyAlerts: payload.forecast.activeSafetyAlerts,
    rapidRise: payload.forecast.rapidRise,
    explanation: payload.forecast.explanation,
    hourly: payload.forecast.hourly.map((hour) => ({
      ...hour,
      timeLabel: timeLabel(hour.startTime),
    })),
    days: payload.forecast.days.map((day) => ({
      ...day,
      dayLabel: dayLabel(day.dateKey),
      bestTime: hourLabel(day.bestHour),
    })),
  };
}

function temperatureNote(state: WaterTemperatureState | undefined) {
  if (!state || state.status === "unavailable" || state.valueF === null) {
    return "Water temperature is unavailable. The air temperature shown above is only weather context.";
  }
  if (state.status === "observed") {
    return `Nearby USGS water temperature: ${state.valueF.toFixed(0)}°F. The gauge's location and river connection affect forecast confidence.`;
  }
  const range = state.rangeF
    ? `; model range ${state.rangeF[0].toFixed(0)}–${state.rangeF[1].toFixed(0)}°F`
    : "";
  const label = state.status === "estimated-calibrated"
    ? "gage-calibrated estimate"
    : "regional stream estimate";
  return `Estimated surface water temperature: ${state.valueF.toFixed(0)}°F (${label}${range}). This is a stream estimate, not a direct measurement at the spot.`;
}

export function LocationIntelligence(props: Props) {
  const [state, setState] = useState<LiveState>({
    status: "loading",
    conditions: null,
    hydrology: null,
    canonical: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    async function loadCanonical() {
      try {
        const endpoint = new URL("/api/live-forecast", window.location.origin);
        endpoint.searchParams.set("locationId", props.locationId);
        endpoint.searchParams.set("speciesId", props.speciesId);
        endpoint.searchParams.set("wading", String(props.wadingAvailable));
        const response = await fetch(endpoint, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok || controller.signal.aborted) return;
        const canonical = await response.json() as CanonicalForecastResponse;
        if (!controller.signal.aborted) {
          setState((current) => ({
            ...current,
            status: "ready",
            canonical,
          }));
        }
      } catch {
        // The public NWS/USGS route below remains the explicit degraded fallback.
      }
    }

    async function load() {
      const [conditionsResult, hydrologyResult] = await Promise.allSettled([
        fetch(`/api/conditions?lat=${props.latitude}&lon=${props.longitude}`, { signal: controller.signal, cache: "no-store" }),
        fetch(`/api/hydrology?locationId=${encodeURIComponent(props.locationId)}`, { signal: controller.signal, cache: "no-store" }),
      ]);
      if (controller.signal.aborted) return;

      const conditions = conditionsResult.status === "fulfilled"
        ? await conditionsResult.value.json() as ConditionsResponse
        : null;
      const hydrology = hydrologyResult.status === "fulfilled"
        ? await hydrologyResult.value.json() as HydrologyResponse
        : null;
      const forecastReady = Boolean(conditions?.periods?.length);
      const hydroReady = Boolean(hydrology?.available);
      setState((current) => ({
        ...current,
        status: current.canonical
          ? "ready"
          : forecastReady && (hydroReady || !props.hydrologyRelevant)
            ? "ready"
            : forecastReady || hydroReady
              ? "partial"
              : "unavailable",
        conditions,
        hydrology,
      }));
    }
    void loadCanonical();
    void load();
    return () => controller.abort();
  }, [
    props.hydrologyRelevant,
    props.latitude,
    props.locationId,
    props.longitude,
    props.speciesId,
    props.wadingAvailable,
  ]);

  const forecast = useMemo(() => {
    if (state.canonical) return canonicalForDisplay(state.canonical);
    if (!state.conditions?.periods?.length) return null;
    return buildForecast({
      periods: state.conditions.periods,
      alerts: state.conditions.alerts ?? [],
      availability: props.availability,
      quality: props.quality,
      accessFit: props.accessFit,
      baseConfidence: props.baseConfidence,
      associationFactor: props.associationFactor,
      hydrologyRelevant: props.hydrologyRelevant,
      hydrology: state.hydrology,
      wadingSelected: props.wadingAvailable,
    });
  }, [props, state.canonical, state.conditions, state.hydrology]);

  const hydroMetrics = Object.entries(state.hydrology?.metrics ?? {}) as Array<[string, HydrologyMetric]>;

  return (
    <article className="live-intelligence-card">
      <div className="section-heading live-heading">
        <div><span className="eyebrow">Today through day five</span><h2>Live fishing outlook</h2></div>
        <span className={`live-provider-badge provider-${state.status}`}>
          {state.status === "loading" ? <LoaderCircle className="spin" size={14} /> : state.status === "ready" ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          {state.status === "loading" ? "Loading current conditions" : state.canonical ? "Full forecast" : state.status === "ready" ? "NWS + USGS live" : state.status === "partial" ? "Some live data unavailable" : "Seasonal estimate"}
        </span>
      </div>

      {forecast?.activeSafetyAlerts.map((alert) => (
        <div className="live-alert" key={alert.id}><AlertTriangle size={18} /><div><strong>{alert.event}</strong><span>{alert.headline}</span></div></div>
      ))}
      {forecast?.rapidRise && (
        <div className="live-alert"><Waves size={18} /><div><strong>Rapid rise at nearby stream gauge</strong><span>Do not use the score to judge wading or boating safety. Check the water and official warnings.</span></div></div>
      )}

      {forecast ? (
        <>
          <div className="live-hour-strip" aria-label={`Live hourly ${props.speciesName} opportunity`}>
            {forecast.hourly.slice(0, 12).map((hour) => (
              <div className="live-hour" key={hour.startTime}>
                <span>{hour.timeLabel}</span>
                <strong>{hour.score}</strong>
                <i style={{ height: `${Math.max(10, hour.score)}%` }} />
                <small>{hour.temperature}°{hour.temperatureUnit}</small>
                <em>{hour.precipitationProbability ?? 0}% rain · {hour.windMph} mph</em>
              </div>
            ))}
          </div>
          <p className="forecast-temperature-note">{temperatureNote(state.canonical?.waterTemperature)}</p>
          <div className="multi-day-grid">
            {forecast.days.map((day, index) => (
              <section className={index === 0 ? "today" : ""} key={day.dateKey}>
                <span>{index === 0 ? "Today" : day.dayLabel}</span>
                <strong>{day.score}<small>/100</small></strong>
                <p>Best around {day.bestTime}</p>
                <em>{day.forecast} · {day.temperature}°{day.temperatureUnit}</em>
                <small>{day.confidenceLabel} confidence · {day.confidence}%</small>
              </section>
            ))}
          </div>
          <div className="forecast-basis">
            {forecast.explanation.map((item) => <span key={item}>{item}</span>)}
          </div>
        </>
      ) : (
        <>
          <div className="fallback-note"><AlertTriangle size={16} /> The live forecast is unavailable right now, so no hourly bite estimate is shown. The fish records above are still available.</div>
        </>
      )}

      <div className="hydrology-panel">
        <div className="hydrology-title">
          <div><span className="eyebrow">Nearby stream gauge</span><h3>{state.hydrology?.association?.stationName ?? "No suitable stream gauge"}</h3></div>
          {state.hydrology?.association && <a href={state.hydrology.association.monitorUrl} target="_blank" rel="noreferrer">USGS station {state.hydrology.association.stationId} <ExternalLink size={13} /></a>}
        </div>
        {hydroMetrics.length > 0 ? (
          <div className="hydrology-metrics">
            {hydroMetrics.slice(0, 4).map(([key, metric]) => (
              <div key={key}>{key === "waterTemperature" ? <Droplets size={17} /> : <Gauge size={17} />}<span>{metric.label}<strong>{metricValue(key, metric)}</strong><small>{metricTrend(metric)}</small></span></div>
            ))}
          </div>
        ) : <p>{state.hydrology?.error ?? state.hydrology?.reason ?? "Waiting for the latest USGS reading."}</p>}
        {state.hydrology?.association && <small>{state.hydrology.association.basis} {state.hydrology.association.limitation} Data are provisional and may be revised.</small>}
      </div>
    </article>
  );
}
