"use client";

import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/lib/api";
import {
  Activity,
  AlertTriangle,
  ShieldCheck,
  Truck,
  Bed,
  Users,
  Package,
  AlertOctagon,
  RefreshCw,
  Clock,
  ArrowRight,
  TrendingUp,
  Radio,
  MapPin,
  CheckCircle2,
  XCircle,
  RotateCcw
} from "lucide-react";
import Link from "next/link";

export default function Overview() {
  const [twin, setTwin] = useState<any>(null);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const [twinRes, allocRes, predRes, auditRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/v1/twin`),
        axios.get(`${API_BASE_URL}/v1/allocations`),
        axios.get(`${API_BASE_URL}/v1/predictions`),
        axios.get(`${API_BASE_URL}/v1/audit`)
      ]);
      setTwin(twinRes.data);
      setAllocations(allocRes.data.allocations || []);
      setPredictions(predRes.data.forecasts || []);
      setAudit(auditRes.data.events || []);
      setLastUpdated(new Date());
      setLoading(false);
    } catch (err: any) {
      if (err.response?.status === 404) {
        // Automatically ensure initial scenario is loaded if database was fresh
        try {
          await axios.post(`${API_BASE_URL}/v1/scenarios/00000000-0000-0000-0000-000000000001/load`);
          const retryRes = await axios.get(`${API_BASE_URL}/v1/twin`);
          setTwin(retryRes.data);
          setLoading(false);
        } catch (innerErr) {
          console.error("Failed to load scenario on 404:", innerErr);
        }
      }
      console.error("API error in Overview:", err);
    } finally {
      if (isManual) setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(false), 2500);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading && !twin) {
    return (
      <div className="flex h-96 flex-col items-center justify-center space-y-4 text-slate-400">
        <RefreshCw className="animate-spin text-blue-500" size={36} />
        <span className="text-lg font-medium">Connecting to Digital Twin Engine...</span>
      </div>
    );
  }

  if (!twin) {
    return (
      <div className="p-8 text-center text-red-400 bg-red-950/20 border border-red-800 rounded-lg">
        Unable to load Digital Twin. Please ensure the backend is running at {API_BASE_URL}.
      </div>
    );
  }

  // --- Compute Live Metrics directly from authoritative Digital Twin ---
  const totalAmbulances = twin.ambulances?.length || 0;
  const availableAmbulances = twin.ambulances?.filter((a: any) => a.availability_status === "available").length || 0;
  const inTransitAmbulances = twin.ambulances?.filter((a: any) => a.availability_status === "in_transit").length || 0;
  const unavailableAmbulances = totalAmbulances - availableAmbulances - inTransitAmbulances;

  const totalIcu = twin.hospitals?.reduce((acc: number, h: any) => acc + (h.icu_total || 0), 0) || 0;
  const availableIcu = twin.hospitals?.reduce((acc: number, h: any) => acc + (h.icu_available || 0), 0) || 0;
  const occupiedIcu = Math.max(0, totalIcu - availableIcu);
  const icuOccupancyPct = totalIcu > 0 ? Math.round((occupiedIcu / totalIcu) * 100) : 0;

  const affectedPopulation = twin.zones?.reduce((acc: number, z: any) => acc + (z.affected_population || 0), 0) || 0;
  const totalZones = twin.zones?.length || 0;
  const criticalZones = twin.zones?.filter((z: any) => z.severity === "critical").length || 0;
  const highRiskZones = twin.zones?.filter((z: any) => z.severity === "high").length || 0;

  const totalDemandsCount = twin.demands?.length || 0;
  const unmetDemands = twin.demands?.filter((d: any) => d.status !== "met") || [];
  const criticalDemandsCount = unmetDemands.filter((d: any) => d.severity === "critical").length;
  const highDemandsCount = unmetDemands.filter((d: any) => d.severity === "high").length;

  const totalMedicineStock = twin.medicine_inventory?.reduce((acc: number, m: any) => acc + (m.quantity_available || 0), 0) || 0;
  const shortMedicines = twin.medicine_inventory?.filter((m: any) => (m.quantity_available || 0) < (m.reserve_quantity || 0)) || [];

  const activeAllocs = allocations.filter((a: any) => ["proposed", "approved", "in_transit", "dispatched"].includes(a.status?.toLowerCase())) || [];
  const activeAllocsCount = activeAllocs.length;

  // Road Network status
  const blockedRoads = twin.road_edges?.filter((e: any) => e.status === "blocked" || e.status === "closed") || [];

  // Zone Map for quick lookup
  const zoneMap = new Map<string, any>((twin.zones || []).map((z: any) => [z.id, z]));
  const medTypeMap = new Map<string, any>((twin.medicine_types || []).map((mt: any) => [mt.id, mt]));

  // Recent Activity & Alerts
  const recentAudit = [...audit].reverse().slice(0, 6);
  const predictionWarnings = (predictions || []).filter(
    (p: any) =>
      p.risk_level === "critical" ||
      p.risk_level === "high" ||
      (typeof p.shortage_estimate === "number" && p.shortage_estimate > 0)
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-800/80 p-5 rounded-xl border border-slate-700 backdrop-blur">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-white">Emergency Command Center</h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-900/60 text-blue-300 border border-blue-700">
              {twin.scenario?.disaster_type?.toUpperCase() || "ACTIVE INCIDENT"}
            </span>
          </div>
          <p className="text-sm text-slate-400 flex items-center gap-2">
            <span>Scenario: <strong className="text-slate-200">{twin.scenario?.name}</strong></span>
            <span>•</span>
            <span>Road Graph: <strong className="text-slate-200">{twin.road_nodes?.length || 0} nodes / {twin.road_edges?.length || 0} edges</strong></span>
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Digital Twin State</div>
            <div className="text-xl font-mono font-bold text-blue-400 flex items-center justify-end gap-1.5">
              <span>v{twin.state_version}</span>
            </div>
            <div className="text-[11px] text-slate-500 flex items-center justify-end gap-1">
              <Clock size={11} /> {lastUpdated.toLocaleTimeString()}
            </div>
          </div>
          <button
            onClick={() => fetchData(true)}
            disabled={isRefreshing}
            className="p-2.5 bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-600 transition"
            title="Force refresh state snapshot"
          >
            <RefreshCw size={18} className={isRefreshing ? "animate-spin text-blue-400" : ""} />
          </button>
        </div>
      </div>

      {/* Primary KPI Grid (8 Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Available Ambulances */}
        <div className="bg-slate-800/90 p-4 rounded-xl border border-slate-700/80 flex flex-col justify-between hover:border-slate-600 transition">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Ambulances</span>
            <Truck size={18} className={availableAmbulances > 0 ? "text-emerald-400" : "text-rose-400"} />
          </div>
          <div>
            <div className="text-3xl font-extrabold text-white">
              {availableAmbulances} <span className="text-base font-medium text-slate-400">/ {totalAmbulances}</span>
            </div>
            <div className="mt-1 text-xs text-slate-400 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>{availableAmbulances} ready</span>
              {inTransitAmbulances > 0 && <span className="text-blue-400">• {inTransitAmbulances} active</span>}
              {unavailableAmbulances > 0 && <span className="text-rose-400">• {unavailableAmbulances} offline</span>}
            </div>
          </div>
        </div>

        {/* ICU Beds */}
        <div className="bg-slate-800/90 p-4 rounded-xl border border-slate-700/80 flex flex-col justify-between hover:border-slate-600 transition">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">ICU Capacity</span>
            <Bed size={18} className={availableIcu > 5 ? "text-emerald-400" : "text-amber-400"} />
          </div>
          <div>
            <div className="text-3xl font-extrabold text-white">
              {availableIcu} <span className="text-base font-medium text-slate-400">/ {totalIcu}</span>
            </div>
            <div className="mt-1 text-xs text-slate-400 flex items-center justify-between">
              <span>{occupiedIcu} occupied</span>
              <span className={`font-semibold ${icuOccupancyPct > 80 ? "text-rose-400" : "text-slate-300"}`}>
                {icuOccupancyPct}% load
              </span>
            </div>
          </div>
        </div>

        {/* Unmet Critical Demand */}
        <div className="bg-slate-800/90 p-4 rounded-xl border border-slate-700/80 flex flex-col justify-between hover:border-slate-600 transition">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Unmet Demands</span>
            <AlertTriangle size={18} className={criticalDemandsCount > 0 ? "text-rose-400" : "text-amber-400"} />
          </div>
          <div>
            <div className="text-3xl font-extrabold text-rose-400">
              {criticalDemandsCount} <span className="text-base font-medium text-slate-400">crit</span>
            </div>
            <div className="mt-1 text-xs text-slate-400">
              <span>{unmetDemands.length} total pending ({highDemandsCount} high)</span>
            </div>
          </div>
        </div>

        {/* Affected Population & Zones */}
        <div className="bg-slate-800/90 p-4 rounded-xl border border-slate-700/80 flex flex-col justify-between hover:border-slate-600 transition">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Population at Risk</span>
            <Users size={18} className="text-indigo-400" />
          </div>
          <div>
            <div className="text-3xl font-extrabold text-white">
              {affectedPopulation.toLocaleString()}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              Across <strong className="text-slate-200">{totalZones} zones</strong> ({criticalZones} critical)
            </div>
          </div>
        </div>

        {/* Total Medicine Inventory */}
        <div className="bg-slate-800/90 p-4 rounded-xl border border-slate-700/80 flex flex-col justify-between hover:border-slate-600 transition">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Medicine Stock</span>
            <Package size={18} className="text-teal-400" />
          </div>
          <div>
            <div className="text-3xl font-extrabold text-white">
              {totalMedicineStock.toLocaleString()}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              Units across {twin.medicine_types?.length || 0} typed formulary classes
            </div>
          </div>
        </div>

        {/* Medicine Shortages */}
        <div className={`p-4 rounded-xl border flex flex-col justify-between transition ${shortMedicines.length > 0 ? "bg-rose-950/30 border-rose-800/80" : "bg-slate-800/90 border-slate-700/80"}`}>
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Stock Alerts</span>
            <AlertOctagon size={18} className={shortMedicines.length > 0 ? "text-rose-400 animate-pulse" : "text-emerald-400"} />
          </div>
          <div>
            <div className={`text-3xl font-extrabold ${shortMedicines.length > 0 ? "text-rose-400" : "text-emerald-400"}`}>
              {shortMedicines.length}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {shortMedicines.length > 0 ? "Items below mandatory reserve" : "All inventories above reserve"}
            </div>
          </div>
        </div>

        {/* Active Allocations */}
        <div className="bg-slate-800/90 p-4 rounded-xl border border-slate-700/80 flex flex-col justify-between hover:border-slate-600 transition">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Active Allocations</span>
            <Activity size={18} className="text-blue-400" />
          </div>
          <div>
            <div className="text-3xl font-extrabold text-blue-400">
              {activeAllocsCount}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {allocations.filter((a: any) => a.status === "approved").length} approved • {allocations.filter((a: any) => a.status === "in_transit").length} in transit
            </div>
          </div>
        </div>

        {/* Road & State Integrity */}
        <div className="bg-slate-800/90 p-4 rounded-xl border border-slate-700/80 flex flex-col justify-between hover:border-slate-600 transition">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Network & Audit</span>
            <ShieldCheck size={18} className="text-emerald-400" />
          </div>
          <div>
            <div className="text-3xl font-extrabold text-emerald-400">
              {blockedRoads.length === 0 ? "CLEAR" : `${blockedRoads.length} BLOCKED`}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {blockedRoads.length > 0 ? `${blockedRoads.length} road segment(s) closed` : "All road graph edges open"}
            </div>
          </div>
        </div>
      </div>

      {/* Middle Section: Zone Demand Matrix & Shortage Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Zone Status Table (2 cols) */}
        <div className="lg:col-span-2 bg-slate-800/80 rounded-xl border border-slate-700 p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-700">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <MapPin size={18} className="text-blue-400" /> Affected Zones & Urgency
            </h2>
            <Link href="/map" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
              Open Situation Map <ArrowRight size={13} />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-400 uppercase bg-slate-900/60">
                <tr>
                  <th className="py-2.5 px-3 rounded-l">Zone</th>
                  <th className="py-2.5 px-3">Severity</th>
                  <th className="py-2.5 px-3">Population</th>
                  <th className="py-2.5 px-3">Pending Demands</th>
                  <th className="py-2.5 px-3 rounded-r">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {twin.zones?.map((z: any) => {
                  const zoneDemands = unmetDemands.filter((d: any) => d.zone_id === z.id);
                  const isCrit = z.severity === "critical";
                  const isHigh = z.severity === "high";
                  return (
                    <tr key={z.id} className="hover:bg-slate-700/30 transition">
                      <td className="py-3 px-3 font-semibold text-white">
                        {z.name}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                          isCrit ? "bg-rose-950 text-rose-300 border border-rose-800" :
                          isHigh ? "bg-amber-950 text-amber-300 border border-amber-800" :
                          "bg-slate-700 text-slate-300"
                        }`}>
                          {z.severity?.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-300">
                        {z.affected_population?.toLocaleString()}
                      </td>
                      <td className="py-3 px-3">
                        {zoneDemands.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {zoneDemands.map((d: any, idx: number) => (
                              <span key={idx} className="text-[11px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-700">
                                {d.resource_type === "medicine"
                                  ? `${medTypeMap.get(d.medicine_type_id)?.code || "MED"} x${d.quantity}`
                                  : `${d.resource_type?.replace("_", " ")} x${d.quantity}`}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 size={13} /> Demands Met
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-400 capitalize">
                        {z.status || "active"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Prediction & Shortage Warnings (1 col) */}
        <div className="bg-slate-800/80 rounded-xl border border-slate-700 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-700">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <TrendingUp size={18} className="text-amber-400" /> Predicted Shortages
              </h2>
              <Link href="/predictions" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                Details <ArrowRight size={13} />
              </Link>
            </div>

            <div className="space-y-3 overflow-y-auto max-h-80 pr-1">
              {predictionWarnings.length === 0 && shortMedicines.length === 0 && (
                <div className="p-4 text-center text-sm text-slate-500 bg-slate-900/40 rounded-lg border border-slate-800">
                  No critical shortage warnings detected in current T+30/60 horizon.
                </div>
              )}

              {/* Medicine stock warnings */}
              {shortMedicines.map((m: any, idx: number) => (
                <div key={`sm-${idx}`} className="p-3 bg-rose-950/30 border border-rose-800/60 rounded-lg text-xs">
                  <div className="flex justify-between font-bold text-rose-300 mb-1">
                    <span>Low Stock: {m.medicine_type_code || `Type ${m.medicine_type_id}`}</span>
                    <span className="text-rose-400 font-mono">{m.quantity_available} / {m.reserve_quantity} res</span>
                  </div>
                  <div className="text-slate-400">
                    Source inventory depleted below mandatory emergency reserve threshold.
                  </div>
                </div>
              ))}

              {/* Demand spike predictions */}
              {predictionWarnings.slice(0, 4).map((pw: any, idx: number) => {
                const zName = pw.zone_name || (pw.zone_id ? zoneMap.get(pw.zone_id)?.name : "All Sectors / Central Depot") || "System-wide";
                const demandVal = typeof pw.predicted_demand === "number" ? pw.predicted_demand.toFixed(1) : "N/A";
                const baseVal = typeof pw.current_quantity === "number" ? pw.current_quantity.toFixed(1) : "N/A";
                const shortageVal = typeof pw.shortage_estimate === "number" && pw.shortage_estimate > 0 ? ` (Shortage: -${pw.shortage_estimate.toFixed(1)})` : "";
                const horizon = pw.horizon_min ? `T+${pw.horizon_min}` : "T+60";

                return (
                  <div key={`pw-${idx}`} className="p-3 bg-amber-950/30 border border-amber-800/60 rounded-lg text-xs">
                    <div className="flex justify-between font-bold text-amber-300 mb-1">
                      <span>{zName} • {pw.resource_type?.replace("_", " ").toUpperCase()}{pw.medicine_type_code ? ` (${pw.medicine_type_code})` : ""}</span>
                      <span className="text-amber-400 font-mono">{horizon}: {demandVal} req</span>
                    </div>
                    <div className="text-slate-400">
                      Demand projected from base {baseVal} to {demandVal} units at {horizon}{shortageVal}.
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-700/80">
            <Link
              href="/strategy-lab"
              className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition"
            >
              <Activity size={14} /> Run Optimizer & Compare Strategies
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom Section: Recent Audit Log & Active Allocations Feed */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Audit Feed */}
        <div className="bg-slate-800/80 rounded-xl border border-slate-700 p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-700">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldCheck size={18} className="text-emerald-400" /> Cryptographic Audit Feed
            </h2>
            <Link href="/audit" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
              Full Audit Timeline <ArrowRight size={13} />
            </Link>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-72 pr-1">
            {recentAudit.length === 0 && (
              <div className="text-xs text-slate-500 text-center py-6">No audit records yet.</div>
            )}
            {recentAudit.map((ev: any, idx: number) => (
              <div key={idx} className="p-3 bg-slate-900/80 rounded-lg border border-slate-700/80 text-xs">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-bold text-blue-300">{ev.event_type?.replace(/_/g, " ")}</span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : "--"}
                  </span>
                </div>
                <div className="text-slate-400 text-[11px] flex items-center justify-between">
                  <span>Actor: <strong className="text-slate-300">{ev.actor || ev.actor_id}</strong></span>
                  <span className="font-mono text-[10px] text-slate-500 truncate max-w-[150px]">
                    Hash: {(ev.event_hash || ev.hash)?.substring(0, 16)}...
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Active Deployment Summary & Chaos Simulator Shortcut */}
        <div className="bg-slate-800/80 rounded-xl border border-slate-700 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-700">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Radio size={18} className="text-blue-400" /> Active Deployments & Fast Actions
              </h2>
              <Link href="/allocations" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                Resource Passport <ArrowRight size={13} />
              </Link>
            </div>

            {activeAllocs.length > 0 ? (
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {activeAllocs.slice(0, 5).map((a: any, idx: number) => (
                  <div key={idx} className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-700 text-xs flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-200">
                        {a.resource_type?.toUpperCase()} (x{a.quantity})
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Route: {a.route_distance_km ? `${a.route_distance_km.toFixed(1)} km` : "N/A"} • ETA: {a.route_travel_min ? `${Math.round(a.route_travel_min)} min` : "N/A"}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase bg-emerald-950 text-emerald-300 border border-emerald-800">
                      {a.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-slate-400 bg-slate-900/40 rounded-lg border border-slate-800">
                <p className="mb-2">No active resource deployments currently running.</p>
                <p className="text-slate-500">Go to Strategy Lab to optimize resource allocation and approve plans.</p>
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-700 flex gap-3">
            <Link
              href="/simulation"
              className="flex-1 py-2 px-3 bg-red-950/60 hover:bg-red-900/80 border border-red-800 text-red-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition"
            >
              <AlertOctagon size={14} /> Chaos Sandbox
            </Link>
            <Link
              href="/strategy-lab"
              className="flex-1 py-2 px-3 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition"
            >
              <Activity size={14} /> Strategy Lab
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
