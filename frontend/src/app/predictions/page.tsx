"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/lib/api";
import { useReliefData } from "@/components/ReliefDataContext";
import {
  TrendingUp,
  RefreshCw,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface ForecastOutput {
  resource_type: string;
  medicine_type_id: string | null;
  medicine_type_code: string | null;
  zone_id: string | null;
  zone_name: string | null;
  horizon_min: number;
  current_quantity: number;
  predicted_demand: number;
  projected_supply: number;
  shortage_estimate: number;
  lower_bound: number;
  upper_bound: number;
  confidence: number;
  risk_level: string;
  drivers: string[];
  is_estimate: boolean;
}

interface GroupedForecast {
  key: string;
  resource_type: string;
  medicine_type_code: string | null;
  zone_name: string;
  current_quantity: number;
  t30?: ForecastOutput;
  t60?: ForecastOutput;
  t120?: ForecastOutput;
  max_risk: string;
  drivers: string[];
}

const safeNum = (val: any, digits = 1, fallback = "N/A"): string => {
  if (val === undefined || val === null || isNaN(Number(val))) {
    return fallback;
  }
  return Number(val).toFixed(digits);
};

export default function Predictions() {
  const { twin } = useReliefData();
  const [predictions, setPredictions] = useState<ForecastOutput[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [filterRisk, setFilterRisk] = useState<string>("all");
  const requestRef = useRef<Promise<void> | null>(null);

  const loadData = useCallback(() => {
    if (requestRef.current) return requestRef.current;

    const request = axios.get(`${API_BASE_URL}/v1/predictions`)
      .then((predRes) => {
        setPredictions(predRes.data.forecasts || []);
        setLoadError(null);
      })
      .catch(() => {
        setLoadError("Forecasts could not be loaded. Use refresh to try again.");
      })
      .finally(() => {
        requestRef.current = null;
        setLoading(false);
      });

    requestRef.current = request;
    return request;
  }, []);

  useEffect(() => {
    void loadData();
    const interval = setInterval(loadData, 4000);
    return () => clearInterval(interval);
  }, [loadData]);

  const zoneMap = useMemo(() => new Map((twin?.zones || []).map((z: any) => [z.id, z])), [twin]);

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Group forecasts across T+30, T+60, T+120
  const groupedForecasts: GroupedForecast[] = useMemo(() => {
    const groupMap = new Map<string, GroupedForecast>();
    const list: GroupedForecast[] = [];

    (predictions || []).forEach((p: ForecastOutput) => {
      const locKey = p.zone_id || "system";
      const medKey = p.medicine_type_code || p.medicine_type_id || "";
      const key = `${locKey}_${p.resource_type}_${medKey}`;

      let entry = groupMap.get(key);
      if (!entry) {
        const zoneObj: any = p.zone_id ? zoneMap.get(p.zone_id) : null;
        const resolvedName = p.zone_name || zoneObj?.name || (p.zone_id ? `Zone ${p.zone_id.substring(0, 8)}` : "Central Supply Depot / All Sectors");

        entry = {
          key,
          resource_type: p.resource_type || "resource",
          medicine_type_code: p.medicine_type_code,
          zone_name: resolvedName,
          current_quantity: typeof p.current_quantity === "number" ? p.current_quantity : 0,
          max_risk: "low",
          drivers: []
        };
        groupMap.set(key, entry);
        list.push(entry);
      }

      if (p.horizon_min === 30) entry.t30 = p;
      else if (p.horizon_min === 60) entry.t60 = p;
      else if (p.horizon_min === 120) entry.t120 = p;

      if (typeof p.current_quantity === "number") {
        entry.current_quantity = p.current_quantity;
      }

      const riskRank: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
      const curRank = riskRank[entry.max_risk] || 1;
      const newRank = riskRank[p.risk_level?.toLowerCase()] || 1;
      if (newRank > curRank) {
        entry.max_risk = p.risk_level?.toLowerCase() || entry.max_risk;
      }

      if (p.drivers && Array.isArray(p.drivers)) {
        p.drivers.forEach((d) => {
          if (!entry!.drivers.includes(d)) entry!.drivers.push(d);
        });
      }
    });

    return list;
  }, [predictions, zoneMap]);

  const filteredList = useMemo(() => {
    if (filterRisk === "all") return groupedForecasts;
    return groupedForecasts.filter((g) => g.max_risk === filterRisk);
  }, [groupedForecasts, filterRisk]);

  const getRiskBadge = (risk: string) => {
    switch (risk?.toLowerCase()) {
      case "critical":
        return <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-rose-950 text-rose-300 border border-rose-800 animate-pulse">CRITICAL RISK</span>;
      case "high":
        return <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-amber-950 text-amber-300 border border-amber-800">HIGH RISK</span>;
      case "medium":
        return <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-yellow-950 text-yellow-300 border border-yellow-800">MEDIUM</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-slate-800 text-emerald-400 border border-slate-700">LOW</span>;
    }
  };

  const getHorizonStatus = (forecast?: ForecastOutput) => {
    if (!forecast) return { label: "No estimate available", color: "#6B7280", background: "#F3F4F6" };
    const shortage = Number(forecast.shortage_estimate) || 0;
    const risk = forecast.risk_level?.toLowerCase();
    if (shortage > 0 && risk === "critical") return { label: "Critical shortage likely", color: "#B91C1C", background: "#FEF2F2" };
    if (shortage > 0) return { label: "Shortage likely", color: "#C2410C", background: "#FFF7ED" };
    if (risk === "critical") return { label: "Critical demand", color: "#B91C1C", background: "#FEF2F2" };
    if (risk === "high") return { label: "At risk", color: "#C2410C", background: "#FFF7ED" };
    if (risk === "medium") return { label: "Monitor", color: "#A16207", background: "#FFFBEB" };
    return { label: "Likely covered", color: "#15803D", background: "#F0FDF4" };
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-md bg-orange-50 px-2.5 py-1 text-[10px] font-extrabold tracking-wide text-orange-800"><TrendingUp size={13} /> SIMULATION FORECAST</div>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Predicted Resource Demand</h1>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-600">Deterministic estimate based on current simulated demand and resource availability. It is not a guaranteed real-world prediction.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs">
            <span className="text-slate-500">Priority:</span>
            <select
              value={filterRisk}
              onChange={(e) => setFilterRisk(e.target.value)}
              className="bg-transparent font-semibold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">All Levels ({groupedForecasts.length})</option>
              <option value="critical">Critical Only</option>
              <option value="high">High Only</option>
              <option value="medium">Medium Only</option>
              <option value="low">Low Only</option>
            </select>
          </div>

          <button
            onClick={loadData}
            aria-label="Refresh forecasts"
            className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 border border-slate-600 transition"
            title="Refresh forecasts"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {loadError && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{loadError}</div>}

      <div className="space-y-4">
        {loading && <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500"><RefreshCw className="mr-2 inline animate-spin" size={16} />Loading simulated forecasts…</div>}
        {!loading && filteredList.length === 0 && <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">No forecasts match this priority filter.</div>}
        {filteredList.map((item) => {
          const isExpanded = expandedKeys.has(item.key);
          const horizons = [{ label: "30-minute forecast", data: item.t30 }, { label: "60-minute forecast", data: item.t60 }, { label: "2-hour forecast", data: item.t120 }];
          const unit = item.resource_type.replace(/_/g, " ");
          return (
            <article key={item.key} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{item.zone_name}</div>
                  <h2 className="mt-1 text-lg font-extrabold uppercase text-slate-900">{unit}{item.medicine_type_code ? ` · ${item.medicine_type_code}` : ""}</h2>
                  <p className="mt-1 text-xs text-slate-600">Current supply: <strong className="text-slate-900">{safeNum(item.current_quantity, 0)} {unit}</strong></p>
                </div>
                {getRiskBadge(item.max_risk)}
              </div>

              <div className="grid gap-3 pt-4 md:grid-cols-3">
                {horizons.map(({ label, data }) => {
                  const status = getHorizonStatus(data);
                  return (
                    <section key={label} className="rounded-lg border border-slate-200 p-4">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
                      {data ? <>
                        <div className="mt-2 text-xs text-slate-600">Expected demand</div>
                        <div className="text-xl font-extrabold text-slate-900">~{safeNum(data.predicted_demand, 0)} <span className="text-xs font-semibold">{unit}</span></div>
                        <div className="mt-2 text-xs text-slate-600">Expected shortage</div>
                        <div className="text-sm font-bold" style={{ color: (data.shortage_estimate || 0) > 0 ? status.color : "#15803D" }}>{(data.shortage_estimate || 0) > 0 ? `${safeNum(data.shortage_estimate, 0)} ${unit}` : "None predicted"}</div>
                      </> : <div className="mt-3 text-sm text-slate-500">No estimate available</div>}
                      <div className="mt-3 rounded-md px-2.5 py-2 text-xs font-extrabold" style={{ color: status.color, backgroundColor: status.background }}>{status.label}</div>
                      {data && <details className="mt-2 text-[10px]">
                        <summary className="cursor-pointer font-semibold text-slate-500">Technical details</summary>
                        <div className="mt-2 space-y-1 text-slate-600">
                          <div>Raw estimate: {safeNum(data.predicted_demand, 1)} units</div>
                          <div>Range: {safeNum(data.lower_bound, 1)}–{safeNum(data.upper_bound, 1)}</div>
                          <div>Confidence: {data.confidence ? `${Math.round(data.confidence * 100)}%` : "Not provided"}</div>
                          <div>Risk level: {data.risk_level}</div>
                        </div>
                      </details>}
                    </section>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-slate-700"><strong>Why is this predicted?</strong> {item.drivers[0] || "No additional prediction driver was returned for this resource."}</div>
                <button onClick={() => toggleExpand(item.key)} className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-teal-800 hover:text-teal-950" aria-expanded={isExpanded}>
                  <Info size={13} /> {isExpanded ? "Hide evidence" : "Evidence"} {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {/* Expanded Drivers and Evidence Panel */}
      {Array.from(expandedKeys).map((key) => {
        const item = groupedForecasts.find((g) => g.key === key);
        if (!item) return null;
        return (
          <div key={`exp-${key}`} className="bg-slate-800/90 rounded-xl border border-blue-500/50 p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Info size={16} className="text-blue-400" />
                <h3 className="text-sm font-bold text-white">
                  Prediction Evidence & Drivers: <span className="text-blue-300">{item.zone_name} • {item.resource_type.toUpperCase()}</span>
                </h3>
              </div>
              <button onClick={() => toggleExpand(key)} className="text-xs text-slate-400 hover:text-white">Close ✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <h4 className="font-semibold text-slate-300 mb-1.5 uppercase tracking-wider text-[11px]">Underlying Factors</h4>
                <ul className="space-y-1 text-slate-400">
                  {item.drivers.map((d, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-blue-400">•</span>
                      <span>{d}</span>
                    </li>
                  ))}
                  {item.drivers.length === 0 && <li className="text-slate-500">Baseline historical trend extrapolation.</li>}
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-slate-300 mb-1.5 uppercase tracking-wider text-[11px]">Model Integrity (TR-017)</h4>
                <div className="bg-slate-900 p-3 rounded-lg border border-slate-700 space-y-1 text-slate-300 font-mono text-[11px]">
                  <div>30-minute forecast confidence: <strong>{item.t30?.confidence ? `${Math.round(item.t30.confidence * 100)}%` : "N/A"}</strong></div>
                  <div>60-minute forecast confidence: <strong>{item.t60?.confidence ? `${Math.round(item.t60.confidence * 100)}%` : "N/A"}</strong></div>
                  <div>2-hour forecast confidence: <strong>{item.t120?.confidence ? `${Math.round(item.t120.confidence * 100)}%` : "N/A"}</strong></div>
                  <div className="text-[10px] text-slate-400 font-sans mt-2 pt-1 border-t border-slate-800">
                    Label: <strong>ESTIMATE</strong> (Deterministic Trend + Multiplier). Not fact.
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
