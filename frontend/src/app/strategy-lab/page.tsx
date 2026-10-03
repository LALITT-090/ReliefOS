"use client";

import { useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/lib/api";
import { useReliefData } from "@/components/ReliefDataContext";
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
  const { refreshSnapshot } = useReliefData();
  const [strategies, setStrategies] = useState<any[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [modifyOpen, setModifyOpen] = useState(false);
  const [modifying, setModifying] = useState(false);
  const [modifiedQuantities, setModifiedQuantities] = useState<Record<string, string>>({});
  const [operatorNote, setOperatorNote] = useState("");
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
          axios.post(`${API_BASE_URL}/v1/strategies/generate`, { mode })
        )
      );

      const strategiesData = await Promise.all(
        results.map(res =>
          axios.get(`${API_BASE_URL}/v1/strategies/${res.data.strategy_id}`)
        )
      );

      const fullData = strategiesData.map((res, index) => ({
        ...res.data,
        optimizationResult: results[index].data.result,
      }));
      setStrategies(fullData);
      if (fullData.length > 0) {
        setSelectedStrategy(fullData[2] || fullData[0]); // Default to balanced or first
      }
    } catch (err: any) {
      setActionStatus({ type: "error", msg: err.response?.data?.detail || "Error generating optimization strategies" });
    }
    setLoading(false);
  };

  const approveStrategy = async (id: string) => {
    setDecisionLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/v1/strategies/${id}/approve`, {
        operator_action: "approved",
        operator_id: "Emergency Incident Commander"
      });
      setActionStatus({ type: "success", msg: "Strategy Approved! Active allocations have been committed to Digital Twin." });
      const [snapshot, strategy] = await Promise.allSettled([
        refreshSnapshot(true),
        axios.get(`${API_BASE_URL}/v1/strategies/${id}`),
      ]);
      if (strategy.status === "fulfilled") {
        const refreshed = { ...strategy.value.data, optimizationResult: selectedStrategy?.optimizationResult };
        setSelectedStrategy(refreshed);
        setStrategies((current) => current.map((item) => item.strategy?.id === id ? refreshed : item));
      }
      if (snapshot.status === "rejected" || strategy.status === "rejected") {
        setActionStatus({ type: "warning", msg: "Strategy approved, but some updated details could not be refreshed. Use Refresh or reopen this view." });
      }
    } catch (err: any) {
      if (err.response?.status === 409) {
        setActionStatus({
          type: "error",
          msg: "APPROVAL REJECTED (HTTP 409): Strategy is STALE. Digital Twin state has materially mutated since this strategy was calculated. Re-generate strategies to replan."
        });
        axios.get(`${API_BASE_URL}/v1/strategies/${id}`).then((res) => {
          const refreshed = { ...res.data, optimizationResult: selectedStrategy?.optimizationResult };
          setSelectedStrategy(refreshed);
          setStrategies((current) => current.map((item) => item.strategy?.id === id ? refreshed : item));
        }).catch(() => {
          setActionStatus({ type: "warning", msg: "The strategy is stale, but its latest status could not be refreshed. Re-generate strategies before continuing." });
        });
      } else {
        setActionStatus({ type: "error", msg: err.response?.data?.detail || "Failed to approve strategy." });
      }
    } finally {
      setDecisionLoading(false);
    }
  };

  const rejectStrategy = async (id: string) => {
    setDecisionLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/v1/strategies/${id}/reject`, {
        operator_action: "rejected",
        operator_id: "Emergency Incident Commander",
        operator_note: "Rejected by operator during evaluation"
      });
      setActionStatus({ type: "warning", msg: "Strategy Rejected. Proposed allocations cancelled." });
      const [snapshot, strategy] = await Promise.allSettled([
        refreshSnapshot(true),
        axios.get(`${API_BASE_URL}/v1/strategies/${id}`),
      ]);
      if (strategy.status === "fulfilled") {
        const refreshed = { ...strategy.value.data, optimizationResult: selectedStrategy?.optimizationResult };
        setSelectedStrategy(refreshed);
        setStrategies((current) => current.map((item) => item.strategy?.id === id ? refreshed : item));
      }
      if (snapshot.status === "rejected" || strategy.status === "rejected") {
        setActionStatus({ type: "warning", msg: "Strategy rejected, but some updated details could not be refreshed. Use Refresh or reopen this view." });
      }
    } catch (err: any) {
      setActionStatus({ type: "error", msg: err.response?.data?.detail || "Failed to reject strategy." });
    } finally {
      setDecisionLoading(false);
    }
  };

  const openModifyForm = () => {
    if (!selectedStrategy) return;
    setModifiedQuantities(Object.fromEntries(
      (selectedStrategy.allocations || []).map((allocation: any) => [allocation.id, String(allocation.quantity)])
    ));
    setOperatorNote("");
    setModifyOpen(true);
  };

  const saveModifications = async () => {
    if (!selectedStrategy) return;
    const allocationModifications = (selectedStrategy.allocations || [])
      .filter((allocation: any) => Number(modifiedQuantities[allocation.id]) !== Number(allocation.quantity))
      .map((allocation: any) => ({ allocation_id: allocation.id, quantity: Number(modifiedQuantities[allocation.id]) }));
    if (allocationModifications.some((modification: any) => !Number.isInteger(modification.quantity) || modification.quantity < 1)) {
      setActionStatus({ type: "error", msg: "Enter a whole-number quantity of at least 1 for each proposed movement." });
      return;
    }
    setModifying(true);
    setActionStatus(null);
    try {
      await axios.post(`${API_BASE_URL}/v1/strategies/${selectedStrategy.strategy.id}/modify`, {
        operator_id: "Emergency Incident Commander",
        operator_note: operatorNote || "Operator adjusted proposed allocation quantities",
        allocation_modifications: allocationModifications,
      });
      const refreshed = await axios.get(`${API_BASE_URL}/v1/strategies/${selectedStrategy.strategy.id}`);
      setSelectedStrategy({ ...refreshed.data, optimizationResult: selectedStrategy.optimizationResult });
      setStrategies((current) => current.map((item) => item.strategy?.id === refreshed.data.strategy?.id
        ? { ...refreshed.data, optimizationResult: item.optimizationResult }
        : item
      ));
      setModifyOpen(false);
      setActionStatus({ type: "success", msg: "Proposed allocation changes saved. Review the updated quantities; operator approval is still required to commit them." });
    } catch (err: any) {
      setActionStatus({ type: "error", msg: err.response?.data?.detail || "Changes were not saved. The proposal remains unchanged." });
    } finally {
      setModifying(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-800/80 p-5 rounded-xl border border-slate-700">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Strategy Lab</h1>
          <p className="text-slate-400 text-sm">
            Compare operational outcomes, inspect the evidence, then decide whether to approve a candidate. Recommendations never commit resources without operator approval.
          </p>
        </div>
        <button
          onClick={generateStrategies}
          disabled={loading}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-sm flex items-center gap-2 border border-blue-500 transition disabled:opacity-50"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          {loading ? "Optimizing (Min-Cost Flow)..." : "Generate & Compare Strategies"}
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
            disabled={loading}
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
                const metrics = item.optimizationResult || {};
                const isSelected = selectedStrategy?.strategy?.id === s.id;
                const isApproved = s.status?.toLowerCase() === "approved";
                const isStale = s.status?.toLowerCase() === "stale";

                return (
                  <div
                    key={s.id}
                    onClick={() => { setSelectedStrategy(item); setModifyOpen(false); }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedStrategy(item);
                        setModifyOpen(false);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    className={`p-5 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                      isSelected
                        ? "bg-slate-800 border-blue-500 ring-2 ring-blue-500/30"
                        : "bg-slate-800/70 border-slate-700 hover:border-slate-500 hover:bg-slate-800"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold px-2 py-1 rounded bg-slate-100 text-slate-700 uppercase">
                          {s.mode?.replace(/_/g, " ")}
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
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Operational comparison</div>
                        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-slate-200 py-3">
                          <div><div className="text-[10px] text-slate-500">Demand covered</div><div className="mt-0.5 text-lg font-extrabold text-green-700">{typeof metrics.coverage_pct === "number" ? `${metrics.coverage_pct}%` : "--"}</div></div>
                          <div><div className="text-[10px] text-slate-500">Unmet demand</div><div className="mt-0.5 text-lg font-extrabold text-rose-700">{typeof metrics.unmet_demand === "number" ? `${metrics.unmet_demand} units` : "--"}</div></div>
                          <div><div className="text-[10px] text-slate-500">Average ETA</div><div className="mt-0.5 text-sm font-bold text-slate-900">{typeof metrics.avg_eta_min === "number" ? `${metrics.avg_eta_min.toFixed(1)} min` : "--"}</div></div>
                          <div><div className="text-[10px] text-slate-500">Average route risk index</div><div className="mt-0.5 text-sm font-bold text-slate-900">{typeof metrics.avg_risk === "number" ? `${(metrics.avg_risk * 100).toFixed(0)} / 100` : "--"}</div></div>
                          <div className="col-span-2"><div className="text-[10px] text-slate-500">Predicted shortage in 60-minute forecast</div><div className={`mt-0.5 text-sm font-bold ${(metrics.predicted_shortage_impact || 0) > 0 ? "text-orange-700" : "text-green-700"}`}>{typeof metrics.predicted_shortage_impact === "number" ? `${metrics.predicted_shortage_impact.toFixed(0)} units` : "--"}</div></div>
                        </div>
                        <details className="mt-2 text-[10px]">
                          <summary className="cursor-pointer font-semibold text-slate-500">Model score: {typeof s.score === "number" ? s.score.toFixed(1) : "N/A"}</summary>
                          <p className="mt-1 leading-relaxed text-slate-500">This comparison score reflects the optimizer objective. Use the operational metrics above as the main decision signal.</p>
                        </details>
                        <div className="mt-2 text-[10px] text-slate-500">Digital Twin snapshot v{s.state_version}</div>
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
                  <span className="text-[10px] uppercase tracking-wide text-slate-500">
                    Reference: {selectedStrategy.strategy?.id?.substring(0, 8)}
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

                  <div className="rounded-lg border-l-4 border-teal-500 bg-teal-50 p-3">
                    <h4 className="text-xs font-bold text-slate-900">Why this strategy?</h4>
                    <p className="mt-1 text-xs leading-relaxed text-slate-700">
                      {selectedStrategy.explanation?.mode_rationale || "Review the operational metrics and evidence factors to compare this candidate."}
                    </p>
                  </div>

                  {/* Deterministic Explanation text */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Deterministic Decision Rationale
                    </h4>
                    <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-300 font-sans leading-relaxed max-h-72 overflow-y-auto space-y-2">
                      {typeof selectedStrategy.explanation === "string" ? (
                        <p className="whitespace-pre-wrap">{selectedStrategy.explanation}</p>
                      ) : selectedStrategy.explanation ? (
                        <>
                          <p className="font-semibold text-slate-200 leading-snug">
                            {selectedStrategy.explanation.recommendation_summary || "No recommendation summary returned."}
                          </p>
                          {selectedStrategy.explanation.mode_rationale && (
                            <p className="text-slate-400">{selectedStrategy.explanation.mode_rationale}</p>
                          )}
                          {selectedStrategy.explanation.factors?.length > 0 && (
                            <div>
                              <div className="font-bold uppercase tracking-wider text-teal-300 text-[10px]">Evidence Factors</div>
                              <ul className="space-y-1 pl-3 list-disc">
                                {selectedStrategy.explanation.factors.map((f: any, i: number) => (
                                  <li key={i}>
                                    <strong>{f.name || f.type || "Factor"}</strong>: {f.value}
                                    {typeof f.contribution === "number" && (
                                      <span className="text-slate-500"> (impact {f.contribution >= 0 ? "+" : ""}{f.contribution})</span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {selectedStrategy.explanation.constraints?.length > 0 && (
                            <div>
                              <div className="font-bold uppercase tracking-wider text-blue-300 text-[10px]">Constraint Checks</div>
                              <ul className="space-y-0.5">
                                {selectedStrategy.explanation.constraints.map((c: any, i: number) => (
                                  <li key={i} className="flex items-start gap-1.5">
                                    <span className={c.passed ? "text-emerald-400" : "text-rose-400"}>{c.passed ? "OK:" : "FAIL:"}</span>
                                    <span><strong>{c.name}</strong>: {c.detail}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {selectedStrategy.explanation.estimated_impact && (
                            <div>
                              <div className="font-bold uppercase tracking-wider text-amber-300 text-[10px]">Estimated Impact</div>
                              <div className="space-y-0.5">
                                {Object.entries(selectedStrategy.explanation.estimated_impact).map(([k, v]: [string, any]) => (
                                  <div key={k}><span className="uppercase text-slate-500">{k.replace("_", " ")}:</span> {v}</div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <p>No explanation text returned.</p>
                      )}
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

            {modifyOpen && selectedStrategy && selectedStrategy.strategy?.status?.toLowerCase() === "generated" && (
              <form
                className="mt-5 space-y-3 border-t border-slate-200 pt-4"
                onSubmit={(event) => { event.preventDefault(); void saveModifications(); }}
              >
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Modify proposed quantities</h3>
                  <p className="mt-1 text-[11px] text-slate-600">Edits change this proposal only. Review it again before approving.</p>
                </div>
                {(selectedStrategy.allocations || []).map((allocation: any) => (
                  <label key={allocation.id} className="flex items-center justify-between gap-3 rounded-md bg-slate-50 p-2 text-xs">
                    <span className="min-w-0"><strong>{allocation.resource_type?.replace(/_/g, " ")}</strong><span className="block truncate text-[10px] text-slate-500">{allocation.destination_name || "Assigned destination"}</span></span>
                    <span className="shrink-0 text-right">
                      <input
                        aria-label={`Proposed quantity for ${allocation.resource_type?.replace(/_/g, " ")} to ${allocation.destination_name || "destination"}`}
                        aria-describedby={`quantity-help-${allocation.id}`}
                        aria-invalid={Number(modifiedQuantities[allocation.id] ?? allocation.quantity) < 1}
                        type="number"
                        min="1"
                        step="1"
                        value={modifiedQuantities[allocation.id] ?? allocation.quantity}
                        onChange={(event) => setModifiedQuantities((current) => ({ ...current, [allocation.id]: event.target.value }))}
                        className="w-20 rounded border border-slate-300 bg-white px-2 py-1.5 text-right font-bold text-slate-900"
                      />
                      <span id={`quantity-help-${allocation.id}`} className="block min-h-3 text-[9px] text-rose-700">
                        {Number(modifiedQuantities[allocation.id] ?? allocation.quantity) < 1 ? "Quantity must be at least 1." : ""}
                      </span>
                    </span>
                  </label>
                ))}
                <label className="block text-[11px] font-semibold text-slate-700">
                  Operator note
                  <input value={operatorNote} onChange={(event) => setOperatorNote(event.target.value)} className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-xs font-normal" placeholder="Why are these quantities changing?" />
                </label>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setModifyOpen(false)} className="min-h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700">Cancel</button>
                  <button type="submit" disabled={modifying} className="min-h-9 rounded-md bg-teal-700 px-3 text-xs font-bold text-white disabled:opacity-60">{modifying ? "Saving…" : "Save proposed changes"}</button>
                </div>
              </form>
            )}

            {selectedStrategy && (
              <div className="mt-6 pt-4 border-t border-slate-700 flex gap-3">
                <button
                  onClick={() => approveStrategy(selectedStrategy.strategy.id)}
                  disabled={decisionLoading || ["approved", "rejected", "stale"].includes((selectedStrategy.strategy.status || "").toLowerCase())}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:bg-slate-700"
                >
                  {decisionLoading ? <RefreshCw size={18} className="animate-spin" /> : <Check size={18} />}
                  {decisionLoading
                    ? "Saving decision…"
                    : (selectedStrategy.strategy.status || "").toLowerCase() === "approved"
                    ? "Strategy Already Approved"
                    : "Approve Strategy (Commit Allocations)"}
                </button>
                {(selectedStrategy.strategy.status || "").toLowerCase() === "generated" && (
                  <button
                    onClick={openModifyForm}
                    className="px-4 py-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-semibold text-sm transition"
                  >
                    Modify allocations
                  </button>
                )}
                {(selectedStrategy.strategy.status || "").toLowerCase() === "generated" && (
                  <button
                    onClick={() => rejectStrategy(selectedStrategy.strategy.id)}
                    disabled={decisionLoading}
                    className="px-4 py-3 bg-rose-950/70 hover:bg-rose-900 text-rose-200 border border-rose-800 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition"
                  >
                    <X size={18} /> {decisionLoading ? "Saving…" : "Reject"}
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
