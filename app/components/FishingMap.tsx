"use client";

import { useEffect, useRef } from "react";
import { consumptionAdviceFor } from "../lib/advisories";
import { speciesById, type FishingLocation } from "../lib/data";
import { opportunityFor } from "../lib/scoring";
import type { TravelOrigin } from "../lib/travel";

type FishingMapProps = {
  locations: FishingLocation[];
  speciesIds: string[];
  selectedId?: string;
  origin?: TravelOrigin | null;
  onSelect: (id: string) => void;
};

export function FishingMap({ locations, speciesIds, selectedId, origin, onSelect }: FishingMapProps) {
  const mapElement = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let map: import("leaflet").Map | undefined;

    async function mountMap() {
      if (!mapElement.current) return;
      const L = await import("leaflet");
      if (disposed || !mapElement.current) return;

      map = L.map(mapElement.current, {
        zoomControl: false,
        scrollWheelZoom: true,
        minZoom: 7,
        zoomAnimation: false,
        fadeAnimation: false,
        markerZoomAnimation: false,
      }).setView([38.93, -77.82], 8);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 18,
      }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);

      const bounds: [number, number][] = [];
      locations.forEach((location) => {
        // With a target species, rank by it; otherwise color by the location's
        // strongest evidenced fish so the map reflects the default ranking.
        const sourceSpecies = speciesIds.length > 0
          ? speciesIds
          : [...new Set(location.evidence.map((evidence) => evidence.speciesId))];
        const opportunities = sourceSpecies
          .map((speciesId) => opportunityFor(location, speciesId))
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
          .sort((a, b) => b.score - a.score);
        const opportunity = opportunities[0] ?? null;
        const advisory = consumptionAdviceFor(location.consumptionAdvisory, speciesIds);
        const score = opportunity?.score ?? 0;
        const selected = location.id === selectedId;
        const hasSpeciesEvidence = Boolean(opportunity);
        const color = !hasSpeciesEvidence
          ? "#8b9893"
          : score >= 70
            ? "#d65e36"
            : score >= 55
              ? "#edae49"
              : "#1c6c72";
        if (advisory.status === "active") {
          L.circleMarker([location.lat, location.lng], {
            radius: selected ? 17 : 14,
            color: "#a84f35",
            weight: 3,
            opacity: 0.92,
            fillOpacity: 0,
            dashArray: "4 3",
            interactive: false,
          }).addTo(map!);
        }
        const marker = L.circleMarker([location.lat, location.lng], {
          radius: selected ? 12 : 9,
          color: selected ? "#fff8e8" : "#173b3f",
          weight: selected ? 4 : 2,
          fillColor: color,
          fillOpacity: hasSpeciesEvidence ? 1 : 0.72,
        }).addTo(map!);
        const topFishName = opportunity ? speciesById(opportunity.evidence.speciesId)?.name ?? "" : "";
        const tooltipStatus = !hasSpeciesEvidence
          ? (speciesIds.length === 0 ? "Verified access · evidence pending" : "Selected-species evidence pending")
          : speciesIds.length === 0
            ? `${score}/100 · top target ${topFishName}`
            : `${score}/100 best selected target${opportunities.length > 1 ? ` · ${opportunities.length} matches` : ""}`;
        marker.bindTooltip(
          `<div class="map-tooltip"><strong>${location.name}</strong><span>${tooltipStatus}</span>${advisory.status === "active" ? `<em>${advisory.label}</em>` : ""}</div>`,
          { direction: "top", offset: [0, -8], opacity: 1 },
        );
        marker.on("click", () => onSelect(location.id));
        bounds.push([location.lat, location.lng]);
      });

      if (origin) {
        L.circleMarker([origin.lat, origin.lng], {
          radius: 8,
          color: "#fffdf7",
          weight: 4,
          fillColor: "#102f31",
          fillOpacity: 1,
        }).addTo(map).bindTooltip(
          `<div class="map-tooltip"><strong>Your starting point</strong><span>${origin.label}</span></div>`,
          { direction: "top", offset: [0, -8], opacity: 1 },
        );
        bounds.push([origin.lat, origin.lng]);
      }

      if (bounds.length > 1) map.fitBounds(bounds, { padding: [35, 35], maxZoom: 10 });
      if (bounds.length === 1) map.setView(bounds[0], 11);
    }

    void mountMap();
    return () => {
      disposed = true;
      map?.stop();
      map?.remove();
    };
  }, [locations, onSelect, origin, selectedId, speciesIds]);

  return <div className="leaflet-shell" ref={mapElement} aria-label="Interactive map of fishing opportunities" />;
}
