"use client";

import { CheckCircle2, Database, Fish, Gauge, Info, ShieldCheck, Waves } from "lucide-react";
import { TopNav } from "../components/TopNav";

export default function MethodologyPage() {
  return (
    <div className="app-frame content-page">
      <TopNav active="methodology" />
      <main className="content-shell">
        <header className="content-hero">
          <span className="eyebrow">Methodology · scoring profile v1.0</span>
          <h1>A useful forecast should show its work.</h1>
          <p>BiteMap NOVA ranks relative fishing opportunity. It does not predict a guaranteed catch, and its score is not a catch probability.</p>
          <div className="hero-proof"><ShieldCheck size={18} /> Species evidence gates every ranking before weather can help it.</div>
        </header>

        <section className="method-steps">
          <article><span>01</span><Fish size={25} /><h2>Species availability</h2><p>Is the target reasonably supported here? Agency observations, official listings, stocking, barriers, recency, and source precision are weighed separately.</p><strong>No evidence = no ranking</strong></article>
          <article><span>02</span><Database size={25} /><h2>Fishery quality</h2><p>Comparable DWR survey metrics and dated agency ratings describe long-term strength. Electrofishing CPUE is never labeled as angler catch rate.</p><strong>Missing quality lowers confidence</strong></article>
          <article><span>03</span><Waves size={25} /><h2>Hourly activity</h2><p>The live Phase 1 profile uses forecast time of day, wind, and precipitation. Air temperature is shown for trip planning but is never substituted for measured water temperature.</p><strong>Estimated inputs stay labeled</strong></article>
          <article><span>04</span><Gauge size={25} /><h2>Access & confidence</h2><p>Access fit, provider coverage, recency, authority, agreement, forecast horizon, and station association are reported independently.</p><strong>Confidence is not the score</strong></article>
        </section>

        <section className="formula-panel">
          <div>
            <span className="eyebrow">Final opportunity formula</span>
            <h2>Presence gets the final word.</h2>
            <p>The availability exponent prevents good weather from elevating a place with weak species evidence. Missing quality or hourly data uses a neutral placeholder only for continuity and is called out in the explanation.</p>
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
              <li><Info size={17} /><span><strong>Estimated</strong> — modeled or inferred and visibly labeled.</span></li>
              <li><Info size={17} /><span><strong>Historical</strong> — older evidence that informs context, not current conditions.</span></li>
              <li><Info size={17} /><span><strong>Unavailable</strong> — displayed as missing; never filled with a fabricated observation.</span></li>
            </ul>
          </div>
          <div>
            <span className="eyebrow">Safety gates</span>
            <h2>Some conditions cap the score.</h2>
            <p>Official flood or severe-weather warnings and a rapid rise at a verified representative gage can cap an opportunity regardless of the biological score. A gage association never declares water safe.</p>
            <p>Always verify current regulations, access hours, property boundaries, and hazards with the official authority.</p>
          </div>
        </section>

        <section className="limits-panel">
          <span className="eyebrow">Multiple target species</span>
          <h2>Scores stay species-specific.</h2>
          <p>When several species are selected, BiteMap ranks each location by its strongest supported target. It never averages unlike species into one score, and every result keeps the matching species scores visible.</p>
        </section>

        <section className="limits-panel">
          <span className="eyebrow">Consumption-advisory matching</span>
          <h2>Water segment first. Species rule second.</h2>
          <p>BiteMap maps an access point to the named boundary in the current VDH basin sheet, then evaluates the selected species and any published size qualifier. Unclear boundaries and Potomac jurisdictions remain explicit checks. A missing match is never presented as proof that a fish is safe to eat.</p>
        </section>

        <section className="limits-panel">
          <span className="eyebrow">Known limitations</span>
          <h2>Fishing is variable. The data is uneven.</h2>
          <p>Agency surveys are designed for fisheries management, not real-time angler success. Weather forecasts change. Gages may not represent an access point. Broad river evidence may not describe every reach. Habitat models work at landscape scale. BiteMap exposes those limits instead of hiding them behind decimal precision.</p>
        </section>
      </main>
    </div>
  );
}
