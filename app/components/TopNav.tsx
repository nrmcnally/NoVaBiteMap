"use client";

import Link from "next/link";
import { BookOpen, Fish, Heart, Map } from "lucide-react";

type TopNavProps = {
  active?: "explore" | "spots" | "methodology" | "fish";
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
        <Link className={active === "fish" ? "active" : ""} href="/fish">
          <BookOpen size={16} /> Fish guide
        </Link>
        <Link prefetch={false} className={active === "spots" ? "active" : ""} href="/my-spots">
          <Heart size={16} /> My spots
        </Link>
        <Link className={active === "methodology" ? "active" : ""} href="/methodology">
          How it works
        </Link>
      </nav>
      <div className="nav-status" title="Recommendations never guarantee a catch">
        <span className="status-dot" /> Evidence-led
      </div>
    </header>
  );
}
