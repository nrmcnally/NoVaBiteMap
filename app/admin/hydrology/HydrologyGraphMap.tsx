"use client";

import { useEffect, useRef } from "react";
import type { HydrologyConnection, HydrologyCoordinate } from "../../lib/hydrology-graph";
import type { HydrologyNode } from "./HydrologyGraphClient";

type Props = {
  nodes: HydrologyNode[];
  connections: HydrologyConnection[];
  connectedNodeIds: Set<string>;
  draftPath: HydrologyCoordinate[];
  fromId: string | null;
  toId: string | null;
  selectedConnectionId: string | null;
  focusNodeId: string | null;
  onNodeClick: (id: string) => void;
  onMapClick: (point: HydrologyCoordinate) => void;
  onConnectionClick: (id: string) => void;
};

export function HydrologyGraphMap({
  nodes,
  connections,
  connectedNodeIds,
  draftPath,
  fromId,
  toId,
  selectedConnectionId,
  focusNodeId,
  onNodeClick,
  onMapClick,
  onConnectionClick,
}: Props) {
  const element = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerById = useRef(new Map<string, import("leaflet").Marker>());
  const connectionLayer = useRef<import("leaflet").LayerGroup | null>(null);
  const draftLayer = useRef<import("leaflet").LayerGroup | null>(null);
  const nodeClickRef = useRef(onNodeClick);
  const mapClickRef = useRef(onMapClick);
  const connectionClickRef = useRef(onConnectionClick);

  useEffect(() => {
    nodeClickRef.current = onNodeClick;
    mapClickRef.current = onMapClick;
    connectionClickRef.current = onConnectionClick;
  }, [onConnectionClick, onMapClick, onNodeClick]);

  useEffect(() => {
    let disposed = false;
    const markers = markerById.current;
    async function mount() {
      if (!element.current) return;
      const L = await import("leaflet");
      if (disposed || !element.current) return;
      const map = L.map(element.current, {
        zoomControl: false,
        minZoom: 7,
        maxZoom: 19,
        preferCanvas: true,
      });
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      connectionLayer.current = L.layerGroup().addTo(map);
      draftLayer.current = L.layerGroup().addTo(map);
      map.createPane("hydrologyNodes");
      const nodePane = map.getPane("hydrologyNodes");
      if (nodePane) nodePane.style.zIndex = "650";

      const bounds: HydrologyCoordinate[] = [];
      for (const node of nodes) {
        const marker = L.marker([node.lat, node.lng], {
          icon: nodeIcon(L, node.number, "idle"),
          pane: "hydrologyNodes",
          keyboard: true,
          riseOnHover: true,
          title: `Node ${node.number}: ${node.name}`,
        }).addTo(map);
        marker.bindTooltip(
          `<strong>Node ${String(node.number).padStart(3, "0")}</strong><span>${escapeHtml(node.name)}</span><small>${escapeHtml(node.waterbody)} · ${escapeHtml(node.county)}</small>`,
          { className: "hydrology-node-tooltip", direction: "top", offset: [0, -14] },
        );
        marker.on("click", (event) => {
          L.DomEvent.stopPropagation(event);
          nodeClickRef.current(node.id);
        });
        markers.set(node.id, marker);
        bounds.push([node.lat, node.lng]);
      }
      map.on("click", (event: import("leaflet").LeafletMouseEvent) => {
        mapClickRef.current([event.latlng.lat, event.latlng.lng]);
      });
      if (bounds.length > 1) map.fitBounds(bounds, { padding: [36, 36], maxZoom: 9 });
    }
    void mount();
    return () => {
      disposed = true;
      markers.clear();
      mapRef.current?.remove();
      mapRef.current = null;
      connectionLayer.current = null;
      draftLayer.current = null;
    };
  }, [nodes]);

  useEffect(() => {
    let disposed = false;
    async function redrawNodes() {
      const L = await import("leaflet");
      if (disposed) return;
      for (const node of nodes) {
        const state = node.id === fromId ? "from" : node.id === toId ? "to" : connectedNodeIds.has(node.id) ? "connected" : "idle";
        markerById.current.get(node.id)?.setIcon(nodeIcon(L, node.number, state));
      }
    }
    void redrawNodes();
    return () => { disposed = true; };
  }, [connectedNodeIds, fromId, nodes, toId]);

  useEffect(() => {
    let disposed = false;
    async function redrawConnections() {
      const L = await import("leaflet");
      const layer = connectionLayer.current;
      if (disposed || !layer) return;
      layer.clearLayers();
      const nodeNames = new Map(nodes.map((node) => [node.id, node.name]));
      for (const connection of connections) {
        if (connection.path.length < 2) continue;
        const selected = connection.id === selectedConnectionId;
        const color = flowColor(connection.flowKind);
        const line = L.polyline(connection.path, {
          color,
          weight: selected ? 7 : 4,
          opacity: selected ? 1 : 0.82,
          dashArray: connection.flowKind === "uncertain" ? "8 7" : connection.flowKind === "tidal" ? "4 5" : undefined,
        }).addTo(layer);
        line.bindTooltip(
          `<strong>${escapeHtml(nodeNames.get(connection.fromLocationId) ?? connection.fromLocationId)}</strong><span>${connection.flowKind === "tidal" ? " ↔ " : " → "}${escapeHtml(nodeNames.get(connection.toLocationId) ?? connection.toLocationId)}</span><small>${basisLabel(connection.directionBasis)}</small>`,
          { className: "hydrology-edge-tooltip", sticky: true },
        );
        line.on("click", (event) => {
          L.DomEvent.stopPropagation(event);
          connectionClickRef.current(connection.id);
        });
        const arrow = arrowForPath(connection.path, connection.flowKind);
        L.marker(arrow.point, {
          interactive: false,
          icon: L.divIcon({
            className: "hydrology-flow-arrow",
            html: `<span style="transform:rotate(${arrow.angle}deg)">${connection.flowKind === "tidal" ? "↔" : connection.flowKind === "uncertain" ? "?" : "➜"}</span>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          }),
        }).addTo(layer);
      }
    }
    void redrawConnections();
    return () => { disposed = true; };
  }, [connections, nodes, selectedConnectionId]);

  useEffect(() => {
    let disposed = false;
    async function redrawDraft() {
      const L = await import("leaflet");
      const layer = draftLayer.current;
      if (disposed || !layer) return;
      layer.clearLayers();
      if (draftPath.length >= 2) {
        L.polyline(draftPath, { color: "#d86136", weight: 5, opacity: 0.95, dashArray: "10 7" }).addTo(layer);
      }
      draftPath.slice(1, -1).forEach((point, index) => {
        L.circleMarker(point, { radius: 5, color: "#fffaf0", weight: 2, fillColor: "#d86136", fillOpacity: 1 })
          .bindTooltip(`Bend ${index + 1}`)
          .addTo(layer);
      });
    }
    void redrawDraft();
    return () => { disposed = true; };
  }, [draftPath]);

  useEffect(() => {
    if (!focusNodeId) return;
    const node = nodes.find((item) => item.id === focusNodeId);
    const map = mapRef.current;
    if (node && map) map.setView([node.lat, node.lng], Math.max(map.getZoom(), 12), { animate: true });
  }, [focusNodeId, nodes]);

  return <div className="hydrology-editor-map" ref={element} aria-label="Hydrology graph editor map" />;
}

function nodeIcon(L: typeof import("leaflet"), number: number, state: "idle" | "connected" | "from" | "to") {
  return L.divIcon({
    className: `hydrology-node-icon hydrology-node-${state}`,
    html: `<span>${String(number).padStart(3, "0")}</span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function arrowForPath(path: HydrologyCoordinate[], kind: HydrologyConnection["flowKind"]) {
  const segment = Math.max(0, Math.floor((path.length - 1) / 2));
  const start = path[segment];
  const end = path[segment + 1];
  const point: HydrologyCoordinate = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
  const angle = kind === "tidal" ? 0 : Math.atan2(-(end[0] - start[0]), end[1] - start[1]) * 180 / Math.PI;
  return { point, angle };
}

function flowColor(kind: HydrologyConnection["flowKind"]) {
  if (kind === "tidal") return "#287f9e";
  if (kind === "uncertain") return "#d39a35";
  return "#19705d";
}

function basisLabel(basis: HydrologyConnection["directionBasis"]) {
  if (basis === "elevation-clear") return "Direction suggested by a larger elevation difference";
  if (basis === "elevation-marginal") return "Direction weakly suggested by elevation";
  if (basis === "manual") return "Direction set manually";
  if (basis === "tidal") return "Tidal or bidirectional connection";
  return "Direction unresolved";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}
