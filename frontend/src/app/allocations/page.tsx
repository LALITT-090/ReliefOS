"use client";

import { useEffect, useState } from "react";
import axios from "axios";
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
  const [allocations, setAllocations] = useState<any[]>([]);
  const [twin, setTwin] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedPassport, setSelectedPassport] = useState<any | null>(null);

  const loadData = async () => {
    try {
      const [allocRes, twinRes] = await Promise.all([
        axios.get("http://localhost:8000/api/v1/allocations"),
        axios.get("http://localhost:8000/api/v1/twin")
      ]);
      setAllocations(allocRes.data.allocations || []);
      setTwin(twinRes.data);
      setLoading(false);
    } catch (err) {
      console.error("Error loading allocations:", err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

  const updateStatus = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    try {
      await axios.patch(`http://localhost:8000/api/v1/allocations/${id}/status`, {
        status: newStatus
      });
      await loadData();
      if (selectedPassport?.id === id) {
        setSelectedPassport((prev: any) => ({ ...prev, status: newStatus }));
      }
    } catch (err: any) {
      console.error("Failed to update allocation status:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "proposed":
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">PROPOSED</span>;
      case "approved":
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-950 text-blue-300 border border-blue-800">APPROVED</span>;
      case "dispatched":
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800">DISPATCHED</span>;
      case "in_transit":
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950 text-amber-300 border border-amber-800 animate-pulse">IN TRANSIT</span>;
      case "delivered":
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">DELIVERED</span>;
      case "verified":
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-950 text-teal-300 border border-teal-800">VERIFIED</span>;
      case "superseded":
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-950 text-rose-300 border border-rose-800">SUPERSEDED</span>;
      case "cancelled":
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-rose-400 border border-slate-700">CANCELLED</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex justify-between items-center bg-slate-800/80 p-5 rounded-xl border border-slate-700">
        <div>
          <h1 className="text-3xl font-bold text-white">Active Allocations & Resource Passport</h1>
          <p className="text-slate-400 text-sm mt-1">
            End-to-end lifecycle tracking: PROPOSED → APPROVED → DISPATCHED → IN TRANSIT → DELIVERED → VERIFIED. Click any record to inspect its cryptographic Resource Passport.
          </p>
        </div>
        <button
          onClick={loadData}
          className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 border border-slate-600"
          title="Refresh allocations"
        >
          <RotateCw size={16} />
        </button>
      </div>
      
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-400 bg-slate-900/90 uppercase border-b border-slate-700">
              <tr>
                <th className="px-5 py-3.5">Passport ID</th>
                <th className="px-5 py-3.5">Resource & Type</th>
                <th className="px-5 py-3.5">Vehicle Unit</th>
                <th className="px-5 py-3.5">Destination Node</th>
                <th className="px-5 py-3.5">Distance / ETA</th>
                <th className="px-5 py-3.5">Lifecycle Status</th>
                <th className="px-5 py-3.5 text-right">Lifecycle Actions</th>
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
              {!loading && allocations.length === 0 && (
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
                    onClick={() => setSelectedPassport(alloc)}
                    className={`cursor-pointer transition ${isSelected ? "bg-blue-950/40 hover:bg-blue-950/50 border-l-4 border-l-blue-500" : "hover:bg-slate-700/30"}`}
                  >
                    <td className="px-5 py-4 font-mono text-xs text-blue-400 font-bold">
                      {alloc.id.substring(0, 8)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-white">
                        {alloc.resource_type?.replace("_", " ").toUpperCase()}
                      </div>
                      <div className="text-xs text-slate-400">
                        Qty: <strong>{alloc.quantity}</strong> {medLabel ? `(${medLabel})` : ""}
                      </div>
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
                    </td>
                    <td className="px-5 py-4 text-right space-x-1.5" onClick={(e) => e.stopPropagation()}>
                      {alloc.status === "approved" && (
                        <button
                          onClick={() => updateStatus(alloc.id, "dispatched")}
                          disabled={updatingId === alloc.id}
                          className="px-2.5 py-1 bg-indigo-900/70 hover:bg-indigo-800 text-indigo-200 text-xs rounded border border-indigo-700 transition"
                        >
                          Dispatch
                        </button>
                      )}
                      {alloc.status === "dispatched" && (
                        <button
                          onClick={() => updateStatus(alloc.id, "in_transit")}
                          disabled={updatingId === alloc.id}
                          className="px-2.5 py-1 bg-amber-900/70 hover:bg-amber-800 text-amber-200 text-xs rounded border border-amber-700 transition"
                        >
                          In Transit
                        </button>
                      )}
                      {alloc.status === "in_transit" && (
                        <button
                          onClick={() => updateStatus(alloc.id, "delivered")}
                          disabled={updatingId === alloc.id}
                          className="px-2.5 py-1 bg-emerald-900/70 hover:bg-emerald-800 text-emerald-200 text-xs rounded border border-emerald-700 transition"
                        >
                          Deliver
                        </button>
                      )}
                      {alloc.status === "delivered" && (
                        <button
                          onClick={() => updateStatus(alloc.id, "verified")}
                          disabled={updatingId === alloc.id}
                          className="px-2.5 py-1 bg-teal-900/70 hover:bg-teal-800 text-teal-200 text-xs rounded border border-teal-700 transition"
                        >
                          Verify
                        </button>
                      )}
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
        </div>
      )}
    </div>
  );
}

