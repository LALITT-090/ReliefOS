"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/lib/api";
import { AlertOctagon, Activity, Truck, Package, MapPin, Zap, RefreshCcw, CheckCircle, XCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useReliefData } from "@/components/ReliefDataContext";

export default function SimulationSandbox() {
  const { twin, allocations, refreshSnapshot } = useReliefData();
  const [result, setResult] = useState<any>(null);
  const [replan, setReplan] = useState<any>(null);
  const [replanError, setReplanError] = useState<string | null>(null);
  const [loadingReplan, setLoadingReplan] = useState(false);
  const [approvingReplan, setApprovingReplan] = useState(false);
  const [eventError, setEventError] = useState<string | null>(null);
  const [loadingEvent, setLoadingEvent] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState("road_block");

  const triggerEvent = async (type: string, payload: any) => {
    setLoadingEvent(type);
    setEventError(null);
    setResult(null);
    setReplan(null);
    setReplanError(null);
    const stateVersionBefore = twin?.state_version ?? null;
    try {
      const res = await axios.post(`${API_BASE_URL}/v1/chaos/events`, {
        event_type: type,
        payload
      });
      const [snapshotResult, predictionsResult, auditResult] = await Promise.allSettled([
        refreshSnapshot(true),
        axios.get(`${API_BASE_URL}/v1/predictions`),
        axios.get(`${API_BASE_URL}/v1/audit`),
      ]);
      const snapshot = snapshotResult.status === "fulfilled" ? snapshotResult.value : null;
      setResult({
        eventType: type,
        eventLabel: type.replace(/_/g, " "),
        stateVersionBefore,
        stateVersionAfter: snapshot?.twin?.state_version ?? res.data.result?.new_state_version ?? null,
        response: res.data,
        baselineAllocations: allocations
          .filter((allocation: any) => ["approved", "dispatched", "in_transit"].includes(allocation.status))
          .map((allocation: any) => ({
            id: allocation.id,
            resource_type: allocation.resource_type,
            quantity: allocation.quantity,
            destination_name: allocation.destination_name,
            status: allocation.status,
          })),
        predictions: predictionsResult.status === "fulfilled" ? predictionsResult.value.data.forecasts || [] : null,
        auditEvents: auditResult.status === "fulfilled" ? auditResult.value.data.events || [] : null,
        auditConfirmed: auditResult.status === "fulfilled" && auditResult.value.data.events?.some((event: any) =>
          event.event_type === "chaos_event_applied" && event.payload_json?.event_type === type
        ),
        refreshError: snapshotResult.status === "rejected" ? "The event applied, but the latest state snapshot could not be refreshed." : null,
        predictionsError: predictionsResult.status === "rejected" || auditResult.status === "rejected",
      });
    } catch (err: any) {
      setEventError(`Event was not applied. ${err.response?.data?.detail || "The simulation service could not apply this event. Previous state is unchanged."}`);
    } finally {
      setLoadingEvent(null);
    }
  };

  const generateReplan = async () => {
    setLoadingReplan(true);
    setReplanError(null);
    try {
      const response = await axios.post(`${API_BASE_URL}/v1/strategies/generate`, {
        mode: "balanced",
      });
      const [detail, snapshot] = await Promise.all([
        axios.get(`${API_BASE_URL}/v1/strategies/${response.data.strategy_id}`),
        refreshSnapshot(true),
      ]);
      setReplan({
        ...detail.data,
        optimizationResult: response.data.result,
        refreshedVersion: snapshot.twin?.state_version,
      });
    } catch (err: any) {
      setReplanError(err.response?.data?.detail || "Replan generation or refresh failed. Check the Strategy Lab before continuing.");
    } finally {
      setLoadingReplan(false);
    }
  };

  const approveReplan = async () => {
    if (!replan?.strategy?.id || replan.strategy.status !== "generated") return;
    setApprovingReplan(true);
    setReplanError(null);
    try {
      await axios.post(`${API_BASE_URL}/v1/strategies/${replan.strategy.id}/approve`, {
        operator_action: "approved",
        operator_id: "Emergency Incident Commander",
      });
      const [detail, snapshot] = await Promise.all([
        axios.get(`${API_BASE_URL}/v1/strategies/${replan.strategy.id}`),
        refreshSnapshot(true),
      ]);
      setReplan({
        ...detail.data,
        optimizationResult: replan.optimizationResult,
        refreshedVersion: snapshot.twin?.state_version,
      });
    } catch (err: any) {
      setReplanError(err.response?.data?.detail || "The replan was not approved. Refresh the Digital Twin and review the current state.");
    } finally {
      setApprovingReplan(false);
    }
  };

  useEffect(() => {
    if (!replan?.strategy?.id || replan.strategy.status !== "generated") return;
    let active = true;
    const refreshReplan = async () => {
      try {
        const [detail, snapshot] = await Promise.all([
          axios.get(`${API_BASE_URL}/v1/strategies/${replan.strategy.id}`),
          refreshSnapshot(true),
        ]);
        if (active) {
          setReplan((current: any) => ({
            ...detail.data,
            optimizationResult: current?.optimizationResult,
            refreshedVersion: snapshot.twin?.state_version,
          }));
        }
      } catch {
        if (active) setReplanError("Could not refresh the replan approval state. Reopen Strategy Lab or retry.");
      }
    };
    const interval = setInterval(refreshReplan, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [replan?.strategy?.id, replan?.strategy?.status, refreshSnapshot]);

  const resetScenario = async () => {
    const confirmed = window.confirm(
      "Reset this scenario to its initial simulation baseline? This removes its strategies, allocations, and audit events."
    );
    if (!confirmed) return;

    setLoadingEvent("reset");
    setEventError(null);
    setResult(null);
    setReplan(null);
    setReplanError(null);
    try {
      if (!twin?.scenario?.id) {
        throw new Error("No active scenario is available to reset.");
      }
      const res = await axios.post(`${API_BASE_URL}/v1/scenarios/${twin.scenario.id}/load`);
      const [snapshotResult, predictionsResult, auditResult] = await Promise.allSettled([
        refreshSnapshot(true),
        axios.get(`${API_BASE_URL}/v1/predictions`),
        axios.get(`${API_BASE_URL}/v1/audit`),
      ]);
      setResult({
        kind: "reset",
        eventType: "scenario_reset",
        message: "Scenario reset to its initial simulated state.",
        stateVersionBefore: twin?.state_version ?? null,
        stateVersionAfter: snapshotResult.status === "fulfilled" ? snapshotResult.value.twin?.state_version : res.data.state_version,
        response: res.data,
        predictions: predictionsResult.status === "fulfilled" ? predictionsResult.value.data.forecasts || [] : null,
        auditEvents: auditResult.status === "fulfilled" ? auditResult.value.data.events || [] : null,
        refreshError: snapshotResult.status === "rejected" ? "Scenario reset completed, but the latest state snapshot could not be refreshed." : null,
        predictionsError: predictionsResult.status === "rejected" || auditResult.status === "rejected",
      });
    } catch (err: any) {
      setEventError(`Scenario reset was not completed. ${err.response?.data?.detail || err.message || "The previous simulation state remains in place."}`);
    } finally {
      setLoadingEvent(null);
    }
  };

  const firstEdge = twin?.road_edges?.[0];
  const firstHospital = twin?.hospitals?.[0];
  const firstAmbulance = twin?.ambulances?.find((ambulance: any) => ambulance.availability_status === "available") || twin?.ambulances?.[0];
  const firstZone = twin?.zones?.[0];
  const firstInventory = twin?.medicine_inventory?.[0];
  const events = [
    {
      id: "road_block",
      title: "1. Road Block",
      icon: <AlertOctagon className="text-rose-400" />,
      desc: "Simulate a road closure on an edge in the active scenario network.",
      payload: { edge_id: firstEdge?.id || "77000000-0000-0000-0000-000000000001" }
    },
    {
      id: "hospital_overload",
      title: "2. Hospital Overload",
      icon: <Activity className="text-amber-400" />,
      desc: "Simulate a sudden ICU capacity reduction at an active scenario hospital.",
      payload: {
        hospital_id: firstHospital?.id || "33000000-0000-0000-0000-000000000001",
        icu_reduction: Math.min(10, Math.max(1, firstHospital?.icu_available || 10)),
      }
    },
    {
      id: "vehicle_failure",
      title: "3. Vehicle Failure",
      icon: <Truck className="text-teal-400" />,
      desc: "Mark an available ambulance in the active scenario as failed.",
      payload: { ambulance_id: firstAmbulance?.id || "66000000-0000-0000-0000-000000000001" }
    },
    {
      id: "demand_spike",
      title: "4. Demand Spike",
      icon: <Zap className="text-yellow-400" />,
      desc: "Add ambulance demand to a zone in the active scenario.",
      payload: { zone_id: firstZone?.id || "22000000-0000-0000-0000-000000000001", resource_type: "ambulance", increase_amount: 3 }
    },
    {
      id: "medicine_shortage",
      title: "5. Medicine Shortage",
      icon: <Package className="text-teal-400" />,
      desc: "Reduce typed medicine stock at a supply source in the active scenario.",
      payload: {
        inventory_id: firstInventory?.id || "88000000-0000-0000-0000-000000000001",
        reduction: Math.min(50, Math.max(1, (firstInventory?.quantity_available || 51) - (firstInventory?.reserve_quantity || 0))),
      }
    },
    {
      id: "new_incident_zone",
      title: "6. New Incident Zone",
      icon: <MapPin className="text-blue-400" />,
      desc: "Add a synthetic incident zone with urgent demand to the active scenario.",
      payload: {
        name: "New Incident Zone",
        lat: (firstZone?.lat || 18.48) + 0.01,
        lon: (firstZone?.lon || 73.87) + 0.01,
        severity: "high",
        affected_population: 800,
        demands: [{ resource_type: "ambulance", quantity: 2, severity: "high", urgency: "urgent" }]
      }
    }
  ];
  const selectedEvent = events.find((event) => event.id === selectedEventId);
  const resultData = result?.response?.result || {};
  const resultInventory = resultData.inventory_id
    ? twin?.medicine_inventory?.find((inventory: any) => inventory.id === resultData.inventory_id)
    : null;
  const impactSummary = resultData.edge_name
    ? `${resultData.edge_name} is now blocked.`
    : resultData.hospital_name
    ? `${resultData.hospital_name}: available ICU beds changed from ${resultData.old_icu_available} to ${resultData.new_icu_available}.`
    : resultData.ambulance_name
    ? `${resultData.ambulance_name}: status changed from ${resultData.old_status} to ${resultData.new_status}.`
    : resultData.demands_created != null
    ? `${resultData.zone_name} was added with ${resultData.demands_created} new resource demand item(s).`
    : resultData.increase_amount != null
    ? `${resultData.zone_name}: ${resultData.increase_amount} additional ${resultData.resource_type?.replace(/_/g, " ")} demand was added.`
    : resultData.old_quantity != null
    ? `${resultInventory?.medicine_type_code || "Medicine"} stock changed from ${resultData.old_quantity} to ${resultData.new_quantity} units.`
    : selectedEvent?.desc || "The selected simulation event was applied.";

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-orange-700">Simulation controls</div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Chaos & Failure Simulation</h1>
          <p className="text-sm text-slate-600">Apply a simulated disruption to the Digital Twin and inspect the measured response.</p>
          <p className="mt-1 text-[10px] font-medium text-slate-500">SIMULATION DATA — Facility labels are scenario references; all operational figures are synthetic.</p>
        </div>
        <button
          onClick={resetScenario}
          disabled={loadingEvent !== null}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm font-semibold flex items-center gap-2 border border-slate-600 transition"
        >
          <RefreshCcw size={16} className={loadingEvent === "reset" ? "animate-spin" : ""} /> {loadingEvent === "reset" ? "Resetting scenario…" : "Reset Scenario"}
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {events.map(ev => (
          <label key={ev.id} className={`cursor-pointer bg-slate-800 p-5 rounded-xl border transition flex flex-col justify-between ${selectedEventId === ev.id ? "border-teal-500 ring-2 ring-teal-500/20" : "border-slate-700 hover:border-slate-500"}`}>
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-700">
                  {ev.icon}
                </div>
                <h3 className="font-bold text-white text-base">{ev.title}</h3>
              </div>
              <p className="text-xs text-slate-400 mb-5">{ev.desc}</p>
            </div>
            <span className="flex items-center gap-2 border-t border-slate-700 pt-3 text-xs font-semibold text-slate-700">
              <input
                type="radio"
                name="simulation-event"
                value={ev.id}
                checked={selectedEventId === ev.id}
                onChange={() => setSelectedEventId(ev.id)}
                disabled={loadingEvent !== null}
                className="accent-teal-600"
              />
              Select event
            </span>
          </label>
        ))}
      </div>

      {selectedEvent && (
        <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-orange-700">Preview Impact</div>
            <div className="mt-1 flex items-center gap-2 text-sm font-bold text-slate-900">
              {selectedEvent.icon}{selectedEvent.title.replace(/^\d+\.\s*/, "")}
            </div>
            <p className="mt-1 text-xs text-slate-600">{selectedEvent.desc}</p>
            <p className="mt-2 text-[11px] text-slate-600">Current state version: <strong>v{twin?.state_version ?? "--"}</strong>. Event impact is reported after the Digital Twin confirms the change.</p>
            <p className="mt-1 text-[11px] font-semibold text-amber-800">A new strategy must still be reviewed and approved by an operator.</p>
          </div>
          <button
            onClick={() => triggerEvent(selectedEvent.id, selectedEvent.payload)}
            disabled={loadingEvent !== null}
            aria-live="polite"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-4 text-sm font-bold text-rose-800 transition hover:bg-rose-100 disabled:opacity-50"
          >
            <AlertOctagon size={16} className={loadingEvent === selectedEvent.id ? "animate-spin" : ""} />
            {loadingEvent === selectedEvent.id ? "Applying event…" : "Apply Event"}
          </button>
        </section>
      )}

      {eventError && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800">
          <XCircle size={18} className="mt-0.5 shrink-0" />
          <div><strong>{eventError.startsWith("Scenario reset") ? "Scenario reset not completed" : "Event not applied"}</strong><div className="mt-1">{eventError}</div></div>
        </div>
      )}

      {result && (
        <section aria-live="polite" className="space-y-4 rounded-xl border border-emerald-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <CheckCircle size={20} className="mt-0.5 shrink-0 text-green-700" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-green-800">{result.kind === "reset" ? "Simulation scenario reset" : "Simulation event applied"}</div>
              <div className="mt-1 text-xs text-slate-600">{result.message || `${result.eventLabel || result.eventType?.replace(/_/g, " ")} changed the live simulated state.`}</div>
            </div>
            <div className="text-right text-xs text-slate-500">
              <div>State version</div>
              <strong className="text-slate-900">v{result.stateVersionBefore ?? "--"} <ArrowRight className="mx-1 inline" size={12} /> v{result.stateVersionAfter ?? "--"}</strong>
            </div>
          </div>

          {result.refreshError && <p role="status" className="rounded bg-amber-50 p-3 text-xs text-amber-900">{result.refreshError}</p>}

          {result.kind === "reset" && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <h2 className="text-xs font-bold uppercase tracking-wide text-green-900">Baseline restored</h2>
              <p className="mt-2 text-sm text-green-900">The scenario returned to its initial simulated state. Event impacts and operational changes from this test were cleared.</p>
            </div>
          )}

          {result.kind !== "reset" && <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg bg-slate-50 p-4">
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-700">Measured Event Impact</h2>
              <p className="mt-2 text-xs text-slate-700">
                Baseline before event: {result.baselineAllocations?.length || 0} approved/dispatched/in-transit allocation(s).
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {impactSummary}
              </p>
              <div className="mt-3 text-xs font-semibold text-slate-700">
                {result.response.impacted_allocations?.length > 0
                  ? `${result.response.impacted_allocations.length} active allocation(s) flagged for review.`
                  : "0 allocations affected among the currently active approved movements."}
              </div>
              {result.response.impacted_allocations?.length > 0 ? (
                <ul className="mt-2 space-y-2">
                  {result.response.impacted_allocations.map((impact: any) => {
                    const allocation = allocations.find((item: any) => item.id === impact.allocation_id);
                    return (
                      <li key={impact.allocation_id} className="rounded border border-amber-200 bg-amber-50 p-2 text-xs">
                        <strong>{impact.resource_type?.replace("_", " ")} {allocation?.quantity ? `×${allocation.quantity}` : ""}</strong>
                        <span> to {allocation?.destination_name || "assigned destination"}</span>
                        <div className="mt-1 text-amber-900">{impact.reason}</div>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              {result.response.event_id && (
                <p className="mt-3 break-all text-[10px] text-slate-500">Audit event reference: {result.response.event_id}</p>
              )}
            </div>

            <div className="rounded-lg bg-slate-50 p-4">
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-700">Event Applied — Next Operator Decision</h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-700">Review the refreshed forecasts and generate a new candidate. It remains a proposal until an operator approves it; ReliefOS does not automatically reallocate resources.</p>
              <button
                type="button"
                onClick={generateReplan}
                disabled={loadingReplan || Boolean(replan)}
                className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-xs font-bold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingReplan ? "Generating replan…" : replan ? "Replan generated" : "Generate replan"}
              </button>
              <Link href="/strategy-lab" className="mt-3 inline-flex items-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-xs font-bold text-white hover:bg-teal-800">
                Review strategies <ArrowRight size={14} />
              </Link>
              <div className="mt-3 space-y-1 text-[11px] text-slate-600">
                {Array.isArray(result.predictions) && <p>{result.predictions.length} forecast estimate(s) refreshed from state v{result.stateVersionAfter ?? "--"}. <Link href="/predictions" className="font-bold text-teal-800 underline">View forecasts</Link></p>}
                {result.auditConfirmed && <p>Event recorded in the <Link href="/audit" className="font-bold text-teal-800 underline">Audit Trail</Link>.</p>}
              </div>
              {result.predictionsError && <p className="mt-3 text-xs text-amber-900">Event applied. Some supporting forecast or audit details could not refresh; use those pages&apos; refresh controls to retry.</p>}
              {replanError && <p role="alert" className="mt-3 text-xs text-rose-800">{replanError}</p>}
            </div>
          </div>}

          {replan && (
            <section className="rounded-lg border border-amber-200 bg-amber-50 p-4" aria-label="Generated replan">
              <h2 className="text-xs font-bold uppercase tracking-wide text-amber-950">
                {replan.strategy.status === "approved" ? "Replan Approved" : "Replan Generated — Not Yet Applied"}
              </h2>
              <p className="mt-2 text-xs text-amber-950">
                Candidate {replan.strategy.id} · state v{replan.strategy.state_version} · coverage {replan.strategy.coverage_pct}% · score {replan.strategy.score}
              </p>
              <p className="mt-1 text-xs font-semibold text-amber-950">
                {replan.strategy.status === "approved"
                  ? "Operator approval recorded. The proposed allocations are now committed to the simulated Digital Twin."
                  : replan.strategy.status === "stale"
                  ? "This candidate is stale and cannot be committed; generate a fresh replan."
                  : "Approval required. No proposed resource movement has been committed."}
              </p>
              {replan.strategy.status === "generated" && (
                <button
                  type="button"
                  onClick={approveReplan}
                  disabled={approvingReplan}
                  className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-xs font-bold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {approvingReplan ? "Approving replan…" : "Approve and apply replan"}
                </button>
              )}
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {(replan.allocations || []).slice(0, 8).map((allocation: any) => (
                  <li key={allocation.id} className="rounded border border-amber-200 bg-white p-2 text-xs text-slate-800">
                    {allocation.resource_type?.replace(/_/g, " ")} ×{allocation.quantity} → {allocation.destination_id}
                    <strong className="ml-2 uppercase">{allocation.status}</strong>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <details className="border-t border-slate-200 pt-3 text-xs">
            <summary className="cursor-pointer font-semibold text-slate-600">{result.kind === "reset" ? "Technical reset response" : "Technical event response"}</summary>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-50 p-3 text-[11px] text-slate-600">{JSON.stringify(result.response, null, 2)}</pre>
          </details>
        </section>
      )}
    </div>
  );
}
