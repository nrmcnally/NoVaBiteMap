"use client";

import { useEffect, useRef } from "react";
import type { FishingLocation } from "../lib/data";
import { opportunityFor } from "../lib/scoring";

type FishingMapProps = {
  locations: FishingLocation[];
  speciesId: string;
  selectedId?: string;
  onSelect: (id: string) => void;
};

export function FishingMap({ locations, speciesId, selectedId, onSelect }: FishingMapProps) {
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
        const opportunity = opportunityFor(location, speciesId);
        const score = opportunity?.score ?? 0;
        const selected = location.id === selectedId;
        const color = score >= 70 ? "#d65e36" : score >= 55 ? "#edae49" : "#1c6c72";
        const marker = L.circleMarker([location.lat, location.lng], {
          radius: selected ? 12 : 9,
          color: selected ? "#fff8e8" : "#173b3f",
          weight: selected ? 4 : 2,
          fillColor: color,
          fillOpacity: 1,
        }).addTo(map!);
        marker.bindTooltip(
          `<div class="map-tooltip"><strong>${location.name}</strong><span>${score ? `${score}/100 opportunity` : "Evidence pending"}</span></div>`,
          { direction: "top", offset: [0, -8], opacity: 1 },
        );
        marker.on("click", () => onSelect(location.id));
        bounds.push([location.lat, location.lng]);
      });

      if (bounds.length > 1) map.fitBounds(bounds, { padding: [35, 35], maxZoom: 10 });
      if (bounds.length === 1) map.setView(bounds[0], 11);
    }

    void mountMap();
    return () => {
      disposed = true;
      map?.stop();
      map?.remove();
    };
  }, [locations, onSelect, speciesId]);

  return <div className="leaflet-shell" ref={mapElement} aria-label="Interactive map of fishing opportunities" />;
}
