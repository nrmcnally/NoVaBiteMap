"use client";

import { AlertTriangle, CheckCircle2, Clock3, DatabaseZap, ExternalLink, Fish, MapPin, ServerCog, ShieldCheck } from "lucide-react";
import { TopNav } from "../../components/TopNav";
import { locations, sourceLinks, species } from "../../lib/data";

const countByAuthority = (authority: string) => locations.filter((location) => location.accessAuthority === authority).length;

const providers = [
  { name: "Virginia DWR access", status: "Healthy", detail: `${countByAuthority("Virginia Department of Wildlife Resources")} verified access records`, updated: "Reviewed Jul 13", href: sourceLinks.access },
  { name: "Fairfax County parks", status: "Healthy", detail: `${countByAuthority("Fairfax County Park Authority")} verified fishing locations`, updated: "Reviewed Jul 13", href: sourceLinks.fairfaxFishing },
  { name: "National Park Service", status: "Healthy", detail: `${countByAuthority("National Park Service")} verified Potomac access locations`, updated: "Reviewed Jul 13", href: sourceLinks.npsGwmpFishing },
  { name: "NOVA Parks", status: "Healthy", detail: `${countByAuthority("NOVA Parks")} verified regional park locations`, updated: "Reviewed Jul 13", href: sourceLinks.novaOccoquan },
  { name: "Virginia and Prince William parks", status: "Healthy", detail: `${countByAuthority("Virginia State Parks") + countByAuthority("Prince William County Parks")} verified locations`, updated: "Reviewed Jul 13", href: sourceLinks.pwcFishing },
  { name: "Virginia DWR fisheries", status: "Healthy", detail: "Curated species evidence with source dates", updated: "Reviewed Jul 13", href: sourceLinks.shenandoah },
  { name: "National Weather Service", status: "Live request", detail: "Selected-location hourly forecast", updated: "On demand", href: sourceLinks.nws },
  { name: "USGS Water Data", status: "Needs review", detail: "No automatic nearest-gage fallback", updated: "Association queue", href: "https://waterdata.usgs.gov/" },
  { name: "USGS Aquatic GAP", status: "Pipeline ready", detail: "Version-pinned modeled evidence import", updated: "Release v2.0", href: sourceLinks.aquaticGap },
];

export function DataHealthClient({ adminName }: { adminName: string }) {
  const evidenceCount = locations.reduce((total, location) => total + location.evidence.length, 0);
  const missingEvidence = locations.filter((location) => location.evidence.length === 0).length;
  return (
    <div className="app-frame content-page">
      <TopNav />
      <main className="content-shell health-shell">
        <header className="health-header">
          <div><span className="eyebrow">Administrative data health</span><h1>What BiteMap knows—and what it doesn&apos;t.</h1><p>This operational view is authenticated and excluded from public navigation.</p></div>
          <div className="admin-badges"><span className="identity-chip"><ShieldCheck size={16} /> {adminName}</span><span className="model-chip"><ServerCog size={17} /> Score profile v1.0 active</span></div>
        </header>
        <section className="health-stats">
          <article><MapPin size={21} /><strong>{locations.length}</strong><span>Verified locations</span><small>Multi-agency access catalog</small></article>
          <article><Fish size={21} /><strong>{species.length}</strong><span>Species profiles</span><small>Configuration catalog</small></article>
          <article><DatabaseZap size={21} /><strong>{evidenceCount}</strong><span>Evidence links</span><small>Source-attributed</small></article>
          <article className="warning-stat"><AlertTriangle size={21} /><strong>{missingEvidence}</strong><span>Access-only records</span><small>Excluded from species ranking</small></article>
        </section>
        <section className="provider-table">
          <div className="table-heading"><div><span className="eyebrow">Provider health</span><h2>Public data sources</h2></div><span><Clock3 size={15} /> Status generated on request</span></div>
          {providers.map((provider) => (
            <a href={provider.href} target="_blank" rel="noreferrer" className="provider-row" key={provider.name}>
              <span className={`provider-icon ${provider.status === "Needs review" ? "warn" : ""}`}>{provider.status === "Needs review" ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}</span>
              <strong>{provider.name}</strong><span>{provider.detail}</span><em>{provider.status}</em><small>{provider.updated}</small><ExternalLink size={15} />
            </a>
          ))}
        </section>
      </main>
    </div>
  );
}
