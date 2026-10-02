"use client";

import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/lib/api";
import {
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  Clock,
  RefreshCw,
  Info,
  ChevronDown,
  ChevronUp,
  AlertOctagon,
  CheckCircle2
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
  const [predictions, setPredictions] = useState<ForecastOutput[]>([]);
  const [twin, setTwin] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [filterRisk, setFilterRisk] = useState<string>("all");

  const loadData = async () => {
    try {
      const [predRes, twinRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/v1/predictions`),
        axios.get(`${API_BASE_URL}/v1/twin`)
      ]);
      setPredictions(predRes.data.forecasts || []);
      setTwin(twinRes.data);
      setLoading(false);
    } catch (err) {
      console.error("Failed to load predictions:", err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 4000);
    return () => clearInterval(interval);
  }, []);

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

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-800/80 p-5 rounded-xl border border-slate-700">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="text-blue-400" size={24} />
            <h1 className="text-2xl font-bold text-white">Future Shortage Forecasting Engine</h1>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Deterministic prediction based on measured demand, severity multipliers, and consumption rates across <strong>T+30</strong>, <strong>T+60</strong>, and <strong>T+120</strong> horizons.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700 text-xs">
            <span className="text-slate-400">Risk Filter:</span>
            <select
              value={filterRisk}
              onChange={(e) => setFilterRisk(e.target.value)}
              className="bg-transparent text-slate-200 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-800 text-white">All Levels ({groupedForecasts.length})</option>
              <option value="critical" className="bg-slate-800 text-rose-300">Critical Only</option>
              <option value="high" className="bg-slate-800 text-amber-300">High Only</option>
              <option value="medium" className="bg-slate-800 text-yellow-300">Medium Only</option>
              <option value="low" className="bg-slate-800 text-emerald-300">Low Only</option>
            </select>
          </div>

          <button
            onClick={loadData}
            className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 border border-slate-600 transition"
            title="Refresh predictions"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Prediction Matrix Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-400 bg-slate-900/90 uppercase border-b border-slate-700">
              <tr>
                <th className="px-5 py-3.5">Zone / Target Location</th>
                <th className="px-5 py-3.5">Resource Class</th>
                <th className="px-5 py-3.5">Measured Base</th>
                <th className="px-5 py-3.5 text-amber-300">T+30 min (Demand / Shortage)</th>
                <th className="px-5 py-3.5 text-orange-400">T+60 min (Demand / Shortage)</th>
                <th className="px-5 py-3.5 text-rose-400">T+120 min (Demand / Shortage)</th>
                <th className="px-5 py-3.5">Overall Risk</th>
                <th className="px-5 py-3.5 text-right">Evidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {loading && (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-slate-400">
                    <RefreshCw className="animate-spin inline-block mr-2" size={16} />
                    Calculating deterministic forecast vectors...
                  </td>
                </tr>
              )}

              {!loading && filteredList.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    No forecast vectors match the selected filter.
                  </td>
                </tr>
              )}

              {filteredList.map((item) => {
                const isExpanded = expandedKeys.has(item.key);
                const hasCriticalShortage = (item.t120?.shortage_estimate || 0) > 0 || item.max_risk === "critical";

                return (
                  <tr
                    key={item.key}
                    className={`transition ${
                      hasCriticalShortage ? "bg-rose-950/15 hover:bg-rose-950/25" : "hover:bg-slate-700/30"
                    }`}
                  >
                    {/* Zone */}
                    <td className="px-5 py-4 font-semibold text-white">
                      <div>{item.zone_name}</div>
                    </td>

                    {/* Resource */}
                    <td className="px-5 py-4">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-900 text-slate-300 border border-slate-700">
                        {item.resource_type.toUpperCase()}
                        {item.medicine_type_code ? ` (${item.medicine_type_code})` : ""}
                      </span>
                    </td>

                    {/* Measured Base */}
                    <td className="px-5 py-4 font-mono text-slate-300">
                      {safeNum(item.current_quantity, 1)} units
                    </td>

                    {/* T+30 min */}
                    <td className="px-5 py-4 font-mono text-xs">
                      {item.t30 ? (
                        <div>
                          <span className="text-amber-300 font-bold">{safeNum(item.t30.predicted_demand, 1)} req</span>
                          {(item.t30.shortage_estimate || 0) > 0 ? (
                            <span className="ml-2 text-rose-400 font-bold bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-800">
                              -{safeNum(item.t30.shortage_estimate, 1)}
                            </span>
                          ) : (
                            <span className="ml-2 text-emerald-400 text-[11px] font-sans">covered</span>
                          )}
                          <div className="text-[10px] text-slate-500 font-sans">
                            CI: [{safeNum(item.t30.lower_bound, 1)}–{safeNum(item.t30.upper_bound, 1)}]
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-500">Unavailable</span>
                      )}
                    </td>

                    {/* T+60 min */}
                    <td className="px-5 py-4 font-mono text-xs">
                      {item.t60 ? (
                        <div>
                          <span className="text-orange-400 font-bold">{safeNum(item.t60.predicted_demand, 1)} req</span>
                          {(item.t60.shortage_estimate || 0) > 0 ? (
                            <span className="ml-2 text-rose-400 font-bold bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-800">
                              -{safeNum(item.t60.shortage_estimate, 1)}
                            </span>
                          ) : (
                            <span className="ml-2 text-emerald-400 text-[11px] font-sans">covered</span>
                          )}
                          <div className="text-[10px] text-slate-500 font-sans">
                            CI: [{safeNum(item.t60.lower_bound, 1)}–{safeNum(item.t60.upper_bound, 1)}]
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-500">Unavailable</span>
                      )}
                    </td>

                    {/* T+120 min */}
                    <td className="px-5 py-4 font-mono text-xs">
                      {item.t120 ? (
                        <div>
                          <span className="text-rose-400 font-bold">{safeNum(item.t120.predicted_demand, 1)} req</span>
                          {(item.t120.shortage_estimate || 0) > 0 ? (
                            <span className="ml-2 text-rose-300 font-bold bg-rose-900 px-1.5 py-0.5 rounded border border-rose-700">
                              -{safeNum(item.t120.shortage_estimate, 1)}
                            </span>
                          ) : (
                            <span className="ml-2 text-emerald-400 text-[11px] font-sans">covered</span>
                          )}
                          <div className="text-[10px] text-slate-500 font-sans">
                            CI: [{safeNum(item.t120.lower_bound, 1)}–{safeNum(item.t120.upper_bound, 1)}]
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-500">Unavailable</span>
                      )}
                    </td>

                    {/* Risk Badge */}
                    <td className="px-5 py-4">
                      {getRiskBadge(item.max_risk)}
                    </td>

                    {/* Evidence Toggle */}
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => toggleExpand(item.key)}
                        className="px-2.5 py-1 text-xs text-blue-400 hover:text-blue-300 bg-slate-900 rounded border border-slate-700 hover:border-slate-500 inline-flex items-center gap-1 transition"
                      >
                        <Info size={13} />
                        <span>Evidence</span>
                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
                  <div>T+30 Confidence: <strong>{item.t30?.confidence ? `${Math.round(item.t30.confidence * 100)}%` : "N/A"}</strong></div>
                  <div>T+60 Confidence: <strong>{item.t60?.confidence ? `${Math.round(item.t60.confidence * 100)}%` : "N/A"}</strong></div>
                  <div>T+120 Confidence: <strong>{item.t120?.confidence ? `${Math.round(item.t120.confidence * 100)}%` : "N/A"}</strong></div>
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
