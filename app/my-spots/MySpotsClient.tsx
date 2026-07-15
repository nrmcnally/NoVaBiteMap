"use client";

import Link from "next/link";
import { ArrowRight, Heart, Navigation } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { locationById, speciesById } from "../lib/data";
import { opportunityFor } from "../lib/scoring";
import { googleDirectionsUrl } from "../lib/travel";
import type { ExploreCatalog } from "../lib/api";

export type FavoriteView = {
  id: number;
  locationId: string;
  nickname: string | null;
  preferredSpecies: string | null;
};

export function MySpotsClient({ initialFavorites, catalog }: { initialFavorites: FavoriteView[]; catalog: ExploreCatalog | null }) {
  const [favorites, setFavorites] = useState(initialFavorites);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/favorites", { cache: "no-store" });
      if (!response.ok) return;
      const body = await response.json() as { favorites?: FavoriteView[] };
      setFavorites(body.favorites ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    const reload = () => void refresh();
    window.addEventListener("focus", reload);
    window.addEventListener("bitemap:favorites-changed", reload);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", reload);
      window.removeEventListener("bitemap:favorites-changed", reload);
    };
  }, [refresh]);

  async function removeFavorite(favorite: FavoriteView) {
    const previous = favorites;
    setFavorites((current) => current.filter((item) => item.id !== favorite.id));
    const response = await fetch(`/api/favorites/${favorite.id}`, { method: "DELETE" });
    if (!response.ok) {
      setFavorites(previous);
      return;
    }
    window.dispatchEvent(new Event("bitemap:favorites-changed"));
  }

  if (favorites.length === 0) {
    return (
      <section className="signin-panel">
        <Heart size={30} />
        <h2>{loading ? "Checking your saved water..." : "No saved spots yet."}</h2>
        <p>Choose a heart on the opportunity map to start your private shortlist. This screen updates as soon as your account changes.</p>
        <Link href="/">Explore the map</Link>
      </section>
    );
  }

  return (
    <section className="favorite-grid" aria-busy={loading}>
      {favorites.map((favorite) => {
        const location = catalog?.locations.find((item) => item.id === favorite.locationId) ?? locationById(favorite.locationId);
        if (!location) return null;
        const evidence = favorite.preferredSpecies ? opportunityFor(location, favorite.preferredSpecies) : null;
        return (
          <article className="favorite-card" key={favorite.id}>
            <span className="eyebrow">{favorite.nickname || location.county}</span>
            <h2>{location.name}</h2>
            <p>{location.waterbody}</p>
            <div className="favorite-score">
              <strong>{evidence?.score ?? "—"}</strong>
              <span>{favorite.preferredSpecies ? catalog?.species.find((item) => item.id === favorite.preferredSpecies)?.name ?? speciesById(favorite.preferredSpecies)?.name : "Choose a target"}<br />{location.bestWindow}</span>
            </div>
            <div className="favorite-card-actions">
              <a href={googleDirectionsUrl(location)} target="_blank" rel="noreferrer"><Navigation size={15} /> Directions</a>
              <Link href={`/locations/${location.id}`}>Spot details <ArrowRight size={15} /></Link>
              <button onClick={() => void removeFavorite(favorite)} aria-label={`Remove ${location.name} from My Spots`}><Heart size={15} fill="currentColor" /> Remove</button>
            </div>
          </article>
        );
      })}
    </section>
  );
}
