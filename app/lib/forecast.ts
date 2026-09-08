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
  dielPattern?: string;
  seasonalActivityByMonth?: number[];
};

export type PreparedForecastPeriod = NwsForecastPeriod & {
  dateKey: string;
  dayLabel: string;
  hour: number;
  month: number;
  timeLabel: string;
  windMph: number;
  windFit: number;
  precipitationFit: number;
  weatherSafetyCapped: boolean;
};

export type PreparedForecastTimeline = {
  periods: PreparedForecastPeriod[];
  dayKeys: string[];
  activeSafetyAlerts: NwsAlert[];
};

export type TimelineScoreInput = {
  availability: number;
  quality: number | null;
  accessFit: number;
  dielPattern?: string;
  seasonalActivityByMonth?: number[];
};

const EASTERN_TIME_ZONE = "America/New_York";
const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: EASTERN_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const dayLabelFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: EASTERN_TIME_ZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
});
const hourNumberFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: EASTERN_TIME_ZONE,
  hour: "numeric",
  hourCycle: "h23",
});
const monthNumberFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: EASTERN_TIME_ZONE,
  month: "numeric",
});
const timeLabelFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: EASTERN_TIME_ZONE,
  hour: "numeric",
});

function maxWindMph(value: string) {
  const matches = value.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  return Math.max(0, ...matches);
}
function localParts(value: string) {
  const date = new Date(value);
  return {
    dateKey: dateKeyFormatter.format(date),
    dayLabel: dayLabelFormatter.format(date),
    hour: Number(hourNumberFormatter.format(date)),
    month: Number(monthNumberFormatter.format(date)),
    timeLabel: timeLabelFormatter.format(date),
  };
}

