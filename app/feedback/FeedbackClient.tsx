"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, MessageSquare, Send } from "lucide-react";
import type { AlphaFeedbackCategory } from "../lib/account-server";

type FeedbackLocation = {
  id: string;
  name: string;
  waterbody: string;
  county: string;
};

type FeedbackClientProps = {
  initialCategory: AlphaFeedbackCategory;
  initialLocationId: string;
  sourcePage: string | null;
  locations: FeedbackLocation[];
};

const labels: Record<AlphaFeedbackCategory, string> = {
  "incorrect-data": "Incorrect spot data",
  bug: "Something is broken",
  idea: "Feature idea",
  other: "General feedback",
};

export function FeedbackClient({
  initialCategory,
  initialLocationId,
  sourcePage,
  locations,
}: FeedbackClientProps) {
  const [category, setCategory] = useState<AlphaFeedbackCategory>(initialCategory);
  const [locationId, setLocationId] = useState(initialLocationId);
  const [message, setMessage] = useState("");
  const [contactOk, setContactOk] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          category,
          locationId: locationId || undefined,
          pageUrl: sourcePage,
          message,
          contactOk,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error || "Unable to send feedback.");
      }
      setSent(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to send feedback.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <section className="feedback-card feedback-success">
        <span className="feedback-success-icon"><CheckCircle2 size={30} /></span>
        <span className="eyebrow">Report received</span>
        <h2>Thank you—that is exactly what the alpha needs.</h2>
        <p>The report is waiting in the private administrator review queue. It will be checked before any data or scoring change is made.</p>
        <button type="button" onClick={() => {
          setMessage("");
          setContactOk(false);
          setSent(false);
        }}>Send another report</button>
      </section>
    );
  }

  return (
    <section className="feedback-card">
      <div className="feedback-card-heading">
        <span className="feedback-card-icon"><MessageSquare size={24} /></span>
        <div><span className="eyebrow">Private review queue</span><h2>What did you notice?</h2></div>
      </div>
      <form className="feedback-form" onSubmit={submit}>
        <fieldset>
          <legend>Feedback type</legend>
          <div className="feedback-type-grid">
            {(Object.keys(labels) as AlphaFeedbackCategory[]).map((value) => (
              <label className={category === value ? "selected" : ""} key={value}>
                <input
                  type="radio"
                  name="category"
                  value={value}
                  checked={category === value}
                  onChange={() => setCategory(value)}
                />
                <span>{labels[value]}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label>
          Related fishing spot <small>optional</small>
          <select value={locationId} onChange={(event) => setLocationId(event.target.value)}>
            <option value="">No specific spot</option>
            {locations.map((location) => (
              <option value={location.id} key={location.id}>
                {location.name} — {location.waterbody}, {location.county} County
              </option>
            ))}
          </select>
        </label>
        <label>
          What should we know?
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            minLength={10}
            maxLength={3000}
            required
            placeholder={category === "incorrect-data"
              ? "Tell us what looks wrong and, if possible, how you know."
              : "Describe what happened or what would make BiteMap more useful."}
          />
          <small className="feedback-count">{message.length.toLocaleString()} / 3,000</small>
        </label>
        <label className="feedback-contact">
          <input
            type="checkbox"
            checked={contactOk}
            onChange={(event) => setContactOk(event.target.checked)}
          />
          <span>The administrator may contact me at my account email for clarification.</span>
        </label>
        {error && <p className="feedback-error" role="alert">{error}</p>}
        <button className="feedback-submit" type="submit" disabled={submitting || message.trim().length < 10}>
          <Send size={17} /> {submitting ? "Sending…" : "Send private feedback"}
        </button>
      </form>
      <p className="feedback-policy">Feedback is review input, not fishing evidence. Nothing submitted here is promoted into the species catalog or bite model without separate verification.</p>
    </section>
  );
}
