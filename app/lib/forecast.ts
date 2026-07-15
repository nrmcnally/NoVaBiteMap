export type NwsForecastPeriod = {
  startTime: string;
  temperature: number;
  temperatureUnit: string;
  shortForecast: string;
  windSpeed: string;
  windDirection: string;
  windGust?: string | null;
  isDaytime?: boolean | null;
  precipitationProbability: number | null;
};

export type NwsAlert = {
  id: string;
  event: string;
  severity: string;
  urgency: string;
  headline: string;
  description: string;
  instruction: string | null;
  onset: string | null;
  expires: string | null;
};

export type HydrologyMetric = {
  value: number;
  unit: string;
  observedAt: string;
  direction: "rising" | "falling" | "steady";
  delta: number;
  deltaPercent: number | null;
  windowHours: number;
  qualifiers: string[];
  label: string;
};

export type HydrologyResponse = {
  available: boolean;
  freshness?: "fresh" | "stale" | "old" | "unavailable";
  ageHours?: number | null;
  observedAt?: string | null;
  provisional?: boolean;
  association?: {
    stationId: string;
    stationName: string;
    monitorUrl: string;
    associationFactor: number;
    associationType: "same-waterbody" | "connected-reach";
    basis: string;
    limitation: string;
  };
  metrics?: Partial<Record<"discharge" | "gageHeight" | "waterTemperature" | "turbidity" | "specificConductance" | "dissolvedOxygen", HydrologyMetric>>;
  disclaimer?: string;
  error?: string;
  reason?: string;
};

export type ForecastInput = {
  periods: NwsForecastPeriod[];
  alerts: NwsAlert[];
  availability: number;
  quality: number | null;
  accessFit: number;
  baseConfidence: number;
  associationFactor: number;
  hydrologyRelevant: boolean;
  hydrology?: HydrologyResponse | null;
  wadingSelected?: boolean;
};

function maxWindMph(value: string) {
  const matches = value.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  return Math.max(0, ...matches);
}
function localParts(value: string) {
  const date = new Date(value);
  return {
    dateKey: new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(date),
    dayLabel: new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric" }).format(date),
    hour: Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" }).format(date)),
    timeLabel: new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric" }).format(date),
  };
}

function timeSuitability(hour: number) {
  if ((hour >= 5 && hour <= 8) || (hour >= 17 && hour <= 20)) return 0.86;
  if ((hour >= 9 && hour <= 11) || (hour >= 15 && hour <= 16)) return 0.68;
  if (hour >= 12 && hour <= 14) return 0.54;
  return 0.48;
}

function windSuitability(mph: number) {
  if (mph <= 8) return 0.82;
  if (mph <= 15) return 0.68;
  if (mph <= 24) return 0.42;
  return 0.18;
}

function precipitationSuitability(chance: number | null, forecast: string) {
  const severe = /thunderstorm|heavy rain|tornado/i.test(forecast);
  if (severe) return 0.2;
  const probability = chance ?? 0;
  if (probability <= 20) return 0.76;
  if (probability <= 50) return 0.64;
  if (probability <= 75) return 0.42;
  return 0.26;
}

function isSafetyAlert(alert: NwsAlert) {
  return /flash flood|flood warning|severe thunderstorm warning|tornado|hurricane|tropical storm warning/i.test(`${alert.event} ${alert.headline}`);
}

function rapidRise(hydrology?: HydrologyResponse | null) {
  if (!hydrology?.available || hydrology.freshness === "old") return false;
  const discharge = hydrology.metrics?.discharge;
  const gage = hydrology.metrics?.gageHeight;
  return Boolean(
    (discharge?.direction === "rising" && (discharge.deltaPercent ?? 0) >= 50)
    || (gage?.direction === "rising" && gage.delta >= 0.75),
  );
}

export function buildForecast(input: ForecastInput) {
  const activeSafetyAlerts = input.alerts.filter(isSafetyAlert);
  const fastRise = rapidRise(input.hydrology);
  const safetyCap = activeSafetyAlerts.length > 0 || (input.wadingSelected && fastRise) ? 35 : null;
  const hourly = input.periods.map((period) => {
    const local = localParts(period.startTime);
    const wind = maxWindMph(period.windSpeed);
    const time = timeSuitability(local.hour);
    const windFit = windSuitability(wind);
    const precipitation = precipitationSuitability(period.precipitationProbability, period.shortForecast);
    const activity = 0.5 * time + 0.25 * windFit + 0.25 * precipitation;
    const quality = input.quality ?? 0.5;
    const raw = Math.round(100 * Math.pow(input.availability, 1.5) * (0.35 * quality + 0.5 * activity + 0.15 * input.accessFit));
    const score = safetyCap === null ? raw : Math.min(raw, safetyCap);
    return {
      ...period,
      ...local,
      windMph: wind,
      activity: Number(activity.toFixed(3)),
      score: Math.max(0, Math.min(100, score)),
      factors: {
        timeOfDay: Number(time.toFixed(2)),
        wind: Number(windFit.toFixed(2)),
        precipitation: Number(precipitation.toFixed(2)),
      },
    };
  });

  const grouped = new Map<string, typeof hourly>();
  for (const period of hourly) grouped.set(period.dateKey, [...(grouped.get(period.dateKey) ?? []), period]);
  const horizonFactors = [1, 0.92, 0.84, 0.78, 0.72];
  const days = [...grouped.values()].slice(0, 5).map((periods, index) => {
    const best = [...periods].sort((a, b) => b.score - a.score)[0];
    const average = Math.round(periods.reduce((total, period) => total + period.score, 0) / periods.length);
    const hydroFactor = input.hydrologyRelevant
      ? input.hydrology?.available ? input.associationFactor : 0.55
      : 1;
    const confidence = Math.round(input.baseConfidence * horizonFactors[index] * hydroFactor);
    return {
      dateKey: best.dateKey,
      dayLabel: best.dayLabel,
      score: best.score,
      average,
      bestTime: best.timeLabel,
      forecast: best.shortForecast,
      temperature: best.temperature,
      temperatureUnit: best.temperatureUnit,
      confidence,
      confidenceLabel: confidence >= 75 ? "High" : confidence >= 50 ? "Moderate" : "Low",
    };
  });

  return {
    hourly,
    days,
    safetyCap,
    activeSafetyAlerts,
    rapidRise: fastRise,
    explanation: [
      "Availability and fishery quality remain evidence-gated.",
      "Hourly activity uses forecast time of day, wind, and precipitation; air temperature is shown but is not treated as water temperature.",
      input.hydrology?.available ? `USGS ${input.hydrology.association?.stationId} adds freshness and association confidence.` : "Hydrology is unavailable or unassociated, so confidence is reduced where flow matters.",
      safetyCap ? "An official weather warning or rapid representative-gage rise applied a safety cap." : "No automatic safety cap is active; always assess conditions at the water.",
    ],
  };
}
