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
import OverviewMapPreview from "@/components/OverviewMapPreview";
import { useReliefData } from "@/components/ReliefDataContext";

export default function Overview() {
  const { twin, allocations, refreshSnapshot, error: snapshotError } = useReliefData();
  const [predictions, setPredictions] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [latestRecommendation, setLatestRecommendation] = useState<any>(null);
  const [supportingDataError, setSupportingDataError] = useState<string | null>(null);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const [, predRes, auditRes] = await Promise.all([
        refreshSnapshot(isManual),
        axios.get(`${API_BASE_URL}/v1/predictions`),
        axios.get(`${API_BASE_URL}/v1/audit`)
      ]);
      setPredictions(predRes.data.forecasts || []);
      setAudit(auditRes.data.events || []);
      setSupportingDataError(null);
      setLastUpdated(new Date());
      setLoading(false);
    } catch (err: any) {
      if (err.response?.status === 404) {
        // Automatically ensure initial scenario is loaded if database was fresh
        try {
          await axios.post(`${API_BASE_URL}/v1/scenarios/00000000-0000-0000-0000-000000000001/load`);
          const [, predRes, auditRes] = await Promise.all([
            refreshSnapshot(true),
            axios.get(`${API_BASE_URL}/v1/predictions`),
            axios.get(`${API_BASE_URL}/v1/audit`),
          ]);
          setPredictions(predRes.data.forecasts || []);
          setAudit(auditRes.data.events || []);
          setLastUpdated(new Date());
        } catch {
          setSupportingDataError("Scenario setup or supporting overview data could not be loaded. Refresh to retry.");
        }
      } else {
        setSupportingDataError("Some overview data could not be loaded. Refresh to retry.");
      }
    } finally {
      setLoading(false);
      if (isManual) setIsRefreshing(false);
    }
  }, [refreshSnapshot]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(false), 2500);
    return () => clearInterval(interval);
  }, [fetchData]);

  const latestStrategyEvent = [...audit].reverse().find((event: any) => event.event_type === "strategy_generated");
  const latestStrategyId = latestStrategyEvent?.entity_id;

  useEffect(() => {
    if (!latestStrategyId) {
      setLatestRecommendation(null);
      setRecommendationError(null);
      return;
    }
    let active = true;
    axios.get(`${API_BASE_URL}/v1/strategies/${latestStrategyId}`)
      .then((res) => { if (active) { setLatestRecommendation(res.data); setRecommendationError(null); } })
      .catch(() => { if (active) setRecommendationError("The latest candidate details could not be loaded. Open Strategy Lab to review candidates."); });
    return () => { active = false; };
  }, [latestStrategyId]);

  if (!twin && snapshotError) {
    return (
      <div className="rounded-xl border border-rose-200 bg-white p-6 text-sm text-rose-700">
        Unable to load Digital Twin. Please ensure the backend is available at {API_BASE_URL}.
      </div>
    );
  }

  if (!twin) {
    return (
      <div className="max-w-7xl space-y-6 pb-12" aria-busy="true" aria-label="Loading emergency command center">
        <div className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white" />)}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="h-72 animate-pulse rounded-xl border border-slate-200 bg-white lg:col-span-2" />
          <div className="h-72 animate-pulse rounded-xl border border-slate-200 bg-white" />
        </div>
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
  const overloadedHospitals = twin.hospitals?.filter((hospital: any) => String(hospital.status).toLowerCase().includes("overload")) || [];

  const activeAllocs = allocations.filter((a: any) => ["approved", "dispatched", "in_transit"].includes(a.status?.toLowerCase())) || [];
  const proposedAllocs = allocations.filter((a: any) => a.status?.toLowerCase() === "proposed") || [];
  const approvedAllocsCount = activeAllocs.filter((a: any) => a.status?.toLowerCase() === "approved").length;
  const inTransitAllocsCount = activeAllocs.filter((a: any) => a.status?.toLowerCase() === "in_transit").length;
  const scenarioTechnicalId = String(twin.scenario?.disaster_type || "active_incident").toUpperCase();
  const scenarioPlainName = scenarioTechnicalId.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
  const activeAllocsCount = activeAllocs.length;

  // Road Network status
  const blockedRoads = twin.road_edges?.filter((e: any) => e.status === "blocked" || e.status === "closed") || [];

  // Zone Map for quick lookup
  const zoneMap = new Map<string, any>((twin.zones || []).map((z: any) => [z.id, z]));
  const medTypeMap = new Map<string, any>((twin.medicine_types || []).map((mt: any) => [mt.id, mt]));

  // Recent Activity & Alerts
  const recentAudit = [...audit].reverse().slice(0, 6);
  const auditSummary = (event: any) => {
    const type = String(event.event_type || "").toLowerCase();
    const payload = event.payload_json || event.payload || {};
    if (type === "road_status_changed") return `Road ${payload.edge_name || "segment"} became ${payload.new_status || "unavailable"}.`;
    if (type === "chaos_event_applied") return Number(payload.impacted_count || 0) > 0
      ? `${payload.impacted_count} active allocation(s) were flagged for review.`
      : "The simulation checked active movements; none were identified as affected.";
    if (type === "strategy_generated") return `A ${String(payload.mode || "strategy").replace(/_/g, " ")} plan was prepared for operator review.`;
    if (type === "strategy_approved") return `${payload.allocations_count ?? "The proposed"} resource placement(s) were approved by an operator.`;
    if (type === "allocation_status_changed") return `Movement status changed from ${payload.old_status || "previous status"} to ${payload.new_status || "updated status"}.`;
    if (type === "hospital_capacity_changed") return `${payload.hospital_name || "Simulated facility"} ICU availability changed from ${payload.old_icu_available ?? "--"} to ${payload.new_icu_available ?? "--"}.`;
    if (type === "scenario_loaded" || type === "scenario_reset") return "The simulation scenario was loaded with synthetic operational values.";
    return type.replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase()) + " recorded.";
  };
  const auditTone = (eventType: string = "") => {
    const type = eventType.toLowerCase();
    if (type.includes("road_status") || type.includes("failure") || type.includes("reject")) return "critical";
    if (type.includes("hospital") || type.includes("demand") || type.includes("medicine")) return "urgent";
    if (type.includes("generated") || type.includes("chaos")) return "moderate";
    return "stable";
  };
  const demoAuditPreview = [
    { time: "10:08", title: "ROAD BLOCK", summary: "Demo: a simulated road segment became unavailable.", tone: "critical" },
    { time: "10:10", title: "PLAN REVIEW", summary: "Demo: a proposed movement is waiting for operator approval.", tone: "moderate" },
    { time: "10:11", title: "OPERATOR APPROVAL", summary: "Demo: an operator approved a candidate plan.", tone: "stable" },
  ];
  const demoDeploymentPreview = [
    { resource: "Ambulance", quantity: "2 units", source: "Central Response Base", destination: "Zone B — Central Market", status: "IN TRANSIT · DEMO", distance: "4.8 km", eta: "12 min" },
    { resource: "IV fluids", quantity: "20 packs", source: "Medical Warehouse", destination: "Zone D — Riverside", status: "APPROVED · DEMO", distance: "3.2 km", eta: "9 min" },
  ];
  const latestStrategyDecision = latestStrategyEvent && audit.find((event: any) =>
    event.entity_id === latestStrategyId && ["strategy_approved", "strategy_rejected"].includes(event.event_type)
  );
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
            <span className="scenario-identity-badge" aria-label={`${scenarioPlainName}. Active simulation scenario`} title={`Scenario type: ${scenarioTechnicalId}`}>
              <strong>{scenarioPlainName}</strong>
              <span>Active simulation scenario</span>
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
            aria-label="Refresh current scenario state"
            className="p-2.5 bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-600 transition"
            title="Refresh current scenario state"
          >
            <RefreshCw size={18} className={isRefreshing ? "animate-spin text-blue-400" : ""} />
          </button>
        </div>
      </div>

      {supportingDataError && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{supportingDataError}</div>}

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
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300" title="Demand items that have not yet been fulfilled">Unmet critical demand</span>
            <AlertTriangle size={18} className={criticalDemandsCount > 0 ? "text-rose-400" : "text-amber-400"} />
          </div>
          <div>
            <div className="text-3xl font-extrabold text-rose-400">
              {criticalDemandsCount} <span className="text-base font-medium text-slate-400">crit</span>
            </div>
            <div className="mt-1 text-xs text-slate-400">
              <span>{unmetDemands.length} items still need resources ({highDemandsCount} high)</span>
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
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Active deployments</span>
            <Activity size={18} className="text-blue-400" />
          </div>
          <div>
            <div className="text-3xl font-extrabold text-blue-400">
              {activeAllocsCount}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {approvedAllocsCount} approved • {inTransitAllocsCount} in transit
            </div>
            {proposedAllocs.length > 0 && <div className="mt-1 text-[11px] font-semibold text-amber-700">{proposedAllocs.length} proposed, awaiting operator decision</div>}
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

      <section className={`rounded-xl border bg-white p-5 shadow-sm ${criticalDemandsCount > 0 || blockedRoads.length > 0 || overloadedHospitals.length > 0 ? "border-rose-200" : "border-slate-200"}`} aria-labelledby="attention-heading">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 id="attention-heading" className="text-sm font-extrabold text-slate-900">Immediate Attention</h2>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Current operational risks</span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {criticalDemandsCount > 0 && <div className="rounded-md border border-rose-200 bg-rose-50 p-3"><div className="text-[10px] font-extrabold uppercase text-rose-800">Critical demand</div><div className="mt-1 text-xs text-rose-900">{criticalDemandsCount} critical demand item(s) remain unmet.</div></div>}
          {blockedRoads.length > 0 && <div className="rounded-md border border-rose-200 bg-rose-50 p-3"><div className="text-[10px] font-extrabold uppercase text-rose-800">Blocked routes</div><div className="mt-1 text-xs text-rose-900">{blockedRoads.length} road segment(s) are blocked.</div></div>}
          {overloadedHospitals.length > 0 && <div className="rounded-md border border-orange-200 bg-orange-50 p-3"><div className="text-[10px] font-extrabold uppercase text-orange-800">Facility overload</div><div className="mt-1 text-xs text-orange-900">{overloadedHospitals.length} simulated facility/facilities report overload.</div></div>}
          {shortMedicines.length > 0 && <div className="rounded-md border border-orange-200 bg-orange-50 p-3"><div className="text-[10px] font-extrabold uppercase text-orange-800">Reserve shortage</div><div className="mt-1 text-xs text-orange-900">{shortMedicines.length} medicine stock item(s) are below reserve.</div></div>}
          {criticalDemandsCount === 0 && blockedRoads.length === 0 && overloadedHospitals.length === 0 && shortMedicines.length === 0 && <div className="text-xs font-semibold text-green-800">No critical demand, blocked road, facility overload, or reserve-stock alert is reported in the current state.</div>}
        </div>
      </section>

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
                  const hasUnmetCriticalDemand = zoneDemands.some((d: any) => d.severity === "critical");
                  const hasForecastShortage = predictionWarnings.some((forecast: any) => forecast.zone_id === z.id && forecast.shortage_estimate > 0);
                  const rawStatus = String(z.status || "active").toLowerCase();
                  const zoneStatus = hasUnmetCriticalDemand
                    ? { label: "CRITICAL", detail: "Unmet critical demand requires immediate attention.", color: "#B91C1C", background: "#FEF2F2" }
                    : hasForecastShortage && zoneDemands.length === 0
                    ? { label: "AT RISK", detail: "Current demand is covered, but a future shortage is predicted.", color: "#C2410C", background: "#FFF7ED" }
                    : zoneDemands.length > 0
                    ? { label: "ACTIVE", detail: "Current resource demand is still unresolved.", color: "#A16207", background: "#FFFBEB" }
                    : ["resolved", "closed", "complete", "completed"].includes(rawStatus)
                    ? { label: "RESOLVED", detail: "The scenario reports this zone as resolved.", color: "#15803D", background: "#F0FDF4" }
                    : { label: rawStatus.toUpperCase(), detail: `Backend scenario status: ${rawStatus}. Review pending demand and forecasts for urgency.`, color: "#4B5563", background: "#F3F4F6" };
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
                      <td className="py-3 px-3">
                        <span title={zoneStatus.detail} className="inline-flex rounded-md border px-2 py-1 text-[10px] font-extrabold tracking-wide" style={{ color: zoneStatus.color, backgroundColor: zoneStatus.background, borderColor: `${zoneStatus.color}40` }}>
                          {zoneStatus.label}
                        </span>
                        <div className="mt-1 max-w-48 text-[10px] text-slate-500">{zoneStatus.detail}</div>
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
                  No critical shortage warnings detected in the current 30-minute and 60-minute forecasts.
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
                const horizon = pw.horizon_min === 30
                  ? "30-minute forecast"
                  : pw.horizon_min === 60
                  ? "60-minute forecast"
                  : pw.horizon_min === 120
                  ? "2-hour forecast"
                  : "60-minute forecast";

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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="order-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-teal-700">Live operational picture</div>
              <h2 className="mt-1 text-lg font-bold text-slate-900">Response Network</h2>
            </div>
            <Link href="/map" className="flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-900">Open full map <ArrowRight size={14} /></Link>
          </div>
          <div className="h-[320px] overflow-hidden rounded-lg border border-slate-200">
            <OverviewMapPreview twin={twin} allocations={allocations} />
          </div>
          <p className="mt-2 text-[10px] text-slate-500">SIMULATION DATA — Facility labels are scenario references; operational values are synthetic and do not imply a real incident.</p>
        </section>

        <section className="order-1 flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-1">
          <div className="flex items-center gap-2 text-teal-700">
            <Activity size={18} />
            <h2 className="text-sm font-bold text-slate-900">Latest Recommendation</h2>
          </div>
          {latestRecommendation ? (
            <>
              <div className="mt-4 rounded-lg border-l-4 border-amber-400 bg-amber-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-extrabold uppercase text-slate-900">{latestRecommendation.strategy?.mode?.replace(/_/g, " ") || "Candidate strategy"}</div>
                  <span className={`rounded px-2 py-1 text-[9px] font-extrabold uppercase ${latestStrategyDecision?.event_type === "strategy_approved" ? "bg-green-100 text-green-800" : latestStrategyDecision?.event_type === "strategy_rejected" ? "bg-rose-100 text-rose-800" : "bg-orange-100 text-orange-900"}`}>
                    {latestStrategyDecision?.event_type === "strategy_approved" ? "Operator approved" : latestStrategyDecision?.event_type === "strategy_rejected" ? "Operator rejected" : "Approval required"}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-700">{latestRecommendation.explanation?.mode_rationale || latestRecommendation.explanation?.recommendation_summary}</p>
                {latestRecommendation.explanation?.estimated_impact && <div className="mt-3 space-y-1 border-t border-amber-200 pt-2 text-[10px] text-slate-700">{Object.entries(latestRecommendation.explanation.estimated_impact).map(([label, value]: [string, any]) => <div key={label} className="flex justify-between gap-2"><span className="capitalize text-slate-500">{label.replace(/_/g, " ")}</span><strong className="text-right">{value}</strong></div>)}</div>}
              </div>
              <p className="mt-3 text-[11px] text-slate-600">Recommendations do not commit resources until an operator approves them.</p>
            </>
          ) : (
            <div className="mt-4 border-l-2 border-slate-300 pl-3">
              <div className="text-xs font-semibold text-slate-800">{recommendationError ? "Recommendation details unavailable" : "No candidate recommendation loaded"}</div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{recommendationError || "Generate and compare strategies against the current state to review evidence-backed options."}</p>
            </div>
          )}
          <Link href="/strategy-lab" className="mt-auto inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-500">
            <Activity size={14} /> Review Strategies
          </Link>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <section className="overview-feed-panel" aria-labelledby="overview-audit-heading">
          <header className="overview-feed-header">
            <div>
              <div className="overview-section-kicker">Response history</div>
              <h2 id="overview-audit-heading" className="overview-section-title"><ShieldCheck size={19} /> Cryptographic Audit Feed</h2>
              <p className="overview-section-subtitle">What changed and who made the decision</p>
            </div>
            <Link href="/audit" className="overview-secondary-link">Full timeline <ArrowRight size={14} /></Link>
          </header>
          <div className="overview-live-label"><span className="overview-live-dot" /> Simulation records · synthetic operational scenario</div>

          {recentAudit.length > 0 ? (
            <div className="overview-audit-list">
              {recentAudit.map((event: any, index: number) => (
                <article key={event.id || index} className="overview-audit-row">
                  <span className={`overview-audit-marker tone-${auditTone(event.event_type)}`} aria-hidden="true" />
                  <div className="overview-audit-content">
                    <div className="overview-audit-topline">
                      <h3>{String(event.event_type || "event").replace(/_/g, " ")}</h3>
                      <time dateTime={event.timestamp}>{event.timestamp ? new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--"}</time>
                    </div>
                    <p>{auditSummary(event)}</p>
                    <div className="overview-audit-meta">Recorded by {event.actor || event.actor_id || "System"}</div>
                    <details className="overview-technical-details">
                      <summary>Technical record</summary>
                      <div className="overview-technical-grid">
                        <span>Event ID</span><code>{event.id || "Unavailable"}</code>
                        <span>Entity</span><code>{event.entity_type || "--"}: {event.entity_id || "--"}</code>
                        <span>SHA-256</span><code>{event.event_hash || event.hash || "Unavailable"}</code>
                        <span>Previous hash</span><code>{event.previous_hash || "Unavailable"}</code>
                      </div>
                    </details>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="overview-empty-message">No live audit entries have been recorded in this scenario yet.</p>
          )}

          {recentAudit.length < 3 && (
            <div className="overview-demo-preview">
              <div className="overview-demo-heading">DEMO PREVIEW · SYNTHETIC · NOT LIVE</div>
              {demoAuditPreview.slice(0, 3 - recentAudit.length).map((event) => (
                <div className="overview-demo-row" key={event.title}>
                  <time>{event.time}</time>
                  <span className={`overview-audit-marker tone-${event.tone}`} aria-hidden="true" />
                  <div><strong>{event.title}</strong><p>{event.summary}</p></div>
                </div>
              ))}
              <p className="overview-demo-disclaimer">Illustrative response sequence only. These examples are not stored audit events and have no cryptographic record.</p>
            </div>
          )}
        </section>

        <section className="overview-feed-panel" aria-labelledby="overview-deployments-heading">
          <header className="overview-feed-header">
            <div>
              <div className="overview-section-kicker">Operator-approved movements</div>
              <h2 id="overview-deployments-heading" className="overview-section-title"><Radio size={19} /> Active Deployments & Fast Actions</h2>
              <p className="overview-section-subtitle">Approved resources, destinations, and current lifecycle</p>
            </div>
            <Link href="/allocations" className="overview-secondary-link">Resource Passports <ArrowRight size={14} /></Link>
          </header>
          <div className="overview-live-label"><span className="overview-live-dot" /> Live scenario data · simulated operations</div>

          {activeAllocs.length > 0 ? (
            <div className="overview-deployment-list">
              {activeAllocs.slice(0, 5).map((allocation: any) => (
                <article className="overview-deployment-row" key={allocation.id}>
                  <div className="overview-deployment-main">
                    <div>
                      <h3>{allocation.resource_type?.replace(/_/g, " ")} <span>×{allocation.quantity}</span></h3>
                      <p>{allocation.source_name || "Resource source"} <ArrowRight size={13} /> {allocation.destination_name || "Assigned destination"}</p>
                    </div>
                    <span className={`overview-deployment-status status-${allocation.status?.toLowerCase()}`}>{allocation.status?.replace(/_/g, " ")}</span>
                  </div>
                  <div className="overview-deployment-facts">
                    <span><strong>{typeof allocation.route_distance_km === "number" ? `${allocation.route_distance_km.toFixed(1)} km` : "Route length unavailable"}</strong><small>route distance</small></span>
                    <span><strong>{typeof allocation.route_travel_min === "number" ? `${Math.round(allocation.route_travel_min)} min` : "ETA unavailable"}</strong><small>estimated travel</small></span>
                    {allocation.vehicle_name && <span><strong>{allocation.vehicle_name}</strong><small>assigned vehicle</small></span>}
                  </div>
                  <details className="overview-technical-details">
                    <summary>Strategy reference</summary>
                    <div className="overview-technical-grid"><span>Strategy ID</span><code>{allocation.strategy_id || "Unavailable"}</code><span>Resource ID</span><code>{allocation.id}</code></div>
                  </details>
                </article>
              ))}
              {activeAllocs.length > 5 && <Link href="/allocations" className="overview-secondary-link">View all {activeAllocs.length} approved/in-progress movements <ArrowRight size={14} /></Link>}
            </div>
          ) : (
            <div className="overview-empty-message">
              <strong>No approved deployments are currently in progress.</strong>
              <span>Generated placements remain proposals until an operator approves a strategy.</span>
            </div>
          )}

          {proposedAllocs.length > 0 && <div className="overview-proposal-notice"><strong>{proposedAllocs.length} proposed resource placement(s)</strong><span>Not dispatched · operator review and approval required</span></div>}

          {activeAllocs.length === 0 && (
            <div className="overview-demo-preview overview-deployment-demo">
              <div className="overview-demo-heading">DEMO PREVIEW · SYNTHETIC · NOT LIVE</div>
              {demoDeploymentPreview.map((item) => (
                <div className="overview-demo-deployment" key={item.resource}>
                  <div className="overview-demo-deployment-top"><strong>{item.resource} · {item.quantity}</strong><span>{item.status}</span></div>
                  <div className="overview-demo-route">{item.source} <ArrowRight size={12} /> {item.destination}</div>
                  <div className="overview-demo-facts">{item.distance} route · {item.eta} estimated travel</div>
                </div>
              ))}
              <p className="overview-demo-disclaimer">Examples for demonstration only. They are not live dispatches, are excluded from counts, and have no active lifecycle controls.</p>
            </div>
          )}

          <div className="overview-action-row">
            <Link href="/strategy-lab" className="overview-primary-action"><Activity size={16} />{proposedAllocs.length > 0 ? "Review proposed plans" : "Generate response plan"}</Link>
            <Link href="/simulation" className="overview-danger-action"><AlertOctagon size={15} />Open simulation</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
