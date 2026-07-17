export const FORECAST_CAPABILITIES_VERSION = "forecast-capabilities-v0.1.0" as const;
export const ENVIRONMENTAL_SNAPSHOT_VERSION = "environmental-snapshot-v0.1.0" as const;

export type EnvironmentalProvenance =
  | "observed"
  | "observed-current-context"
  | "forecast"
  | "modeled-from-forecast"
  | "deterministic"
  | "unavailable";

export type EnvironmentalInput<T = unknown> = {
  status: "available" | "unavailable";
  value: T | null;
  unit: string | null;
  provenance: EnvironmentalProvenance;
  provider: string | null;
  validTime: string | null;
  retrievedAt: string | null;
  context: Record<string, unknown>;
};

export type ForecastCapabilities = {
  contractVersion: typeof FORECAST_CAPABILITIES_VERSION;
  generatedAt: string;
  timezone: "America/New_York";
  location: {
    id: string;
    name: string;
    waterbody: string;
    waterbodyType: string;
    latitude: number;
    longitude: number;
  };
  hourly: {
    status: "available" | "unavailable";
    resolution: "hourly";
    startTime: string | null;
    endTime: string | null;
    periodCount: number;
    provider: string | null;
    retrievedAt: string | null;
    forecastUpdatedAt: string | null;
    inputs: string[];
    modeledInputs: string[];
    unavailableInputs: string[];
    limitation: string;
  };
  daily: {
    status: "available" | "unavailable";
    resolution: "daily-outlook";
    startDate: string | null;
    endDate: string | null;
    dayCount: number;
    derivedFrom: string;
    waterTemperatureEndDate: string | null;
    excludedHourlyOnlyInputs: string[];
    label: "Daily outlook";
    limitation: string;
  };
  hydrology: {
    status: "not-mapped" | "unavailable" | "observed-current-context";
    station: Record<string, unknown> | null;
    observedAt?: string | null;
    freshness?: string | null;
    forecasted: false;
    limitation: string;
  };
  waterTemperature: {
    status: "observed" | "estimated-calibrated" | "estimated-regional" | "unavailable";
    confidence: number;
    modelVersion: string | null;
    availableThrough: string | null;
    provenance: EnvironmentalProvenance;
    limitation: string | null;
  };
  selectionPolicy: {
    unsupportedFutureDisabled: true;
    hourlyEndTime: string | null;
    dailyEndDate: string | null;
    dailyOutlookLabel: "Daily outlook";
    selectedTimestampRequiredForScoring: true;
  };
};

export type EnvironmentalSnapshot = {
  contractVersion: typeof ENVIRONMENTAL_SNAPSHOT_VERSION;
  generatedAt: string;
  selectedTime: string;
  timezone: "America/New_York";
  location: ForecastCapabilities["location"];
  weatherValidTime: string;
  inputs: {
    airTemperature: EnvironmentalInput<number>;
    precipitationProbability: EnvironmentalInput<number>;
    wind: EnvironmentalInput<number>;
    weatherSummary: EnvironmentalInput<string>;
    waterTemperature: EnvironmentalInput<number>;
    solarPosition: EnvironmentalInput<number>;
    hydrology: EnvironmentalInput<Record<string, unknown>>;
  };
  coverage: {
    status: "complete" | "partial";
    missingInputs: string[];
    modeledInputs: string[];
  };
  activeAlerts: Array<Record<string, unknown>>;
  scoring: {
    speciesAgnostic: true;
    scoreIncluded: false;
    selectedTimestampExplicit: true;
  };
};
