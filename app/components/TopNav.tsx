"use client";

import Link from "next/link";
import { DatabaseZap, Fish, Heart, Map } from "lucide-react";

type TopNavProps = {
  active?: "explore" | "spots" | "methodology" | "health";
};

export function TopNav({ active = "explore" }: TopNavProps) {
  return (
    <header className="top-nav">
      <Link className="brand" href="/" aria-label="BiteMap NOVA home">
        <span className="brand-mark"><Fish size={21} strokeWidth={2.2} /></span>
        <span>
          <strong>BiteMap</strong>
          <em>NOVA</em>
        </span>
      </Link>
      <nav aria-label="Primary navigation">
        <Link className={active === "explore" ? "active" : ""} href="/">
          <Map size={16} /> Explore
        </Link>
        <Link className={active === "spots" ? "active" : ""} href="/my-spots">
          <Heart size={16} /> My spots
        </Link>
        <Link className={active === "methodology" ? "active" : ""} href="/methodology">
          How it works
        </Link>
        <Link className={active === "health" ? "active" : ""} href="/data-health">
          <DatabaseZap size={16} /> Data health
        </Link>
      </nav>
      <div className="nav-status" title="Recommendations never guarantee a catch">
        <span className="status-dot" /> Evidence-led
      </div>
    </header>
  );
}
