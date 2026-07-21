"use client";

import { useEffect, useRef } from "react";
import { consumptionAdviceFor } from "../lib/advisories";
import type { FishingLocation } from "../lib/data";
import type { TravelOrigin } from "../lib/travel";

export type MapOpportunity = {
  score: number;
  speciesName: string;
  matchCount: number;
};

type FishingMapProps = {
  locations: FishingLocation[];
  speciesIds: string[];
  opportunities: Map<string, MapOpportunity>;
  selectedId?: string;
  origin?: TravelOrigin | null;
  onSelect: (id: string) => void;
};

function opportunityColor(opportunity: MapOpportunity | null) {
  if (!opportunity) return "#8b9893";
  if (opportunity.score >= 70) return "#d65e36";
  if (opportunity.score >= 55) return "#edae49";
  return "#1c6c72";
}

function tooltipHtml(location: FishingLocation, opportunity: MapOpportunity | null, speciesIds: string[]) {
  const advisory = consumptionAdviceFor(location.consumptionAdvisory, speciesIds);
  const status = !opportunity
    ? (speciesIds.length === 0 ? "Verified access · evidence pending" : "Selected-species evidence pending")
    : speciesIds.length === 0
      ? `${opportunity.score}/100 · top target ${opportunity.speciesName}`
      : `${opportunity.score}/100 best selected target${opportunity.matchCount > 1 ? ` · ${opportunity.matchCount} matches` : ""}`;
  return `<div class="map-tooltip"><strong>${location.name}</strong><span>${status}</span>${advisory.status === "active" ? `<em>${advisory.label}</em>` : ""}</div>`;
}

export function FishingMap({ locations, speciesIds, opportunities, selectedId, origin, onSelect }: FishingMapProps) {
  const mapElement = useRef<HTMLDivElement>(null);
  const markerById = useRef<Map<string, import("leaflet").CircleMarker>>(new Map());
  const advisoryRingById = useRef<Map<string, import("leaflet").CircleMarker>>(new Map());
  const markerVisualKeyById = useRef<Map<string, string>>(new Map());
  const opportunitiesRef = useRef(opportunities);
  const speciesIdsRef = useRef(speciesIds);
  const selectedIdRef = useRef(selectedId);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    opportunitiesRef.current = opportunities;
    speciesIdsRef.current = speciesIds;
    selectedIdRef.current = selectedId;
    onSelectRef.current = onSelect;
  }, [onSelect, opportunities, selectedId, speciesIds]);

  useEffect(() => {
    let disposed = false;
    let map: import("leaflet").Map | undefined;
    const markers = markerById.current;
    const advisoryRings = advisoryRingById.current;
    const markerVisualKeys = markerVisualKeyById.current;

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
        const opportunity = opportunitiesRef.current.get(location.id) ?? null;
        const advisory = consumptionAdviceFor(location.consumptionAdvisory, speciesIds);
        const selected = location.id === selectedIdRef.current;
        const hasSpeciesEvidence = Boolean(opportunity);
        if (advisory.status === "active") {
          const ring = L.circleMarker([location.lat, location.lng], {
            radius: selected ? 17 : 14,
            color: "#a84f35",
            weight: 3,
            opacity: 0.92,
            fillOpacity: 0,
            dashArray: "4 3",
            interactive: false,
          }).addTo(map!);
          advisoryRings.set(location.id, ring);
        }
        const marker = L.circleMarker([location.lat, location.lng], {
          radius: selected ? 12 : 9,
          color: selected ? "#fff8e8" : "#173b3f",
          weight: selected ? 4 : 2,
          fillColor: opportunityColor(opportunity),
          fillOpacity: hasSpeciesEvidence ? 1 : 0.72,
        }).addTo(map!);
        marker.bindTooltip(
          () => tooltipHtml(
            location,
            opportunitiesRef.current.get(location.id) ?? null,
            speciesIdsRef.current,
          ),
          { direction: "top", offset: [0, -8], opacity: 1 },
        );
        marker.on("click", () => onSelectRef.current(location.id));
        markers.set(location.id, marker);
        markerVisualKeys.set(
          location.id,
          `${selected ? "selected" : "idle"}:${opportunityColor(opportunity)}:${hasSpeciesEvidence ? "evidenced" : "pending"}`,
        );
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
      markers.clear();
      advisoryRings.clear();
      markerVisualKeys.clear();
      map?.stop();
      map?.remove();
    };
  }, [locations, origin, speciesIds]);

  useEffect(() => {
    for (const location of locations) {
      const marker = markerById.current.get(location.id);
      if (!marker) continue;
      const opportunity = opportunities.get(location.id) ?? null;
      const selected = location.id === selectedId;
      const visualKey = `${selected ? "selected" : "idle"}:${opportunityColor(opportunity)}:${opportunity ? "evidenced" : "pending"}`;
      if (markerVisualKeyById.current.get(location.id) === visualKey) continue;
      marker.setRadius(selected ? 12 : 9);
      marker.setStyle({
        color: selected ? "#fff8e8" : "#173b3f",
        weight: selected ? 4 : 2,
        fillColor: opportunityColor(opportunity),
        fillOpacity: opportunity ? 1 : 0.72,
      });
      advisoryRingById.current.get(location.id)?.setRadius(selected ? 17 : 14);
      markerVisualKeyById.current.set(location.id, visualKey);
    }
  }, [locations, opportunities, selectedId]);

  return <div className="leaflet-shell" ref={mapElement} aria-label="Interactive map of fishing opportunities" />;
}
