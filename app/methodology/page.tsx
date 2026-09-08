"use client";

import Link from "next/link";
import { CheckCircle2, ClipboardList, Database, Fish, Gauge, Info, ShieldCheck, Waves } from "lucide-react";
import { TopNav } from "../components/TopNav";

export default function MethodologyPage() {
  return (
    <div className="app-frame content-page">
      <TopNav active="methodology" />
      <main className="content-shell">
        <header className="content-hero">
          <span className="eyebrow">How BiteMap scores fishing conditions</span>
          <h1>What goes into a BiteMap score?</h1>
          <p>BiteMap NOVA ranks relative fishing opportunity. It does not predict a guaranteed catch, and its score is not a catch probability.</p>
          <div className="hero-proof"><ShieldCheck size={18} /> A fish is scored only where reliable records support its presence.</div>
        </header>

        <section className="method-steps">
          <article><span>01</span><Fish size={25} /><h2>Fish records</h2><p>Has the species been reliably documented here? BiteMap considers agency observations, official listings, stocking, barriers, record age, and how precisely the source identifies the water.</p><strong>No reliable record = no score</strong></article>
          <article><span>02</span><Database size={25} /><h2>Fishery quality</h2><p>Comparable DWR survey metrics and dated agency ratings describe long-term strength. Electrofishing CPUE is never labeled as angler catch rate.</p><strong>Missing quality lowers confidence</strong></article>
          <article><span>03</span><Waves size={25} /><h2>Hourly activity</h2><p>The forecast combines typical seasonal and daily activity with measured or clearly labeled estimated water temperature, daylight, dissolved oxygen where available, and known flow hazards. Air temperature is shown only as context.</p><strong>Estimates are always labeled</strong></article>
          <article><span>04</span><Gauge size={25} /><h2>Access & confidence</h2><p>Public access, source coverage, record age, agreement between sources, forecast horizon, and stream-gauge relevance all affect confidence.</p><strong>Confidence is separate from the score</strong></article>
        </section>

        <section className="formula-panel">
          <div>
            <span className="eyebrow">Final opportunity formula</span>
            <h2>Good weather cannot make up for a weak fish record.</h2>
            <p>The formula sharply reduces scores when a species is poorly documented at a water. When long-term quality or hourly data is missing, BiteMap uses a neutral value and says so.</p>
          </div>
          <code>100 × A<sup>1.5</sup> × (0.35Q + 0.50H + 0.15X)</code>
        </section>

        <section className="method-grid">
          <div>
            <span className="eyebrow">Data labels</span>
            <h2>Observed is not estimated.</h2>
            <ul>
              <li><CheckCircle2 size={17} /><span><strong>Observed</strong> — measured by a named station or survey with time and method.</span></li>
              <li><CheckCircle2 size={17} /><span><strong>Forecast</strong> — official provider projection with valid and retrieval times.</span></li>
              <li><Info size={17} /><span><strong>Estimated — calibrated</strong> — a future daily stream estimate adjusted using a recent reading from a relevant gauge.</span></li>
              <li><Info size={17} /><span><strong>Estimated — regional</strong> — an ungaged flowing-water surface estimate with a broad model range and reduced scoring authority.</span></li>
              <li><Info size={17} /><span><strong>Historical</strong> — older evidence that informs context, not current conditions.</span></li>
              <li><Info size={17} /><span><strong>Unavailable</strong> — shown as missing rather than replaced with a guess.</span></li>
            </ul>
          </div>
          <div>
            <span className="eyebrow">Safety limits</span>
            <h2>Some conditions cap the score.</h2>
            <p>Official flood or severe-weather warnings and a rapid rise at a relevant stream gauge can limit a score regardless of the biological conditions. A gauge reading never declares the water safe.</p>
            <p>Always verify current regulations, access hours, property boundaries, and hazards with the official authority.</p>
          </div>
        </section>

        <section className="limits-panel">
          <span className="eyebrow">Multiple target species</span>
          <h2>Scores stay species-specific.</h2>
          <p>When several species are selected, BiteMap ranks each location by the selected fish with the highest score. It never averages different species together, and every matching species score remains visible.</p>
        </section>

        <section className="limits-panel">
          <span className="eyebrow">Interactive prediction timeline</span>
          <h2>Move the timeline to compare hours or days.</h2>
          <p>Explore uses the exact hourly periods returned by the <a href="https://www.weather.gov/documentation/services-web-api" target="_blank" rel="noreferrer">National Weather Service API</a>. A starting address inside the supported area becomes the map&apos;s weather reference point; otherwise BiteMap uses Fairfax. Hour view uses one forecast hour. Day view compares only the available forecast hours and shows each species at its best hour that day.</p>
          <p>Scores for the full timeline are calculated once when the forecast loads. Moving the slider then updates the list, species menu, spot scores, and map colors without recalculating everything in the browser. Hours beyond the NWS forecast are disabled. This alpha compares the region using one clearly named weather location rather than a separate neighborhood forecast for every access point. Air temperature is shown for context and is not used as water temperature.</p>
        </section>

        <section className="limits-panel">
          <span className="eyebrow">Consumption-advisory matching</span>
          <h2>Water segment first. Species rule second.</h2>
          <p>BiteMap maps an access point to the named boundary in the current VDH basin sheet, then evaluates the selected species and any published size qualifier. Unclear boundaries and Potomac jurisdictions remain explicit checks. A missing match is never presented as proof that a fish is safe to eat.</p>
        </section>

        <section className="limits-panel">
          <span className="eyebrow"><ClipboardList size={15} /> Private trip records</span>
          <h2>Record the trip—not a frozen forecast.</h2>
          <p>Anglers enter the named BiteMap spot, actual start and end time, target, effort, and catch count, including explicit zero-catch trips. Logs remain private unless the angler permits de-identified aggregate analysis. Notes and account identity are excluded from that consent.</p>
          <p>Afterward, the angler can reconstruct conditions using only the recorded spot and time. BiteMap uses clearly labeled <a href="https://open-meteo.com/en/docs/historical-forecast-api" target="_blank" rel="noreferrer">Open-Meteo modeled history</a>, values from a <a href="https://waterservices.usgs.gov/docs/instantaneous-values/instantaneous-values-details/" target="_blank" rel="noreferrer">manually mapped USGS station</a> where available, and deterministic solar geometry. It does not inspect the catch, species, lure, or notes to select those inputs, and it does not guess a nearby gage.</p>
          <p>These trip records may help tune the model, but they do not prove that it is accurate. A separate future validation must test a locked model against trips that were not used to build it.</p>
          <Link href="/trips">Open your private trip log</Link>
        </section>

        <section className="limits-panel">
          <span className="eyebrow">Known limitations</span>
          <h2>Fishing is variable. The data is uneven.</h2>
          <p>Agency surveys are designed for fisheries management, not real-time angler success. Weather forecasts change. Gages may not represent an access point. The regional stream-temperature model is not a lake or depth model. Broad river evidence may not describe every reach. Barometric pressure and lunar phase are not currently scored because their general bite effects are not sufficiently established. BiteMap exposes those limits instead of hiding them behind decimal precision.</p>
        </section>
      </main>
    </div>
  );
}
