import type { NwsForecastPeriod } from "./forecast";

export type ForecastSelection = {
  mode: "hourly" | "daily";
  key: string;
};

export type ForecastDay = {
  key: string;
  label: string;
  periods: NwsForecastPeriod[];
};

const EASTERN_TIME_ZONE = "America/New_York";

export function forecastDateKey(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: EASTERN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function forecastHourLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
  }).format(new Date(value));
}

export function forecastDays(periods: NwsForecastPeriod[]): ForecastDay[] {
  const grouped = new Map<string, NwsForecastPeriod[]>();
  for (const period of periods) {
    const key = forecastDateKey(period.startTime);
    grouped.set(key, [...(grouped.get(key) ?? []), period]);
  }
  return [...grouped.entries()].map(([key, dayPeriods]) => ({
    key,
    label: new Intl.DateTimeFormat("en-US", {
      timeZone: EASTERN_TIME_ZONE,
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(new Date(dayPeriods[0].startTime)),
    periods: dayPeriods,
  }));
}

export function periodsForSelection(
  periods: NwsForecastPeriod[],
  selection: ForecastSelection | null,
) {
  if (!selection) return [];
  if (selection.mode === "hourly") {
    const period = periods.find((item) => item.startTime === selection.key);
    return period ? [period] : [];
  }
  return periods.filter((period) => forecastDateKey(period.startTime) === selection.key);
}

export function selectionFromSearch(
  search: string,
  periods: NwsForecastPeriod[],
): ForecastSelection | null {
  if (periods.length === 0) return null;
  const params = new URLSearchParams(search);
  if (params.get("view") === "daily") {
    const day = params.get("day");
    if (day && forecastDays(periods).some((item) => item.key === day)) {
      return { mode: "daily", key: day };
    }
  }
  const at = params.get("at");
  if (at && periods.some((period) => period.startTime === at)) {
    return { mode: "hourly", key: at };
  }
  return { mode: "hourly", key: periods[0].startTime };
}

export function selectionSearch(
  currentSearch: string,
  selection: ForecastSelection,
) {
  const params = new URLSearchParams(currentSearch);
  params.set("view", selection.mode);
  if (selection.mode === "hourly") {
    params.set("at", selection.key);
    params.delete("day");
  } else {
    params.set("day", selection.key);
    params.delete("at");
  }
  return params.toString();
}
