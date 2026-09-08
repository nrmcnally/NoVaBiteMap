"use client";

import Link from "next/link";
import { BookOpen, ClipboardList, Fish, Heart, Map, MessageSquare } from "lucide-react";
import { AccountNav } from "./AccountNav";

type TopNavProps = { active?: "explore" | "spots" | "trips" | "methodology" | "fish" | "account" };

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
        <Link prefetch={false} className={active === "trips" ? "active" : ""} href="/trips">
          <ClipboardList size={16} /> Trips
        </Link>
        <Link className={active === "methodology" ? "active" : ""} href="/methodology">
          How it works
        </Link>
      </nav>
      <div className="nav-actions">
        <Link className="feedback-nav" href="/feedback" title="Send alpha feedback">
          <MessageSquare size={15} />
          <span>Feedback</span>
        </Link>
        <div className="nav-status" title="Spot and fish sources are available throughout the app">
          <span className="status-dot" /> Sources included
        </div>
        <AccountNav />
      </div>
    </header>
  );
}
