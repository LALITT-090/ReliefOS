"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { ShieldCheck, Clock, RefreshCw, Key, Hash, UserCheck } from "lucide-react";

export default function AuditTimeline() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const res = await axios.get("http://localhost:8000/api/v1/audit");
      setEvents(res.data.events || []);
      setLoading(false);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex justify-between items-center bg-slate-800/80 p-5 rounded-xl border border-slate-700">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck size={24} className="text-emerald-400" />
            <h1 className="text-3xl font-bold text-white">Cryptographic Audit Trail</h1>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Immutable, append-only ledger of all state mutations, optimizer proposals, operator approvals, and chaos injections with SHA-256 hash chaining.
          </p>
        </div>
        <button
          onClick={loadData}
          className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 border border-slate-600"
          title="Refresh audit log"
        >
          <RefreshCw size={16} />
        </button>
      </div>
      
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl">
        {loading && (
          <div className="text-center py-10 text-slate-400">
            Verifying cryptographic hash chain...
          </div>
        )}
        {!loading && events.length === 0 && (
          <div className="text-center py-10 text-slate-400">
            No audit records found.
          </div>
        )}
        
        <div className="space-y-6">
          {events.map((ev, i) => (
            <div key={ev.id || i} className="relative pl-7 border-l-2 border-slate-700 pb-6 last:pb-0">
              <div className="absolute w-3.5 h-3.5 bg-blue-500 rounded-full -left-[8px] top-1 ring-4 ring-slate-800"></div>
              
              <div className="bg-slate-900/90 rounded-xl border border-slate-700 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-slate-800">
                  <span className="font-bold text-sm text-blue-400 uppercase tracking-wide">
                    {ev.event_type?.replace(/_/g, " ")}
                  </span>
                  <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> {ev.timestamp ? new Date(ev.timestamp).toLocaleString() : "--"}
                    </span>
                    <span className="flex items-center gap-1 text-emerald-400 font-sans">
                      <UserCheck size={12} /> {ev.actor || ev.actor_id}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-slate-300 font-mono">
                  <div className="text-[11px] text-slate-400 mb-1">Payload / State Delta:</div>
                  <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-[11px] text-slate-300 overflow-x-auto leading-relaxed">
                    {JSON.stringify(ev.payload_json || ev.payload, null, 2)}
                  </pre>
                </div>

                <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[10px] font-mono text-slate-500">
                  <span className="truncate">Entity Ref: {ev.entity_type}:{ev.entity_id}</span>
                  <span className="text-emerald-500/80 truncate">SHA-256 Hash: {ev.event_hash || ev.hash}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
