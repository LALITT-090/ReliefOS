"use client";

import { useState } from "react";
import axios from "axios";
import {
  Check,
  X,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  Shield,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText
} from "lucide-react";

export default function StrategyLab() {
  const [strategies, setStrategies] = useState<any[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionStatus, setActionStatus] = useState<{ type: "success" | "error" | "warning"; msg: string } | null>(null);

  const generateStrategies = async () => {
    setLoading(true);
    setStrategies([]);
    setSelectedStrategy(null);
    setActionStatus(null);
    try {
      const modes = ["baseline_nearest", "severity_first", "balanced", "coverage_first"];
      const results = await Promise.all(
        modes.map(mode =>
          axios.post("http://localhost:8000/api/v1/strategies/generate", { mode })
        )
      );

      const strategiesData = await Promise.all(
        results.map(res =>
          axios.get(`http://localhost:8000/api/v1/strategies/${res.data.strategy_id}`)
        )
      );

      const fullData = strategiesData.map(res => res.data);
      setStrategies(fullData);
      if (fullData.length > 0) {
        setSelectedStrategy(fullData[2] || fullData[0]); // Default to balanced or first
      }
    } catch (err: any) {
      console.error(err);
      setActionStatus({ type: "error", msg: err.response?.data?.detail || "Error generating optimization strategies" });
    }
    setLoading(false);
  };

  const approveStrategy = async (id: string) => {
    try {
      await axios.post(`http://localhost:8000/api/v1/strategies/${id}/approve`, {
        operator_action: "approved",
        operator_id: "Emergency Incident Commander"
      });
      setActionStatus({ type: "success", msg: "Strategy Approved! Active allocations have been committed to Digital Twin." });
      // Refresh selected strategy state
      const res = await axios.get(`http://localhost:8000/api/v1/strategies/${id}`);
      setSelectedStrategy(res.data);
    } catch (err: any) {
      if (err.response?.status === 409) {
        setActionStatus({
          type: "error",
          msg: "APPROVAL REJECTED (HTTP 409): Strategy is STALE. Digital Twin state has materially mutated since this strategy was calculated. Re-generate strategies to replan."
        });
      } else {
        setActionStatus({ type: "error", msg: err.response?.data?.detail || "Failed to approve strategy." });
      }
    }
  };

  const rejectStrategy = async (id: string) => {
    try {
      await axios.post(`http://localhost:8000/api/v1/strategies/${id}/reject`, {
        operator_action: "rejected",
        operator_id: "Emergency Incident Commander",
        operator_note: "Rejected by operator during evaluation"
      });
      setActionStatus({ type: "warning", msg: "Strategy Rejected. Proposed allocations cancelled." });
      const res = await axios.get(`http://localhost:8000/api/v1/strategies/${id}`);
      setSelectedStrategy(res.data);
    } catch (err: any) {
      setActionStatus({ type: "error", msg: err.response?.data?.detail || "Failed to reject strategy." });
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-800/80 p-5 rounded-xl border border-slate-700">
        <div>
          <h1 className="text-3xl font-bold text-white">Strategy Optimization Lab</h1>
          <p className="text-slate-400 text-sm">
            Generate and compare multiple candidate strategies. Hard constraints are strictly enforced across road networks, capacities, and typed medicine reserves.
          </p>
        </div>
        <button
          onClick={generateStrategies}
          disabled={loading}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-sm flex items-center gap-2 border border-blue-500 transition disabled:opacity-50"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          {loading ? "Optimizing (OR Engine)..." : "Generate & Compare Strategies"}
        </button>
      </div>

      {actionStatus && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-start gap-3 ${
            actionStatus.type === "error"
              ? "bg-rose-950/80 border-rose-800 text-rose-200"
              : actionStatus.type === "success"
              ? "bg-emerald-950/80 border-emerald-800 text-emerald-200"
              : "bg-amber-950/80 border-amber-800 text-amber-200"
          }`}
        >
          {actionStatus.type === "error" ? (
            <AlertCircle size={20} className="text-rose-400 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 size={20} className="text-emerald-400 shrink-0 mt-0.5" />
          )}
          <div className="font-medium">{actionStatus.msg}</div>
        </div>
      )}

      {strategies.length === 0 && !loading && (
        <div className="bg-slate-800/50 p-12 text-center rounded-xl border border-slate-700 space-y-4">
          <div className="w-16 h-16 bg-blue-950/60 rounded-full flex items-center justify-center mx-auto text-blue-400 border border-blue-800">
            <TrendingUp size={32} />
          </div>
          <h3 className="text-lg font-bold text-white">No Candidate Strategies Loaded</h3>
          <p className="text-slate-400 text-sm max-w-lg mx-auto">
            Click "Generate & Compare Strategies" above to evaluate 4 distinct multi-objective optimization profiles (Nearest Baseline, Severity-First, Balanced, and Coverage-First) against the current Digital Twin snapshot.
          </p>
          <button
            onClick={generateStrategies}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold inline-flex items-center gap-2"
          >
            <RefreshCw size={16} /> Run Optimization Suite
          </button>
        </div>
      )}

      {strategies.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Strategy Comparison Cards (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <TrendingUp size={18} className="text-blue-400" /> Candidate Strategies Evaluation Matrix
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {strategies.map((item: any) => {
                const s = item.strategy;
                const isSelected = selectedStrategy?.strategy?.id === s.id;
                const isApproved = s.status === "APPROVED";
                const isStale = s.status === "STALE";

                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedStrategy(item)}
                    className={`p-5 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                      isSelected
                        ? "bg-slate-800 border-blue-500 ring-2 ring-blue-500/30"
                        : "bg-slate-800/70 border-slate-700 hover:border-slate-500 hover:bg-slate-800"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-300 uppercase font-bold border border-slate-700">
                          {s.mode?.replace("_", " ")}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-bold uppercase ${
                            isApproved
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                              : isStale
                              ? "bg-rose-950 text-rose-300 border border-rose-800"
                              : "bg-blue-950 text-blue-300 border border-blue-800"
                          }`}
                        >
                          {s.status}
                        </span>
                      </div>

                      <div className="my-3">
                        <div className="text-2xl font-extrabold text-white">
                          Score: <span className="text-blue-400 font-mono">{typeof s.score === 'number' ? s.score.toFixed(1) : "N/A"}</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          Snapshot: State Version v{s.state_version}
                        </div>
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-300 py-2 border-t border-slate-700/80">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Demand Coverage:</span>
                          <span className="font-semibold text-emerald-400">
                            {item.allocations ? `${item.allocations.length} allocations` : "Calculated"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Allocated Deployments:</span>
                          <span className="font-mono">{item.allocations?.length || 0} units</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Avg Travel ETA:</span>
                          <span className="font-mono text-amber-300">
                            {item.allocations && item.allocations.length > 0
                              ? `${(
                                  item.allocations.reduce((acc: number, a: any) => acc + (a.route_travel_min || 0), 0) /
                                  item.allocations.length
                                ).toFixed(1)} min`
                              : "0 min"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between">
                      <span className="text-xs text-slate-400">
                        {isSelected ? "● Active Selection" : "Click to inspect"}
                      </span>
                      <span className="text-xs font-bold text-blue-400">View Evidence →</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recommendation & Explanation Panel (5 cols) */}
          <div className="lg:col-span-5 bg-slate-800 rounded-xl border border-slate-700 p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-700 mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText size={18} className="text-blue-400" /> Evidence & Explanation
                </h2>
                {selectedStrategy && (
                  <span className="text-xs font-mono text-slate-400">
                    ID: {selectedStrategy.strategy?.id?.substring(0, 8)}
                  </span>
                )}
              </div>

              {selectedStrategy ? (
                <div className="space-y-4">
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-700 text-xs text-slate-300 space-y-1">
                    <div className="font-bold text-slate-200">
                      Objective: {selectedStrategy.strategy?.mode?.toUpperCase().replace("_", " ")}
                    </div>
                    <div>State Snapshot Version: <strong>v{selectedStrategy.strategy?.state_version}</strong></div>
                    <div>Status: <strong className="text-blue-400">{selectedStrategy.strategy?.status}</strong></div>
                  </div>

                  {/* Deterministic Explanation text */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Deterministic Decision Rationale
                    </h4>
                    <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-300 font-sans leading-relaxed max-h-72 overflow-y-auto whitespace-pre-wrap">
                      {selectedStrategy.explanation || "No explanation text returned."}
                    </div>
                  </div>

                  {/* Allocations summary */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Proposed Allocations ({selectedStrategy.allocations?.length || 0})
                    </h4>
                    <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                      {selectedStrategy.allocations?.map((a: any, idx: number) => (
                        <div key={idx} className="p-2 bg-slate-900 rounded border border-slate-700 text-[11px] flex justify-between">
                          <span>
                            <strong>{a.resource_type?.toUpperCase()}</strong> x{a.quantity}
                          </span>
                          <span className="text-slate-400">
                            {typeof a.route_distance_km === 'number' ? `${a.route_distance_km.toFixed(1)} km` : ""} {typeof a.route_travel_min === 'number' ? `(${Math.round(a.route_travel_min)} min)` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center text-slate-500 text-sm">
                  Select a strategy card to inspect its evidence and approve allocations.
                </div>
              )}
            </div>

            {selectedStrategy && (
              <div className="mt-6 pt-4 border-t border-slate-700 flex gap-3">
                <button
                  onClick={() => approveStrategy(selectedStrategy.strategy.id)}
                  disabled={selectedStrategy.strategy.status === "APPROVED" || selectedStrategy.strategy.status === "REJECTED"}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:bg-slate-700"
                >
                  <Check size={18} />
                  {selectedStrategy.strategy.status === "APPROVED"
                    ? "Strategy Already Approved"
                    : "Approve Strategy (Commit Allocations)"}
                </button>
                {selectedStrategy.strategy.status === "GENERATED" && (
                  <button
                    onClick={() => rejectStrategy(selectedStrategy.strategy.id)}
                    className="px-4 py-3 bg-rose-950/70 hover:bg-rose-900 text-rose-200 border border-rose-800 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition"
                  >
                    <X size={18} /> Reject
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
