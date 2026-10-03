"use client";

import { useCallback, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/lib/api";
import { useReliefData } from "@/components/ReliefDataContext";
import {
  List,
  CheckCircle,
  Clock,
  Truck,
  ShieldAlert,
  ArrowRight,
  RotateCw,
  MapPin,
  Package,
  FileText,
  X,
  ExternalLink,
  ShieldCheck
} from "lucide-react";

export default function ActiveAllocations() {
  const { allocations, loading, error, refreshSnapshot } = useReliefData();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedPassport, setSelectedPassport] = useState<any | null>(null);
  const [loadingPassportId, setLoadingPassportId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "warning" | "error"; text: string } | null>(null);

  const loadData = useCallback(async () => {
    try {
      await refreshSnapshot(true);
      setActionMessage(null);
    } catch {
      setActionMessage({ type: "error", text: "The allocation snapshot could not be refreshed. Existing records may be out of date." });
    }
  }, [refreshSnapshot]);

  const updateStatus = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    setActionMessage(null);
    try {
      await axios.patch(`${API_BASE_URL}/v1/allocations/${id}/status`, {
        status: newStatus
      });
      try {
        await refreshSnapshot(true);
        if (selectedPassport?.allocation_id === id) {
          const passport = await axios.get(`${API_BASE_URL}/v1/allocations/${id}/passport`);
          setSelectedPassport(passport.data);
        }
        setActionMessage({ type: "success", text: `Allocation updated to ${newStatus.replace("_", " ").toUpperCase()}.` });
      } catch {
        setActionMessage({ type: "warning", text: `Allocation updated to ${newStatus.replace("_", " ").toUpperCase()}, but its latest details could not be refreshed. Use refresh; listed records may be out of date.` });
      }
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.response?.data?.detail || "The allocation status was not changed. Please retry." });
    } finally {
      setUpdatingId(null);
    }
  };

  const inspectPassport = async (id: string) => {
    setLoadingPassportId(id);
    setActionMessage(null);
    try {
      const response = await axios.get(`${API_BASE_URL}/v1/allocations/${id}/passport`);
      setSelectedPassport(response.data);
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err.response?.data?.detail || "The Resource Passport could not be loaded.",
      });
    } finally {
      setLoadingPassportId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const normalized = status?.toLowerCase() || "unknown";
    const tones: Record<string, { background: string; color: string; borderColor: string }> = {
      proposed: { background: "#F5F7FA", color: "#374151", borderColor: "#D1D5DB" },
      approved: { background: "#E7F5F4", color: "#0B6968", borderColor: "#99D8D4" },
      dispatched: { background: "#EFF6FF", color: "#1D4ED8", borderColor: "#BFDBFE" },
      in_transit: { background: "#FFF7ED", color: "#C2410C", borderColor: "#FDBA74" },
      delivered: { background: "#F0FDF4", color: "#15803D", borderColor: "#BBF7D0" },
      verified: { background: "#DCFCE7", color: "#166534", borderColor: "#86EFAC" },
      superseded: { background: "#FEF2F2", color: "#B91C1C", borderColor: "#FECACA" },
      cancelled: { background: "#F3F4F6", color: "#6B7280", borderColor: "#D1D5DB" },
    };
    return <span className="inline-flex rounded-md border px-2.5 py-1 text-[11px] font-extrabold tracking-wide" style={tones[normalized] || tones.proposed}>{normalized.replace(/_/g, " ").toUpperCase()}</span>;
  };

  const getStatusExplanation = (status: string) => {
    const explanations: Record<string, string> = {
      proposed: "Awaiting operator approval",
      approved: "Approved for dispatch",
      dispatched: "Dispatched from the source facility",
      in_transit: "Resource is currently moving",
      delivered: "Resource reached destination",
      verified: "Delivery confirmed",
      superseded: "Replaced by a newer approved plan",
      cancelled: "Movement cancelled",
    };
    return explanations[status?.toLowerCase()] || "Status unavailable";
  };

  const lifecycle = ["PROPOSED", "APPROVED", "DISPATCHED", "IN TRANSIT", "DELIVERED", "VERIFIED"];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-teal-700">Live resource movements</div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Active Allocations</h1>
          <p className="mt-1 text-sm text-slate-600">Track every approved resource movement from proposal to delivery.</p>
          <p className="mt-2 text-xs text-slate-500">Resource Passports provide traceability for each movement and its approved strategy.</p>
        </div>
        <button
          onClick={loadData}
          disabled={updatingId !== null}
          aria-label="Refresh active allocations"
          className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 border border-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
          title="Refresh active allocations"
        >
          <RotateCw size={16} />
        </button>
      </div>

      <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm" aria-label="Allocation lifecycle">
        <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Movement lifecycle</div>
        <ol className="flex min-w-[650px] items-center gap-2 text-[10px] font-extrabold tracking-wide text-slate-700 md:min-w-0">
          {lifecycle.map((step, index) => <li key={step} className="flex flex-1 items-center gap-2"><span className="whitespace-nowrap rounded-md bg-slate-100 px-2.5 py-2">{step}</span>{index < lifecycle.length - 1 && <ArrowRight className="shrink-0 text-slate-400" size={14} aria-hidden="true" />}</li>)}
        </ol>
      </section>

      {actionMessage && <div role={actionMessage.type === "error" ? "alert" : "status"} className={`rounded-lg border p-3 text-sm ${actionMessage.type === "error" ? "border-rose-300 bg-rose-50 text-rose-800" : actionMessage.type === "warning" ? "border-amber-300 bg-amber-50 text-amber-900" : "border-green-200 bg-green-50 text-green-800"}`}>{actionMessage.text}</div>}
      
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-400 bg-slate-900/90 uppercase border-b border-slate-700">
              <tr>
                <th className="px-5 py-3.5">Resource Passport</th>
                <th className="px-5 py-3.5">Resource & Type</th>
                <th className="px-5 py-3.5">Vehicle Unit</th>
                <th className="px-5 py-3.5">Destination Node</th>
                <th className="px-5 py-3.5">Distance / ETA</th>
                <th className="px-5 py-3.5">Lifecycle Status</th>
                <th className="px-5 py-3.5 text-right">Next Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                    Loading Resource Passport records...
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-rose-700">
                    {allocations.length > 0
                      ? "The latest allocation snapshot could not be loaded. Showing the last successfully loaded records."
                      : "Unable to load allocation records. Use refresh to retry."}
                  </td>
                </tr>
              )}
              {!loading && !error && allocations.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    No allocations created yet. Generate and approve a strategy in the Strategy Lab to deploy resources.
                  </td>
                </tr>
              )}
              {allocations.map((alloc) => {
                const medLabel = alloc.medicine_type_code || alloc.medicine_type_name || (alloc.medicine_type_id ? `Type ${alloc.medicine_type_id.substring(0,8)}` : "");
                const isSelected = selectedPassport?.id === alloc.id;

                return (
                  <tr
                    key={alloc.id}
                    onClick={() => void inspectPassport(alloc.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        void inspectPassport(alloc.id);
                      }
                    }}
                    tabIndex={0}
                    aria-label={`Inspect ${alloc.resource_type?.replace("_", " ")} allocation to ${alloc.destination_name || "destination"}`}
                    className={`cursor-pointer transition ${isSelected ? "bg-blue-950/40 hover:bg-blue-950/50 border-l-4 border-l-blue-500" : "hover:bg-slate-700/30"}`}
                  >
                    <td className="px-5 py-4 text-xs font-semibold text-teal-800">
                      <span title={`Passport ID: ${alloc.id}`}>
                        {loadingPassportId === alloc.id ? "Loading passport…" : "View passport"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-white">
                        {alloc.resource_type?.replace("_", " ").toUpperCase()}
                      </div>
                      <div className="text-xs text-slate-400">
                        Qty: <strong>{alloc.quantity}</strong> {medLabel ? `(${medLabel})` : ""}
                      </div>
                      <div className="mt-1 text-[10px] text-slate-500">Strategy proposal</div>
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-300">
                      {alloc.vehicle_name || "N/A"}
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-slate-200 font-medium">{alloc.destination_name || alloc.destination_id?.substring(0, 8)}</div>
                      <div className="text-[11px] text-slate-400 capitalize">{alloc.destination_type || "zone"}</div>
                    </td>
                    <td className="px-5 py-4 text-xs font-mono">
                      <div className="text-slate-300">
                        {typeof alloc.route_distance_km === 'number' ? `${alloc.route_distance_km.toFixed(1)} km` : "--"}
                      </div>
                      <div className="text-amber-400">
                        {typeof alloc.route_travel_min === 'number' ? `ETA: ${Math.round(alloc.route_travel_min)} min` : "--"}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {getStatusBadge(alloc.status)}
                      <div className="mt-1 max-w-40 text-[10px] leading-snug text-slate-600">{getStatusExplanation(alloc.status)}</div>
                    </td>
                    <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      {alloc.status === "approved" && (
                        <button
                          onClick={() => updateStatus(alloc.id, "dispatched")}
                          disabled={updatingId !== null}
                          className="min-h-9 rounded-md border border-blue-700 bg-blue-700 px-3 text-xs font-bold text-white transition hover:bg-blue-800 disabled:opacity-60"
                        >
                          {updatingId === alloc.id ? "Updating…" : "DISPATCH"}
                        </button>
                      )}
                      {alloc.status === "dispatched" && (
                        <button
                          onClick={() => updateStatus(alloc.id, "in_transit")}
                          disabled={updatingId !== null}
                          className="min-h-9 rounded-md border border-orange-700 bg-orange-600 px-3 text-xs font-bold text-white transition hover:bg-orange-700 disabled:opacity-60"
                        >
                          {updatingId === alloc.id ? "Updating…" : "START TRANSIT"}
                        </button>
                      )}
                      {alloc.status === "in_transit" && (
                        <button
                          onClick={() => updateStatus(alloc.id, "delivered")}
                          disabled={updatingId !== null}
                          className="min-h-10 rounded-md border border-green-700 bg-green-700 px-4 text-xs font-extrabold text-white transition hover:bg-green-800 disabled:opacity-60"
                        >
                          {updatingId === alloc.id ? "Updating…" : "DELIVER"}
                        </button>
                      )}
                      {alloc.status === "delivered" && (
                        <button
                          onClick={() => updateStatus(alloc.id, "verified")}
                          disabled={updatingId !== null}
                          className="min-h-9 rounded-md border border-teal-700 bg-teal-700 px-3 text-xs font-bold text-white transition hover:bg-teal-800 disabled:opacity-60"
                        >
                          {updatingId === alloc.id ? "Updating…" : "VERIFY"}
                        </button>
                      )}
                      {alloc.status === "verified" && <span className="text-xs font-extrabold text-green-800">COMPLETED</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resource Passport Inspector Modal / Drawer */}
      {selectedPassport && (
        <div className="bg-slate-800 rounded-xl border border-blue-500/60 p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-700">
            <div className="flex items-center gap-2.5">
              <ShieldCheck size={22} className="text-blue-400" />
              <h2 className="text-lg font-bold text-white">
                Resource Passport: <span className="font-mono text-blue-300">{selectedPassport.id}</span>
              </h2>
            </div>
            <button
              onClick={() => setSelectedPassport(null)}
              type="button"
              title="Close Resource Passport"
              aria-label="Close Resource Passport"
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-700"
            >
              <X size={18} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 space-y-2">
              <h3 className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">Resource & Origin</h3>
              <div>Resource Type: <strong className="text-white">{selectedPassport.resource_type?.toUpperCase()}</strong></div>
              <div>Formulary Code: <strong className="text-teal-300">{selectedPassport.medicine_type_code || selectedPassport.medicine_type_name || "N/A (Standard Unit)"}</strong></div>
              <div>Quantity: <strong className="text-white font-mono">{selectedPassport.quantity} units</strong></div>
              <div>Source Facility: <strong className="text-slate-300">{selectedPassport.source_name || "Central Base"}</strong></div>
              <div>Resource Reference: <strong className="break-all text-slate-300">{selectedPassport.resource_reference_id || selectedPassport.id}</strong></div>
            </div>

            <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 space-y-2">
              <h3 className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">Deployment & Routing</h3>
              <div>Destination: <strong className="text-white">{selectedPassport.destination_name}</strong></div>
              <div>Assigned Vehicle: <strong className="text-slate-300">{selectedPassport.vehicle_name || "N/A"}</strong></div>
              <div>Road Distance: <strong className="text-white font-mono">{typeof selectedPassport.route_distance_km === 'number' ? `${selectedPassport.route_distance_km.toFixed(1)} km` : "N/A"}</strong></div>
              <div>Estimated Travel Time: <strong className="text-amber-300 font-mono">{typeof selectedPassport.route_travel_min === 'number' ? `${Math.round(selectedPassport.route_travel_min)} min` : "N/A"}</strong></div>
            </div>

            <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 space-y-2">
              <h3 className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">Provenance & Audit</h3>
              <div>Strategy Reference: <strong className="text-blue-300 font-mono">{selectedPassport.strategy_id?.substring(0, 12)}</strong></div>
              <div>Scenario / State: <strong className="text-slate-300">{selectedPassport.scenario_id} / v{selectedPassport.state_version}</strong></div>
              <div>Approving Operator: <strong className="text-slate-300">{selectedPassport.approving_operator || "Awaiting approval"}</strong></div>
              <div>Incident Event: <strong className="break-all text-slate-300">{selectedPassport.incident_event_id || "Baseline recommendation"}</strong></div>
              <div>Current Lifecycle Status: {getStatusBadge(selectedPassport.status)}</div>
              <div>Created At: <strong className="text-slate-400 font-mono">{selectedPassport.created_at ? new Date(selectedPassport.created_at).toLocaleString() : "--"}</strong></div>
              <div>Last Mutated: <strong className="text-slate-400 font-mono">{selectedPassport.updated_at ? new Date(selectedPassport.updated_at).toLocaleString() : "--"}</strong></div>
            </div>
          </div>

          {selectedPassport.route_node_ids && selectedPassport.route_node_ids.length > 0 && (
            <div className="bg-slate-900 p-3 rounded-lg border border-slate-700 text-xs">
              <span className="font-semibold text-slate-300">Route Waypoints (Road Nodes): </span>
              <span className="font-mono text-slate-400">{selectedPassport.route_node_ids.join(" → ")}</span>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">Recorded lifecycle</h3>
              <ol className="mt-2 space-y-2 text-xs text-slate-300">
                {(selectedPassport.lifecycle || []).map((transition: any) => (
                  <li key={transition.audit_event_id} className="border-l-2 border-teal-500 pl-2">
                    <strong>{transition.to_status?.replace(/_/g, " ").toUpperCase()}</strong>
                    {" · "}{transition.operator_id}{" · "}{transition.timestamp}
                    <div className="break-all text-[10px] text-slate-500">Audit {transition.audit_event_id}</div>
                  </li>
                ))}
              </ol>
            </section>
            <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">Audit verification</h3>
              <p className="mt-2 text-xs text-slate-300">
                {selectedPassport.audit_chain?.valid
                  ? `Hash chain verified · ${selectedPassport.audit_chain.event_count} events`
                  : "Hash-chain verification failed"}
              </p>
              <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto text-[10px] text-slate-500">
                {(selectedPassport.audit_references || []).map((reference: any) => (
                  <li key={reference.id} className="break-all">
                    {reference.event_type}: {reference.id} · SHA-256 {reference.event_hash?.slice(0, 16)}…
                  </li>
                ))}
              </ul>
              <a href="/audit" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-teal-300 underline">
                Open Audit Trail <ExternalLink size={12} />
              </a>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
