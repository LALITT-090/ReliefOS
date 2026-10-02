"use client";

import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useState } from 'react';
import axios from 'axios';

const iconHospital = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

export default function MapComponent() {
  const [twin, setTwin] = useState<any>(null);

  useEffect(() => {
    const loadData = () => {
      axios.get("http://localhost:8000/api/v1/twin")
        .then(res => setTwin(res.data))
        .catch(console.error);
    };
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

  if (!twin) return <div className="h-full flex items-center justify-center text-slate-400">Loading Situation Map...</div>;

  const nodeMap = new Map((twin.road_nodes || []).map((n: any) => [n.id, n]));

  // Center on zones
  const centerLat = twin.zones && twin.zones.length > 0 ? twin.zones[0].lat : 12.9716;
  const centerLon = twin.zones && twin.zones.length > 0 ? twin.zones[0].lon : 77.5946;
  const center: [number, number] = [centerLat, centerLon];

  return (
    <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%', minHeight: '600px' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Road Network Edges */}
      {twin.road_edges?.map((e: any) => {
        const fromNode: any = nodeMap.get(e.from_node_id);
        const toNode: any = nodeMap.get(e.to_node_id);
        if (!fromNode || !toNode) return null;
        const isBlocked = e.status === 'blocked' || e.status === 'closed';
        const isHighRisk = e.status === 'high_risk' || (e.risk_score && e.risk_score > 0.5);
        return (
          <Polyline
            key={e.id}
            positions={[[fromNode.lat, fromNode.lon], [toNode.lat, toNode.lon]]}
            pathOptions={{
              color: isBlocked ? '#ef4444' : isHighRisk ? '#f59e0b' : '#3b82f6',
              weight: isBlocked ? 5 : 3,
              dashArray: isBlocked ? '6, 8' : undefined,
              opacity: isBlocked ? 0.9 : 0.6
            }}
          >
            <Popup>
              <strong>Road Segment: {e.name || e.id.substring(0, 8)}</strong><br/>
              Status: <span style={{ color: isBlocked ? 'red' : 'green', fontWeight: 'bold' }}>{e.status?.toUpperCase()}</span><br/>
              Distance: {e.distance_km} km | Est. Travel: {e.base_travel_min} min
            </Popup>
          </Polyline>
        );
      })}

      {/* Road Nodes */}
      {twin.road_nodes?.map((n: any) => (
        <CircleMarker
          key={n.id}
          center={[n.lat, n.lon]}
          radius={4}
          pathOptions={{ color: '#64748b', fillColor: '#94a3b8', fillOpacity: 0.8 }}
        >
          <Popup>
            <strong>Node: {n.name}</strong><br/>
            ID: {n.id.substring(0, 8)}
          </Popup>
        </CircleMarker>
      ))}

      {/* Hospitals */}
      {twin.hospitals?.map((h: any) => (
        <Marker key={h.id} position={[h.lat, h.lon]} icon={iconHospital}>
          <Popup>
            <div style={{ minWidth: '160px' }}>
              <strong style={{ fontSize: '14px', color: '#1e3a8a' }}>{h.name}</strong><br/>
              <span style={{ fontSize: '12px', color: '#475569' }}>
                ICU Available: <strong>{h.icu_available}</strong> / {h.icu_total}<br/>
                Total Beds: {h.beds_available} / {h.beds_total}<br/>
                Status: {h.status}
              </span>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Zones */}
      {twin.zones?.map((z: any) => {
        const isCrit = z.severity === 'critical';
        const isHigh = z.severity === 'high';
        const color = isCrit ? '#ef4444' : isHigh ? '#f97316' : '#eab308';
        return (
          <Circle
            key={z.id}
            center={[z.lat, z.lon]}
            radius={1400}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.25, weight: 2 }}
          >
            <Popup>
              <div>
                <strong>{z.name}</strong><br/>
                Severity: <span style={{ color, fontWeight: 'bold' }}>{z.severity?.toUpperCase()}</span><br/>
                Affected Population: {z.affected_population?.toLocaleString()}<br/>
                Status: {z.status}
              </div>
            </Popup>
          </Circle>
        );
      })}
    </MapContainer>
  );
}
