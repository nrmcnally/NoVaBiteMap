"use client";

import { ClipboardList, CloudSun, Fish, MapPin, RotateCcw, ShieldCheck, Trash2, Waves } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import type { AccountFishingTrip } from "../lib/account-server";

export type TripLocationOption = {
  id: string;
  name: string;
  waterbody: string;
  county: string;
  speciesIds: string[];
};

type SpeciesOption = { id: string; name: string };

export function TripLogClient({
  initialTrips,
  locations,
  species,
  initialLocationId,
  initialSpeciesId,
}: {
  initialTrips: AccountFishingTrip[];
  locations: TripLocationOption[];
  species: SpeciesOption[];
  initialLocationId: string;
  initialSpeciesId: string;
}) {
  const validInitialLocation = locations.some((location) => location.id === initialLocationId) ? initialLocationId : "";
  const initialLocation = locations.find((location) => location.id === validInitialLocation);
  const validInitialSpecies = initialLocation?.speciesIds.includes(initialSpeciesId) ? initialSpeciesId : "";
  const [trips, setTrips] = useState(initialTrips);
  const [locationId, setLocationId] = useState(validInitialLocation);
  const [speciesId, setSpeciesId] = useState(validInitialSpecies);
  const [busy, setBusy] = useState(false);
  const [replayBusyId, setReplayBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const availableSpecies = useMemo(() => {
    const allowed = new Set(locations.find((location) => location.id === locationId)?.speciesIds ?? []);
    return species.filter((fish) => allowed.has(fish.id));
  }, [locationId, locations, species]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setBusy(true);
    setError(null);
    setSaved(false);
    const form = new FormData(formElement);
    const startValue = String(form.get("startedAt") ?? "");
    const endValue = String(form.get("endedAt") ?? "");
    const waterTempF = String(form.get("waterTemperatureF") ?? "").trim();
    try {
      const response = await fetch("/api/trips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          locationId,
          speciesId,
          startedAt: startValue ? new Date(startValue).toISOString() : "",
          endedAt: endValue ? new Date(endValue).toISOString() : "",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
          anglerCount: Number(form.get("anglerCount")),
          catchCount: Number(form.get("catchCount")),
          locationDetail: String(form.get("locationDetail") ?? ""),
          lureOrBait: String(form.get("lureOrBait") ?? ""),
          observedWaterTemperatureC: waterTempF ? (Number(waterTempF) - 32) * 5 / 9 : null,
          observedClarity: String(form.get("observedClarity") ?? ""),
          notes: String(form.get("notes") ?? ""),
          consentForAggregateAnalysis: form.get("consent") === "on",
        }),
      });
      const body = await response.json().catch(() => ({})) as { trip?: AccountFishingTrip; error?: string };
      if (!response.ok || !body.trip) throw new Error(body.error || "Unable to save this trip.");
      setTrips((current) => [body.trip!, ...current]);
      setSaved(true);
      formElement.reset();
      setSpeciesId("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save this trip.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(trip: AccountFishingTrip) {
    if (!window.confirm("Delete this private trip log? This cannot be undone.")) return;
    const previous = trips;
    setTrips((current) => current.filter((item) => item.id !== trip.id));
    const response = await fetch(`/api/trips/${encodeURIComponent(trip.id)}`, { method: "DELETE" });
    if (!response.ok) {
      setTrips(previous);
      setError("Unable to delete this trip.");
    }
  }

  async function reconstruct(trip: AccountFishingTrip) {
    setReplayBusyId(trip.id);
    setError(null);
    try {
      const response = await fetch(`/api/trips/${encodeURIComponent(trip.id)}/replay`, {
        method: "POST",
      });
      const body = await response.json().catch(() => ({})) as {
        trip?: AccountFishingTrip;
        error?: string;
      };
      if (!response.ok || !body.trip) {
        throw new Error(body.error || "Unable to reconstruct conditions.");
      }
      setTrips((current) => current.map((item) => item.id === trip.id ? body.trip! : item));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to reconstruct conditions.");
    } finally {
      setReplayBusyId(null);
    }
  }

  return (
    <div className="trip-layout">
      <section className="trip-entry-card">
        <div className="trip-card-heading">
          <span className="trip-icon"><ClipboardList size={23} /></span>
          <div><span className="eyebrow">Completed trip</span><h2>Add a fishing trip</h2></div>
        </div>
        <p className="trip-intro">Use the actual start and end time. A zero-catch trip is useful data too.</p>
        <form className="trip-form" onSubmit={(event) => void submit(event)}>
          <label className="trip-field trip-field-wide">BiteMap spot
            <select required value={locationId} onChange={(event) => { setLocationId(event.target.value); setSpeciesId(""); }}>
              <option value="">Choose a public-access spot</option>
              {locations.map((location) => <option key={location.id} value={location.id}>{location.name} — {location.waterbody}</option>)}
            </select>
          </label>
          <label className="trip-field trip-field-wide">Target species
            <select required disabled={!locationId} value={speciesId} onChange={(event) => setSpeciesId(event.target.value)}>
              <option value="">{locationId ? "Choose what you targeted" : "Choose a spot first"}</option>
              {availableSpecies.map((fish) => <option key={fish.id} value={fish.id}>{fish.name}</option>)}
            </select>
            <small>Count only this target below. Mention other catches in notes.</small>
          </label>
          <label className="trip-field">Started
            <input name="startedAt" type="datetime-local" required />
          </label>
          <label className="trip-field">Ended
            <input name="endedAt" type="datetime-local" required />
          </label>
          <label className="trip-field">Anglers
            <input name="anglerCount" type="number" min={1} max={20} defaultValue={1} required />
          </label>
          <label className="trip-field">Target caught
            <input name="catchCount" type="number" min={0} max={1000} defaultValue={0} required />
          </label>
          <label className="trip-field trip-field-wide">Where at the spot? <span>optional</span>
            <input name="locationDetail" maxLength={160} placeholder="Example: north bank below the footbridge" />
          </label>
          <label className="trip-field trip-field-wide">Lure or bait <span>optional</span>
            <input name="lureOrBait" maxLength={160} placeholder="Example: 3-inch paddletail, natural color" />
          </label>
          <label className="trip-field">Water temperature °F <span>optional</span>
            <input name="waterTemperatureF" type="number" min={23} max={113} step="0.1" placeholder="Measured only" />
          </label>
          <label className="trip-field">Water clarity <span>optional</span>
            <select name="observedClarity" defaultValue="">
              <option value="">Not recorded</option><option value="clear">Clear</option><option value="stained">Stained</option><option value="muddy">Muddy</option><option value="unknown">Unsure</option>
            </select>
          </label>
          <label className="trip-field trip-field-wide">Notes <span>optional</span>
            <textarea name="notes" maxLength={2000} rows={4} placeholder="Weather changes, follows, missed bites, other species caught…" />
          </label>
          <label className="trip-consent trip-field-wide">
            <input name="consent" type="checkbox" />
            <span><strong>Allow de-identified aggregate analysis</strong>My trip stays private. BiteMap may use its spot, time, effort, target, catch count, and observations to tune models; never my email or notes.</span>
          </label>
          {error && <p className="account-error trip-field-wide" role="alert">{error}</p>}
          {saved && <p className="trip-success trip-field-wide" role="status"><ShieldCheck size={16} /> Trip saved privately.</p>}
          <button className="primary-action trip-field-wide" type="submit" disabled={busy}>{busy ? "Saving trip…" : "Save trip"}</button>
        </form>
      </section>

      <section className="trip-history">
        <div className="trip-history-heading"><div><span className="eyebrow">Your account</span><h2>Past trips</h2></div><span>{trips.length}</span></div>
        {trips.length === 0 ? (
          <div className="trip-empty"><Fish size={29} /><h3>No trips yet.</h3><p>Your first completed trip will appear here.</p></div>
        ) : trips.map((trip) => {
          const location = locations.find((item) => item.id === trip.locationId);
          const fish = species.find((item) => item.id === trip.speciesId);
          return (
            <article className="trip-row" key={trip.id}>
              <div className="trip-row-top">
                <span className="trip-place"><MapPin size={15} /> {location?.name ?? trip.locationId}</span>
                <button type="button" onClick={() => void remove(trip)} aria-label={`Delete ${location?.name ?? "trip"} log`}><Trash2 size={15} /></button>
              </div>
              <h3>{fish?.name ?? trip.speciesId}</h3>
              <p>{formatTripTime(trip)} · {trip.effortMinutes} min · {trip.anglerCount} {trip.anglerCount === 1 ? "angler" : "anglers"}</p>
              <div className="trip-result"><strong>{trip.catchCount}</strong><span>{trip.catchCount === 1 ? "target fish" : "target fish"}<small>{trip.lureOrBait || "No lure or bait recorded"}</small></span></div>
              {trip.locationDetail && <p className="trip-detail">At the spot: {trip.locationDetail}</p>}
              <ConditionReplayPanel
                trip={trip}
                busy={replayBusyId === trip.id}
                onReconstruct={() => void reconstruct(trip)}
              />
              <span className={trip.calibrationEligible ? "trip-use trip-use-consented" : "trip-use"}>
                {trip.calibrationEligible ? "Allowed for aggregate calibration" : "Private account record only"}
              </span>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function ConditionReplayPanel({
  trip,
  busy,
  onReconstruct,
}: {
  trip: AccountFishingTrip;
  busy: boolean;
  onReconstruct: () => void;
}) {
  const replay = trip.conditionReplay;
  const weather = replay?.weather.summary;
  const primaryHydrology = replay?.hydrology.metrics.find((metric) => metric.parameterCode === "00010")
    ?? replay?.hydrology.metrics.find((metric) => metric.parameterCode === "00060")
    ?? replay?.hydrology.metrics[0];
  const heading = trip.conditionReplayStatus === "complete"
    ? "Conditions reconstructed"
    : trip.conditionReplayStatus === "partial"
      ? "Partial conditions reconstructed"
      : trip.conditionReplayStatus === "unavailable"
        ? "Provider data unavailable"
        : "Historical conditions not reconstructed";
  return (
    <div className={`trip-replay trip-replay-${trip.conditionReplayStatus}`}>
      <div className="trip-replay-heading">
        <span><CloudSun size={16} /></span>
        <div>
          <strong>{heading}</strong>
          <small>
            {replay
              ? `Solar ${replay.solar.midpoint.phase}; weather is modeled history, not an observation at the spot.`
              : "Rebuild weather, solar phase, and mapped USGS readings from the recorded time and spot."}
          </small>
        </div>
      </div>
      {replay && (
        <div className="trip-replay-facts">
          <span>
            <CloudSun size={13} />
            {weather?.meanTemperatureC == null
              ? "Weather unavailable"
              : `${celsiusToFahrenheit(weather.meanTemperatureC)}°F modeled air`}
          </span>
          <span>
            <Waves size={13} />
            {primaryHydrology
              ? `${primaryHydrology.mean} ${primaryHydrology.unit ?? ""} ${shortHydrologyName(primaryHydrology.parameterCode)}`
              : replay.hydrology.status === "not-mapped"
                ? "No verified USGS mapping"
                : "USGS unavailable"}
          </span>
        </div>
      )}
      {replay?.coverage.missing.length ? (
        <p>Coverage note: {replay.coverage.missing.join("; ")}.</p>
      ) : null}
      <button type="button" disabled={busy} onClick={onReconstruct}>
        <RotateCcw size={13} />
        {busy
          ? "Reconstructing…"
          : trip.conditionReplayStatus === "not-requested"
            ? "Reconstruct conditions"
            : "Refresh reconstruction"}
      </button>
    </div>
  );
}

function formatTripTime(trip: AccountFishingTrip) {
  try {
    const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: trip.timezone }).format(new Date(trip.startedAt));
    return date;
  } catch {
    return new Date(trip.startedAt).toLocaleString();
  }
}

function celsiusToFahrenheit(value: number) {
  return Math.round((value * 9 / 5 + 32) * 10) / 10;
}

function shortHydrologyName(parameterCode: string) {
  if (parameterCode === "00010") return "water";
  if (parameterCode === "00060") return "flow";
  if (parameterCode === "00065") return "gage";
  return "USGS";
}
