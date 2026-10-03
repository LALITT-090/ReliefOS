"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/lib/api";
import { ShieldCheck, Clock, RefreshCw, UserCheck, ShieldAlert, CheckCircle2, XCircle } from "lucide-react";
import { useReliefData } from "@/components/ReliefDataContext";

export default function AuditTimeline() {
  const { twin } = useReliefData();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [verification, setVerification] = useState<any>(null);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<Promise<void> | null>(null);

  const loadData = useCallback(() => {
    const scenarioId = twin?.scenario?.id;
    if (!scenarioId) return Promise.resolve();
    if (requestRef.current) return requestRef.current;

    const request = axios.get(`${API_BASE_URL}/v1/audit`, { params: { scenario_id: scenarioId } })
      .then((res) => {
        if (res.data.scenario_id !== scenarioId) {
          throw new Error("Audit response belongs to a different active scenario.");
        }
        setEvents(res.data.events || []);
        setError(null);
      })
      .catch(() => {
        setError("Audit records could not be loaded. Use refresh to try again.");
      })
      .finally(() => {
        requestRef.current = null;
        setLoading(false);
      });

    requestRef.current = request;
    return request;
  }, [twin?.scenario?.id]);

  useEffect(() => {
    void loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [loadData]);

  const verifyChain = async () => {
    setVerificationLoading(true);
    try {
      const scenarioId = twin?.scenario?.id;
      if (!scenarioId) throw new Error("No active scenario is confirmed.");
      const res = await axios.get(`${API_BASE_URL}/v1/audit/verify`, {
        params: { scenario_id: scenarioId },
      });
      if (res.data.scenario_id !== scenarioId) {
        throw new Error("Audit verification belongs to a different active scenario.");
      }
      setVerification(res.data);
    } catch (err: any) {
      setVerification({ valid: false, error: err.response?.data?.detail || "Cryptographic verification could not be completed." });
    } finally {
      setVerificationLoading(false);
    }
  };

  const eventTypes = Array.from(new Set(events.map((event) => event.event_type).filter(Boolean)));
  const visibleEvents = (filterType === "all" ? events : events.filter((event) => event.event_type === filterType))
    .slice()
    .reverse();

  const eventColor = (eventType: string = "") => {
    const type = eventType.toLowerCase();
    if (type.includes("road_status") || type.includes("vehicle_status") || type.includes("reject")) return "#DC2626";
    if (type.includes("approve") || type.includes("deliver") || type.includes("verify") || type.includes("scenario_loaded")) return "#16A34A";
    if (type.includes("hospital") || type.includes("demand") || type.includes("medicine")) return "#F97316";
    if (type.includes("generated") || type.includes("reallocation")) return "#F59E0B";
    return "#0EA5A4";
  };

  const eventTitle = (event: any) => {
    const type = String(event.event_type || "event").toLowerCase();
    const payload = event.payload_json || event.payload || {};
    if (type === "road_status_changed") return "ROAD BLOCK";
    if (type === "chaos_event_applied") return `${String(payload.event_type || "SIMULATION EVENT").replace(/_/g, " ").toUpperCase()} APPLIED`;
    if (type === "strategy_generated") return "REALLOCATION GENERATED";
    if (type === "strategy_approved") return "OPERATOR APPROVED";
    if (type === "strategy_rejected") return "STRATEGY REJECTED";
    if (type === "state_version_incremented") return "STATE UPDATED";
    return type.replace(/_/g, " ").toUpperCase();
  };

  const eventDescription = (event: any) => {
    const type = String(event.event_type || "").toLowerCase();
    const payload = event.payload_json || event.payload || {};
    if (type === "road_status_changed") return `Road ${payload.edge_name || "segment"} became ${payload.new_status || "unavailable"}.`;
    if (type === "chaos_event_applied") {
      const count = Number(payload.impacted_count || 0);
      return count > 0
        ? `${count} active allocation${count === 1 ? " was" : "s were"} flagged for route review.`
        : "The simulation checked active allocations; none were identified as affected.";
    }
    if (type === "strategy_generated") return `A ${String(payload.mode || "candidate").replace(/_/g, " ")} candidate was generated for operator review.`;
    if (type === "strategy_approved") return `${payload.allocations_count ?? "The proposed"} allocation${payload.allocations_count === 1 ? " was" : "s were"} approved by ${event.actor || "the operator"}.`;
    if (type === "strategy_rejected") return `The candidate was rejected by ${event.actor || "the operator"}.`;
    if (type === "allocation_status_changed") return `Allocation lifecycle changed from ${payload.old_status || "previous state"} to ${payload.new_status || "updated state"}.`;
    if (type === "hospital_capacity_changed") return `${payload.hospital_name || "A simulated facility"} ICU availability changed from ${payload.old_icu_available ?? "--"} to ${payload.new_icu_available ?? "--"}.`;
    if (type === "demand_updated") return `Demand for ${payload.resource_type || "resources"} changed in ${payload.zone_name || "the affected zone"} by ${payload.increase_amount ?? "an unreported amount"}.`;
    if (type === "ambulance_status_changed") return `${payload.ambulance_name || "An ambulance"} status changed from ${payload.old_status || "available"} to ${payload.new_status || "updated"}.`;
    if (type === "state_version_incremented") return `Digital Twin state advanced to version ${payload.new_version ?? "--"}.`;
    if (type === "scenario_loaded" || type === "scenario_reset") return "The simulation scenario was loaded; all operational figures remain synthetic.";
    if (type === "medicine_inventory_changed") return `Simulated ${payload.medicine_type_code || "medicine"} inventory changed.`;
    return `${event.entity_type ? `${event.entity_type.replace(/_/g, " ")} ` : ""}record updated.`;
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-12">
      <header className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-teal-700">Operational history</div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Audit Trail</h1>
          <p className="mt-1 text-sm font-semibold text-slate-800">See what changed, why ReliefOS responded, and which decisions were approved.</p>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-slate-600">Every scenario change, recommendation, approval, and reallocation is recorded here. This provides a traceable history of the response.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="audit-event-filter">Filter audit events</label>
          <select
            id="audit-event-filter"
            value={filterType}
            onChange={(event) => setFilterType(event.target.value)}
            className="min-h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
          >
            <option value="all">All event types ({events.length})</option>
            {eventTypes.map((type) => <option key={type} value={type}>{type.replace(/_/g, " ")}</option>)}
          </select>
          <button onClick={loadData} className="rounded-lg border border-slate-300 bg-white p-2 text-slate-700 hover:bg-slate-50" title="Refresh audit log" aria-label="Refresh audit log"><RefreshCw size={16} /></button>
          <button onClick={verifyChain} disabled={verificationLoading} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 text-xs font-bold text-teal-800 hover:bg-teal-100 disabled:opacity-60">
            <ShieldCheck size={15} /> {verificationLoading ? "Verifying…" : "Verify hash chain"}
          </button>
        </div>
      </header>

      {verification && (
        <div role="status" className={`flex items-start gap-3 rounded-lg border p-3 text-xs ${verification.valid ? "border-green-200 bg-green-50 text-green-900" : "border-rose-200 bg-rose-50 text-rose-900"}`}>
          {verification.valid ? <CheckCircle2 size={17} /> : <ShieldAlert size={17} />}
          <div><strong>{verification.valid ? "Hash chain verified" : "Hash verification failed"}</strong><div>{verification.event_count ?? 0} events checked{verification.error ? ` · ${verification.error}` : verification.errors?.length ? ` · ${verification.errors[0]}` : ""}</div></div>
        </div>
      )}
      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{error}</div>}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Response timeline</h2>
            <p className="mt-1 text-[11px] text-slate-500">Newest operational events first. Open technical evidence for IDs and cryptographic proof.</p>
          </div>
          <span className="shrink-0 text-xs font-semibold text-slate-500">{visibleEvents.length} events</span>
        </div>
        {loading && (
          <div className="text-center py-10 text-slate-400">
            Loading audit events...
          </div>
        )}
        {!loading && visibleEvents.length === 0 && (
          <div className="text-center py-10 text-slate-400">
            {events.length ? "No audit records match this event type." : "No audit records found."}
          </div>
        )}
          <div className="space-y-0">
          {visibleEvents.map((ev, i) => {
            const eventId = ev.id || `${ev.timestamp}-${i}`;
              const color = eventColor(ev.event_type);
            return (
              <article key={eventId} className="relative ml-2 border-l-2 pb-5 pl-6 last:pb-0" style={{ borderColor: `${color}45` }}>
                <span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full ring-4 ring-white" style={{ backgroundColor: color }} />
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xs font-extrabold tracking-wide" style={{ color }}>{eventTitle(ev)}</h3>
                      {ev.event_type === "chaos_event_applied" && <span className="rounded bg-orange-50 px-2 py-0.5 text-[9px] font-bold uppercase text-orange-800">Simulation</span>}
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-slate-800">{eventDescription(ev)}</p>
                  </div>
                  <time className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-slate-500" dateTime={ev.timestamp}>
                    <Clock size={12} /> {ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--"}
                  </time>
              </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-500">
                  <span className="inline-flex items-center gap-1"><UserCheck size={11} /> {ev.actor || ev.actor_id || "System"}</span>
                  {ev.entity_type && <span>{ev.entity_type.replace(/_/g, " ")}</span>}
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-[11px] font-semibold text-teal-800 hover:text-teal-950">View decision trace and technical evidence</summary>
                  <div className="mt-3 grid gap-3 rounded-lg bg-slate-50 p-3 text-[10px] sm:grid-cols-2">
                    <div><div className="font-bold uppercase text-slate-500">Event ID</div><div className="mt-1 break-all font-mono text-slate-800">{eventId}</div></div>
                    <div><div className="font-bold uppercase text-slate-500">Actor · Entity</div><div className="mt-1 break-all font-mono text-slate-800">{ev.actor || ev.actor_id} · {ev.entity_type}:{ev.entity_id}</div></div>
                    <div className="sm:col-span-2"><div className="font-bold uppercase text-slate-500">SHA-256 event hash</div><div className="mt-1 break-all font-mono text-slate-800">{ev.event_hash || ev.hash || "Unavailable"}</div></div>
                    <div className="sm:col-span-2"><div className="font-bold uppercase text-slate-500">Previous hash</div><div className="mt-1 break-all font-mono text-slate-800">{ev.previous_hash || "Unavailable"}</div></div>
                    <div className="sm:col-span-2"><div className="font-bold uppercase text-slate-500">Recorded payload</div><pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-slate-700">{JSON.stringify(ev.payload_json || ev.payload || {}, null, 2)}</pre></div>
                  </div>
                </details>
              </article>
            );})}
        </div>
        </section>
    </div>
  );
}
