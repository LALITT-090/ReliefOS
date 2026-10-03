"use client";

import { useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/lib/api";
import { AlertOctagon, Activity, Truck, Package, MapPin, Zap, RefreshCcw, CheckCircle, XCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useReliefData } from "@/components/ReliefDataContext";

export default function SimulationSandbox() {
  const { twin, allocations, refreshSnapshot } = useReliefData();
  const [result, setResult] = useState<any>(null);
  const [eventError, setEventError] = useState<string | null>(null);
  const [loadingEvent, setLoadingEvent] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState("road_block");

  const triggerEvent = async (type: string, payload: any) => {
    setLoadingEvent(type);
    setEventError(null);
    setResult(null);
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

  const resetScenario = async () => {
    const confirmed = window.confirm(
      "Reset this scenario to its initial simulation baseline? This removes its strategies, allocations, and audit events."
    );
    if (!confirmed) return;

    setLoadingEvent("reset");
    setEventError(null);
    setResult(null);
    try {
      const res = await axios.post(`${API_BASE_URL}/v1/scenarios/00000000-0000-0000-0000-000000000001/load`);
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
      setEventError(`Scenario reset was not completed. ${err.response?.data?.detail || "The previous simulation state remains in place."}`);
    } finally {
      setLoadingEvent(null);
    }
  };

  const events = [
    {
      id: "road_block",
      title: "1. Road Block",
      icon: <AlertOctagon className="text-rose-400" />,
      desc: "Simulate a flooded/collapsed arterial road edge (Central-North).",
      payload: { edge_id: "77000000-0000-0000-0000-000000000001" }
    },
    {
      id: "hospital_overload",
      title: "2. Hospital Overload",
      icon: <Activity className="text-amber-400" />,
      desc: "Simulate sudden ICU capacity reduction at City General Hospital.",
      payload: { hospital_id: "33000000-0000-0000-0000-000000000001", icu_reduction: 10 }
    },
    {
      id: "vehicle_failure",
      title: "3. Vehicle Failure",
      icon: <Truck className="text-teal-400" />,
      desc: "Mark an active ambulance (A-01) as broken down / failed.",
      payload: { ambulance_id: "66000000-0000-0000-0000-000000000001" }
    },
    {
      id: "demand_spike",
      title: "4. Demand Spike",
      icon: <Zap className="text-yellow-400" />,
      desc: "Sudden casualty surge in Zone A (Riverside District).",
      payload: { zone_id: "22000000-0000-0000-0000-000000000001", resource_type: "ambulance", increase_amount: 3 }
    },
    {
      id: "medicine_shortage",
      title: "5. Medicine Shortage",
      icon: <Package className="text-teal-400" />,
      desc: "Simulate warehouse contamination/depletion of antibiotics stock.",
      payload: { inventory_id: "88000000-0000-0000-0000-000000000001", reduction: 50 }
    },
    {
      id: "new_incident_zone",
      title: "6. New Incident Zone",
      icon: <MapPin className="text-blue-400" />,
      desc: "Spawn a newly flooded sector (Zone F — Port Area) with urgent demands.",
      payload: {
        name: "Zone F — Port Area",
        lat: 18.4800,
        lon: 73.8700,
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
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {impactSummary}
              </p>
              <div className="mt-3 text-xs font-semibold text-slate-700">
                {result.response.impacted_allocations?.length > 0
                  ? `${result.response.impacted_allocations.length} active allocation(s) flagged for review.`
                  : "No active allocations were identified as affected by this event."}
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
            </div>

            <div className="rounded-lg bg-slate-50 p-4">
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-700">Next Operator Decision</h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-700">Review refreshed forecasts and affected routes, then generate a candidate strategy. ReliefOS does not automatically reallocate resources.</p>
              <Link href="/strategy-lab" className="mt-3 inline-flex items-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-xs font-bold text-white hover:bg-teal-800">
                Review strategies <ArrowRight size={14} />
              </Link>
              <div className="mt-3 space-y-1 text-[11px] text-slate-600">
                {Array.isArray(result.predictions) && <p>{result.predictions.length} forecast estimate(s) refreshed from state v{result.stateVersionAfter ?? "--"}. <Link href="/predictions" className="font-bold text-teal-800 underline">View forecasts</Link></p>}
                {result.auditConfirmed && <p>Event recorded in the <Link href="/audit" className="font-bold text-teal-800 underline">Audit Trail</Link>.</p>}
              </div>
              {result.predictionsError && <p className="mt-3 text-xs text-amber-900">Event applied. Some supporting forecast or audit details could not refresh; use those pages&apos; refresh controls to retry.</p>}
            </div>
          </div>}

          <details className="border-t border-slate-200 pt-3 text-xs">
            <summary className="cursor-pointer font-semibold text-slate-600">{result.kind === "reset" ? "Technical reset response" : "Technical event response"}</summary>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-50 p-3 text-[11px] text-slate-600">{JSON.stringify(result.response, null, 2)}</pre>
          </details>
        </section>
      )}
    </div>
  );
}