function timeSuitability(hour: number, pattern = "crepuscular") {
  if (pattern === "nocturnal") {
    if (hour >= 20 || hour <= 4) return 0.9;
    if ((hour >= 5 && hour <= 7) || (hour >= 17 && hour <= 19)) return 0.7;
    return 0.38;
  }
  if (pattern === "diurnal") {
    if (hour >= 8 && hour <= 16) return 0.82;
    if ((hour >= 5 && hour <= 7) || (hour >= 17 && hour <= 19)) return 0.7;
    return 0.38;
  }
  if (pattern === "flexible") {
    if ((hour >= 5 && hour <= 8) || (hour >= 17 && hour <= 20)) return 0.84;
    if (hour >= 9 && hour <= 16) return 0.72;
    return 0.55;
  }
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

function alertAppliesAt(alert: NwsAlert, startTime: string) {
  const selected = Date.parse(startTime);
  const parsedOnset = alert.onset ? Date.parse(alert.onset) : Number.NaN;
  const parsedExpires = alert.expires ? Date.parse(alert.expires) : Number.NaN;
  const onset = Number.isFinite(parsedOnset) ? parsedOnset : Number.NEGATIVE_INFINITY;
  const expires = Number.isFinite(parsedExpires) ? parsedExpires : Number.POSITIVE_INFINITY;
  return selected >= onset && selected <= expires;
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

function activityForPeriod(
  period: PreparedForecastPeriod,
  dielPattern?: string,
  seasonalActivityByMonth?: number[],
) {
  const time = timeSuitability(period.hour, dielPattern);
  const seasonal = seasonalActivityByMonth?.[period.month - 1];
  const activity = typeof seasonal === "number"
    ? 0.35 * time + 0.2 * period.windFit + 0.2 * period.precipitationFit + 0.25 * seasonal
    : 0.5 * time + 0.25 * period.windFit + 0.25 * period.precipitationFit;
  return { activity, time };
}

function scoreForActivity(input: TimelineScoreInput, activity: number, safetyCapped: boolean) {
  const quality = input.quality ?? 0.5;
  const raw = Math.round(
    100
      * Math.pow(input.availability, 1.5)
      * (0.35 * quality + 0.5 * activity + 0.15 * input.accessFit),
  );
  const score = safetyCapped ? Math.min(raw, 35) : raw;
  return Math.max(0, Math.min(100, score));
}

export function prepareForecastTimeline(
  periods: NwsForecastPeriod[],
  alerts: NwsAlert[],
): PreparedForecastTimeline {
  const activeSafetyAlerts = alerts.filter(isSafetyAlert);
  const preparedPeriods = periods.map((period) => {
    const local = localParts(period.startTime);
    const windMph = maxWindMph(period.windSpeed);
    return {
      ...period,
      ...local,
      windMph,
      windFit: windSuitability(windMph),
      precipitationFit: precipitationSuitability(period.precipitationProbability, period.shortForecast),
      weatherSafetyCapped: activeSafetyAlerts.some((alert) => alertAppliesAt(alert, period.startTime)),
    };
  });
  return {
    periods: preparedPeriods,
    dayKeys: [...new Set(preparedPeriods.map((period) => period.dateKey))].slice(0, 5),
    activeSafetyAlerts,
  };
}

export function buildTimelineScoreSeries(
  timeline: PreparedForecastTimeline,
  input: TimelineScoreInput,
) {
  const hourlyScores = timeline.periods.map((period) => {
    const { activity } = activityForPeriod(period, input.dielPattern, input.seasonalActivityByMonth);
    return scoreForActivity(input, activity, period.weatherSafetyCapped);
  });
  const dailyScores: Array<number | null> = [];
  const dailyBestPeriodIndexes: Array<number | null> = [];

  for (const dayKey of timeline.dayKeys) {
    let bestScore: number | null = null;
    let bestIndex: number | null = null;
    for (let index = 0; index < timeline.periods.length; index += 1) {
      if (timeline.periods[index].dateKey !== dayKey) continue;
      const score = hourlyScores[index];
      if (bestScore === null || score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }
    dailyScores.push(bestScore);
    dailyBestPeriodIndexes.push(bestIndex);
  }

  return { hourlyScores, dailyScores, dailyBestPeriodIndexes };
}

export function buildForecast(input: ForecastInput) {
  const prepared = prepareForecastTimeline(input.periods, input.alerts);
  const activeSafetyAlerts = prepared.activeSafetyAlerts;
  const fastRise = rapidRise(input.hydrology);
  const hourly = prepared.periods.map((period) => {
    const { activity, time } = activityForPeriod(period, input.dielPattern, input.seasonalActivityByMonth);
    const safetyCapped = period.weatherSafetyCapped || Boolean(input.wadingSelected && fastRise);
    const score = scoreForActivity(input, activity, safetyCapped);
    const {
      windFit,
      precipitationFit,
      weatherSafetyCapped: _weatherSafetyCapped,
      ...publicPeriod
    } = period;
    void _weatherSafetyCapped;
    return {
      ...publicPeriod,
      activity: Number(activity.toFixed(3)),
      score,
      safetyCapped,
      factors: {
        timeOfDay: Number(time.toFixed(2)),
        wind: Number(windFit.toFixed(2)),
        precipitation: Number(precipitationFit.toFixed(2)),
      },
    };
  });
  const safetyCap = hourly.some((period) => period.safetyCapped) ? 35 : null;

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
      "The fish record and long-term fishery data set the baseline.",
      input.dielPattern
        ? "Hourly scores adjust for this species' daily and seasonal activity, wind, and rain. Air temperature is shown only as context."
        : "Hourly scores adjust for time of day, wind, and rain. Air temperature is shown only as context.",
      input.hydrology?.available ? `USGS station ${input.hydrology.association?.stationId} contributes recent stream conditions.` : "No suitable stream gauge is available, so confidence is lower when flow matters.",
      safetyCap ? "A weather warning or rapidly rising stream gauge limited the score." : "No automatic safety limit is active; always assess conditions at the water.",
    ],
  };
}
