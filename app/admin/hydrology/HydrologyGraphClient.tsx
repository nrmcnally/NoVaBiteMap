"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownUp,
  Check,
  ChevronLeft,
  Download,
  Info,
  LocateFixed,
  MapPin,
  Network,
  PencilLine,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Undo2,
  Waves,
  X,
} from "lucide-react";
import { TopNav } from "../../components/TopNav";
import type {
  HydrologyConnection,
  HydrologyCoordinate,
  HydrologyDirectionBasis,
  HydrologyFlowKind,
} from "../../lib/hydrology-graph";
import { HydrologyGraphMap } from "./HydrologyGraphMap";

export type HydrologyNode = {
  id: string;
  number: number;
  name: string;
  waterbody: string;
  waterbodyType: string;
  county: string;
  lat: number;
  lng: number;
};

type NodeElevation = {
  locationId: string;
  elevationFeet: number;
  resolutionMeters: number | null;
  source: string;
  sourceUrl: string;
  sampledAt: string;
};

type DirectionSuggestion = {
  highNodeId: string;
  lowNodeId: string;
  dropFeet: number;
  basis: "elevation-clear" | "elevation-marginal";
};

export function HydrologyGraphClient({ nodes, adminName }: { nodes: HydrologyNode[]; adminName: string }) {
  const [connections, setConnections] = useState<HydrologyConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fromId, setFromId] = useState<string | null>(null);
  const [toId, setToId] = useState<string | null>(null);
  const [waypoints, setWaypoints] = useState<HydrologyCoordinate[]>([]);
  const [flowKind, setFlowKind] = useState<HydrologyFlowKind>("uncertain");
  const [directionBasis, setDirectionBasis] = useState<HydrologyDirectionBasis>("unknown");
  const [elevationDropFeet, setElevationDropFeet] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [deleteArmedId, setDeleteArmedId] = useState<string | null>(null);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [elevations, setElevations] = useState<Record<string, NodeElevation>>({});
  const [elevationLoading, setElevationLoading] = useState(false);
  const [elevationError, setElevationError] = useState<string | null>(null);

  const nodesById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const fromNode = fromId ? nodesById.get(fromId) ?? null : null;
  const toNode = toId ? nodesById.get(toId) ?? null : null;
  const selectedConnection = connections.find((item) => item.id === selectedConnectionId) ?? null;
  const connectedNodeIds = useMemo(() => new Set(connections.flatMap((connection) => [connection.fromLocationId, connection.toLocationId])), [connections]);
  const draftPath = useMemo<HydrologyCoordinate[]>(() => {
    if (!fromNode) return [];
    const path: HydrologyCoordinate[] = [[fromNode.lat, fromNode.lng], ...waypoints];
    if (toNode) path.push([toNode.lat, toNode.lng]);
    return path;
  }, [fromNode, toNode, waypoints]);
  const suggestion = useMemo(() => directionSuggestion(fromId, toId, elevations), [elevations, fromId, toId]);
  const filteredNodes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return nodes;
    return nodes.filter((node) => `${node.number} ${node.name} ${node.waterbody} ${node.county}`.toLowerCase().includes(needle));
  }, [nodes, query]);

  useEffect(() => {
    let disposed = false;
    async function loadConnections() {
      try {
        const response = await fetch("/api/admin/hydrology-connections", { cache: "no-store" });
        const body = await response.json() as { connections?: HydrologyConnection[]; error?: string };
        if (!response.ok) throw new Error(body.error || "Unable to load the hydrology graph.");
        if (!disposed) setConnections(body.connections ?? []);
      } catch (loadError) {
        if (!disposed) setError(loadError instanceof Error ? loadError.message : "Unable to load the hydrology graph.");
      } finally {
        if (!disposed) setLoading(false);
      }
    }
    void loadConnections();
    return () => { disposed = true; };
  }, []);

  const ensureElevations = useCallback(async (firstId: string, secondId: string) => {
    const missing = [firstId, secondId].filter((id) => !elevations[id]);
    if (!missing.length) return;
    setElevationLoading(true);
    setElevationError(null);
    const search = new URLSearchParams();
    missing.forEach((id) => search.append("locationId", id));
    try {
      const response = await fetch(`/api/admin/hydrology-elevations?${search}`, { cache: "no-store" });
      const body = await response.json() as { elevations?: NodeElevation[]; error?: string };
      if (!response.ok) throw new Error(body.error || "Elevation lookup failed.");
      setElevations((current) => ({
        ...current,
        ...(body.elevations ?? []).reduce<Record<string, NodeElevation>>((result, elevation) => {
          result[elevation.locationId] = elevation;
          return result;
        }, {}),
      }));
    } catch (lookupError) {
      setElevationError(lookupError instanceof Error ? lookupError.message : "Elevation lookup failed.");
    } finally {
      setElevationLoading(false);
    }
  }, [elevations]);

  const beginConnection = useCallback((nodeId?: string) => {
    setFromId(nodeId ?? null);
    setToId(null);
    setWaypoints([]);
    setFlowKind("uncertain");
    setDirectionBasis("unknown");
    setElevationDropFeet(null);
    setNotes("");
    setEditingId(null);
    setSelectedConnectionId(null);
    setDeleteArmedId(null);
    setNotice(null);
    setError(null);
    if (nodeId) setFocusNodeId(nodeId);
  }, []);

  const handleNodeClick = useCallback((nodeId: string) => {
    setFocusNodeId(nodeId);
    if (!fromId) {
      beginConnection(nodeId);
      return;
    }
    if (!toId && nodeId !== fromId) {
      setToId(nodeId);
      setSelectedConnectionId(null);
      void ensureElevations(fromId, nodeId);
    }
  }, [beginConnection, ensureElevations, fromId, toId]);

  const handleMapClick = useCallback((point: HydrologyCoordinate) => {
    if (fromId && !toId) setWaypoints((current) => [...current, point]);
  }, [fromId, toId]);

  function applySuggestion() {
    if (!suggestion) return;
    if (fromId !== suggestion.highNodeId) {
      setFromId(suggestion.highNodeId);
      setToId(suggestion.lowNodeId);
      setWaypoints((current) => [...current].reverse());
    }
    setFlowKind("downstream");
    setDirectionBasis(suggestion.basis);
    setElevationDropFeet(suggestion.dropFeet);
    setNotice("Elevation-assisted direction applied. It remains a modeled suggestion until independently verified.");
  }

  function reverseDirection() {
    if (!fromId || !toId) return;
    setFromId(toId);
    setToId(fromId);
    setWaypoints((current) => [...current].reverse());
    setDirectionBasis("manual");
    setElevationDropFeet(null);
    setNotice("Direction reversed manually.");
  }

  function changeFlowKind(next: HydrologyFlowKind) {
    setFlowKind(next);
    if (next === "tidal") setDirectionBasis("tidal");
    else if (next === "uncertain") setDirectionBasis("unknown");
    else if (directionBasis === "tidal" || directionBasis === "unknown") setDirectionBasis("manual");
    if (next !== "downstream") setElevationDropFeet(null);
  }

  async function saveConnection() {
    if (!fromId || !toId || draftPath.length < 2) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const endpoint = editingId ? `/api/admin/hydrology-connections/${editingId}` : "/api/admin/hydrology-connections";
      const response = await fetch(endpoint, {
        method: editingId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fromLocationId: fromId, toLocationId: toId, flowKind, directionBasis, elevationDropFeet, path: draftPath, notes }),
      });
      const body = await response.json() as { connection?: HydrologyConnection; error?: string };
      if (!response.ok || !body.connection) throw new Error(body.error || "Unable to save the connection.");
      setConnections((current) => editingId
        ? current.map((item) => item.id === editingId ? body.connection! : item)
        : [...current, body.connection!]);
      const savedId = body.connection.id;
      beginConnection();
      setSelectedConnectionId(savedId);
      setNotice(editingId ? "Connection updated." : "Connection saved. Your graph progress is stored.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save the connection.");
    } finally {
      setSaving(false);
    }
  }

  function redrawConnection(connection: HydrologyConnection) {
    setFromId(connection.fromLocationId);
    setToId(null);
    setWaypoints([]);
    setFlowKind(connection.flowKind);
    setDirectionBasis(connection.directionBasis);
    setElevationDropFeet(connection.elevationDropFeet);
    setNotes(connection.notes ?? "");
    setEditingId(connection.id);
    setSelectedConnectionId(null);
    setDeleteArmedId(null);
    setFocusNodeId(connection.fromLocationId);
    setNotice("Trace the replacement path, then choose its second endpoint.");
  }

  async function deleteConnection(connection: HydrologyConnection) {
    if (deleteArmedId !== connection.id) {
      setDeleteArmedId(connection.id);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/hydrology-connections/${connection.id}`, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json() as { error?: string };
        throw new Error(body.error || "Unable to delete the connection.");
      }
      setConnections((current) => current.filter((item) => item.id !== connection.id));
      setSelectedConnectionId(null);
      setDeleteArmedId(null);
      setNotice("Connection deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete the connection.");
    } finally {
      setSaving(false);
    }
  }

  function exportGraph() {
    const payload = {
      schemaVersion: "bitemap-hydrology-graph-v0.1.0",
      exportedAt: new Date().toISOString(),
      nodeCount: nodes.length,
      connectionCount: connections.length,
      connections: connections.map((connection) => ({
        id: connection.id,
        fromLocationId: connection.fromLocationId,
        toLocationId: connection.toLocationId,
        flowKind: connection.flowKind,
        directionBasis: connection.directionBasis,
        elevationDropFeet: connection.elevationDropFeet,
        path: connection.path,
        notes: connection.notes,
        createdAt: connection.createdAt,
        updatedAt: connection.updatedAt,
      })),
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `bitemap-hydrology-graph-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const stage = !fromId ? 1 : !toId ? 2 : 3;
  return (
    <div className="app-frame hydrology-editor-page">
      <TopNav />
      <main className="hydrology-editor-layout">
        <aside className="hydrology-editor-tools">
          <div className="hydrology-editor-heading">
            <Link href="/admin/data-health"><ChevronLeft size={15} /> Data health</Link>
            <span className="eyebrow"><Network size={14} /> Hydrology topology</span>
            <h1>Trace how the water connects.</h1>
            <p>Draw the actual watercourse between fishing nodes. BiteMap will preserve every bend you add.</p>
            <span className="identity-chip"><ShieldCheck size={14} /> {adminName}</span>
          </div>

          <div className="hydrology-stats">
            <span><strong>{nodes.length}</strong> nodes</span>
            <span><strong>{connections.length}</strong> paths</span>
            <span><strong>{connectedNodeIds.size}</strong> connected</span>
          </div>

          <section className="hydrology-workflow">
            <div className="hydrology-workflow-title">
              <span>{editingId ? "Redrawing connection" : "New connection"}</span>
              {(fromId || editingId) && <button type="button" onClick={() => beginConnection()}><X size={14} /> Cancel</button>}
            </div>
            <ol className="hydrology-steps">
              <li className={stage >= 1 && fromId ? "done" : stage === 1 ? "active" : ""}><i>{fromId ? <Check size={13} /> : 1}</i><span><strong>Choose endpoint A</strong><small>{fromNode?.name ?? "Click any numbered node"}</small></span></li>
              <li className={stage === 2 ? "active" : stage > 2 ? "done" : ""}><i>{toId ? <Check size={13} /> : 2}</i><span><strong>Trace the water</strong><small>{toId ? `${waypoints.length} bend${waypoints.length === 1 ? "" : "s"} traced` : "Click the map at every bend, then choose endpoint B"}</small></span></li>
              <li className={stage === 3 ? "active" : ""}><i>3</i><span><strong>Review direction</strong><small>Use elevation, or mark tidal/uncertain</small></span></li>
            </ol>

            {!fromId && <button className="hydrology-primary" type="button" onClick={() => beginConnection()}><PencilLine size={16} /> Click a map node to begin</button>}
            {fromId && !toId && (
              <div className="hydrology-draw-controls">
                <button type="button" disabled={!waypoints.length} onClick={() => setWaypoints((current) => current.slice(0, -1))}><Undo2 size={15} /> Undo bend</button>
                <span>{waypoints.length} bend point{waypoints.length === 1 ? "" : "s"}</span>
              </div>
            )}

            {fromNode && toNode && (
              <div className="hydrology-review">
                <div className="hydrology-endpoints">
                  <span><small>From</small><strong>{fromNode.name}</strong>{elevations[fromNode.id] && <em>{elevations[fromNode.id].elevationFeet.toFixed(1)} ft ground elev.</em>}</span>
                  <ArrowDownUp size={18} />
                  <span><small>To</small><strong>{toNode.name}</strong>{elevations[toNode.id] && <em>{elevations[toNode.id].elevationFeet.toFixed(1)} ft ground elev.</em>}</span>
                </div>
                {elevationLoading && <p className="hydrology-inline-status">Checking USGS 3DEP elevation…</p>}
                {elevationError && <p className="hydrology-inline-error">{elevationError} You can still save this as uncertain.</p>}
                {!elevationLoading && suggestion && (
                  <div className={`elevation-suggestion ${suggestion.basis}`}>
                    <div><strong>{suggestion.dropFeet.toFixed(1)} ft modeled drop</strong><span>{suggestion.basis === "elevation-clear" ? "Stronger elevation signal" : "Weak elevation signal"}</span></div>
                    <button type="button" onClick={applySuggestion}>Use suggested direction</button>
                  </div>
                )}
                {!elevationLoading && fromId && toId && elevations[fromId] && elevations[toId] && !suggestion && (
                  <div className="elevation-indeterminate"><Info size={15} /><span>The modeled difference is under 5 ft, so elevation cannot resolve the direction safely.</span></div>
                )}
                <label className="hydrology-field"><span>Connection behavior</span><select value={flowKind} onChange={(event) => changeFlowKind(event.target.value as HydrologyFlowKind)}><option value="uncertain">Direction unresolved</option><option value="downstream">Downstream direction</option><option value="tidal">Tidal / bidirectional</option></select></label>
                <label className="hydrology-field"><span>Notes <small>optional</small></span><textarea value={notes} maxLength={500} onChange={(event) => setNotes(event.target.value)} placeholder="Dam, culvert, confluence, seasonal behavior…" /></label>
                <div className="hydrology-review-actions">
                  <button type="button" onClick={reverseDirection}><RotateCcw size={15} /> Reverse</button>
                  <button className="hydrology-save" type="button" disabled={saving} onClick={() => void saveConnection()}><Save size={15} /> {saving ? "Saving…" : editingId ? "Update path" : "Save path"}</button>
                </div>
                <p className="hydrology-caveat"><Info size={14} /> Elevation is interpolated ground height, not surveyed water-surface elevation. It suggests direction only.</p>
              </div>
            )}
          </section>

          {selectedConnection && !fromId && (
            <section className="hydrology-selected-card">
              <span className="eyebrow">Selected path</span>
              <h2>{nodesById.get(selectedConnection.fromLocationId)?.name} {selectedConnection.flowKind === "tidal" ? "↔" : "→"} {nodesById.get(selectedConnection.toLocationId)?.name}</h2>
              <p>{connectionBasisCopy(selectedConnection)}</p>
              {selectedConnection.notes && <blockquote>{selectedConnection.notes}</blockquote>}
              <div><button type="button" onClick={() => redrawConnection(selectedConnection)}><PencilLine size={15} /> Redraw</button><button className={deleteArmedId === selectedConnection.id ? "danger armed" : "danger"} type="button" disabled={saving} onClick={() => void deleteConnection(selectedConnection)}><Trash2 size={15} /> {deleteArmedId === selectedConnection.id ? "Confirm delete" : "Delete"}</button></div>
            </section>
          )}

          {(error || notice) && <div className={error ? "hydrology-message error" : "hydrology-message success"}>{error ?? notice}</div>}
          <button className="hydrology-export" type="button" onClick={exportGraph} disabled={!connections.length}><Download size={15} /> Export graph JSON</button>
        </aside>

        <section className="hydrology-map-stage">
          <HydrologyGraphMap
            nodes={nodes}
            connections={connections}
            connectedNodeIds={connectedNodeIds}
            draftPath={draftPath}
            fromId={fromId}
            toId={toId}
            selectedConnectionId={selectedConnectionId}
            focusNodeId={focusNodeId}
            onNodeClick={handleNodeClick}
            onMapClick={handleMapClick}
            onConnectionClick={(id) => { if (!fromId) { setSelectedConnectionId(id); setDeleteArmedId(null); } }}
          />
          <div className="hydrology-map-key"><span><i className="downstream" /> Downstream</span><span><i className="tidal" /> Tidal</span><span><i className="uncertain" /> Uncertain</span><span><i className="draft" /> Draft</span></div>
          {loading && <div className="hydrology-map-loading">Loading saved graph…</div>}
        </section>

        <aside className="hydrology-node-panel">
          <div><span className="eyebrow"><MapPin size={13} /> Fishing nodes</span><h2>Find a point</h2></div>
          <label className="hydrology-node-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, water, county…" /></label>
          <p>{filteredNodes.length} of {nodes.length} nodes</p>
          <div className="hydrology-node-list">
            {filteredNodes.map((node) => (
              <button type="button" key={node.id} className={`${connectedNodeIds.has(node.id) ? "connected" : ""} ${node.id === fromId || node.id === toId ? "active" : ""}`} onClick={() => handleNodeClick(node.id)}>
                <b>{String(node.number).padStart(3, "0")}</b>
                <span><strong>{node.name}</strong><small>{node.waterbody} · {node.county}</small></span>
                <LocateFixed size={14} />
              </button>
            ))}
          </div>
          <div className="hydrology-source-note"><Waves size={16} /><span><strong>Elevation source</strong><a href="https://apps.nationalmap.gov/epqs/" target="_blank" rel="noreferrer">USGS 3DEP EPQS</a>Interpolated points are cached after lookup.</span></div>
        </aside>
      </main>
    </div>
  );
}

function directionSuggestion(fromId: string | null, toId: string | null, elevations: Record<string, NodeElevation>): DirectionSuggestion | null {
  if (!fromId || !toId || !elevations[fromId] || !elevations[toId]) return null;
  const difference = elevations[fromId].elevationFeet - elevations[toId].elevationFeet;
  const dropFeet = Math.abs(difference);
  if (dropFeet < 5) return null;
  return {
    highNodeId: difference > 0 ? fromId : toId,
    lowNodeId: difference > 0 ? toId : fromId,
    dropFeet: Math.round(dropFeet * 10) / 10,
    basis: dropFeet >= 15 ? "elevation-clear" : "elevation-marginal",
  };
}

function connectionBasisCopy(connection: HydrologyConnection) {
  if (connection.flowKind === "tidal") return "Stored as tidal or bidirectional; no one-way flow is asserted.";
  if (connection.flowKind === "uncertain") return "The physical path is stored, but its flow direction remains unresolved.";
  if (connection.directionBasis === "elevation-clear") return `Elevation-assisted direction with a ${connection.elevationDropFeet?.toFixed(1) ?? "—"} ft modeled drop. Not independently verified.`;
  if (connection.directionBasis === "elevation-marginal") return `Weak elevation-assisted direction with a ${connection.elevationDropFeet?.toFixed(1) ?? "—"} ft modeled drop. Treat cautiously.`;
  return "Direction was set manually.";
}
