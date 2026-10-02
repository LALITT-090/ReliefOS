"use client";

import { useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/lib/api";
import { AlertOctagon, Activity, Truck, Package, MapPin, Zap, RefreshCcw, CheckCircle } from "lucide-react";

export default function SimulationSandbox() {
  const [result, setResult] = useState<any>(null);
  const [loadingEvent, setLoadingEvent] = useState<string | null>(null);

  const triggerEvent = async (type: string, payload: any) => {
    setLoadingEvent(type);
    try {
      const res = await axios.post(`${API_BASE_URL}/v1/chaos/events`, {
        event_type: type,
        payload
      });
      setResult(res.data);
    } catch (err: any) {
      console.error(err);
      setResult({ error: err.response?.data?.detail || "Failed to trigger chaos event" });
    } finally {
      setLoadingEvent(null);
    }
  };

  const resetScenario = async () => {
    setLoadingEvent("reset");
    try {
      const res = await axios.post(`${API_BASE_URL}/v1/scenarios/00000000-0000-0000-0000-000000000001/load`);
      setResult({ status: "success", message: "Scenario reset to initial Urban Flood baseline state version 1", data: res.data });
    } catch (err: any) {
      console.error(err);
      setResult({ error: err.response?.data?.detail || "Failed to reset scenario" });
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
      icon: <Truck className="text-purple-400" />,
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

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Chaos & Failure Simulation Sandbox</h1>
          <p className="text-slate-400">Trigger real-world disruptions to test Digital Twin adaptation, impact analysis, and re-planning.</p>
        </div>
        <button
          onClick={resetScenario}
          disabled={loadingEvent !== null}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm font-semibold flex items-center gap-2 border border-slate-600 transition"
        >
          <RefreshCcw size={16} className={loadingEvent === "reset" ? "animate-spin" : ""} /> Reset Scenario
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {events.map(ev => (
          <div key={ev.id} className="bg-slate-800 p-5 rounded-xl border border-slate-700 hover:border-slate-500 transition flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-700">
                  {ev.icon}
                </div>
                <h3 className="font-bold text-white text-base">{ev.title}</h3>
              </div>
              <p className="text-xs text-slate-400 mb-5">{ev.desc}</p>
            </div>
            <button 
              onClick={() => triggerEvent(ev.id, ev.payload)}
              disabled={loadingEvent !== null}
              className="w-full py-2 bg-rose-950/70 hover:bg-rose-900 text-rose-200 rounded-lg border border-rose-800/80 text-xs font-semibold transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <AlertOctagon size={14} className={loadingEvent === ev.id ? "animate-spin" : ""} />
              {loadingEvent === ev.id ? "Applying Event..." : "Trigger Event"}
            </button>
          </div>
        ))}
      </div>

      {result && (
        <div className="p-5 bg-slate-900 rounded-xl border border-slate-700 space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-400">
            <CheckCircle size={16} /> Digital Twin State Mutated & Audited
          </div>
          <pre className="text-xs font-mono text-slate-300 bg-slate-950 p-4 rounded-lg overflow-x-auto border border-slate-800">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
