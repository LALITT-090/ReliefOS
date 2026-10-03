"use client";

import dynamic from 'next/dynamic';

const MapComponent = dynamic(() => import('@/components/MapComponent'), {
  ssr: false,
  loading: () => <div className="map-loading-state"><div className="map-loading-grid" /><span>Loading live map layers...</span></div>
});

export default function SituationMap() {
  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-teal-700">Live operational picture</div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Situation Map</h1>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium text-slate-600" aria-label="Map legend">
          <span className="map-legend-item"><i className="map-legend-dot" style={{ backgroundColor: "#DC2626" }} />Affected zone</span>
          <span className="map-legend-item"><i className="map-legend-dot" style={{ backgroundColor: "#2563EB" }} />Hospital</span>
          <span className="map-legend-item"><i className="map-legend-dot" style={{ backgroundColor: "#0EA5A4" }} />Ambulance / active route</span>
          <span className="map-legend-item"><i className="map-legend-line" style={{ backgroundColor: "#16A34A" }} />Open road</span>
          <span className="map-legend-item"><i className="map-legend-line" style={{ backgroundColor: "#F59E0B" }} />At risk</span>
          <span className="map-legend-item"><i className="map-legend-line" style={{ backgroundColor: "#DC2626" }} />Blocked</span>
        </div>
      </div>
      <p className="-mt-3 text-[10px] text-slate-500">SIMULATION DATA — Facility labels are scenario references; operational values are synthetic and do not imply a real incident.</p>
      <div className="flex-1 min-h-[520px] rounded-xl overflow-hidden border border-slate-200 shadow-sm">
        <MapComponent />
      </div>
    </div>
  );
}
