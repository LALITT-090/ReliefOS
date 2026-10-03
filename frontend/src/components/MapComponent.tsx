"use client";

import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useReliefData } from '@/components/ReliefDataContext';

const iconHospital = L.divIcon({
  className: "",
  html: '<span class="map-marker map-marker-hospital" role="img" aria-label="Hospital facility">H</span>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

const iconAmbulance = L.divIcon({
  className: "",
  html: '<span class="map-marker map-marker-ambulance" role="img" aria-label="Ambulance">A</span>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

export default function MapComponent({ compact = false }: { compact?: boolean }) {
  const { twin, allocations, loading, error } = useReliefData();

  if (!twin) return <div className="map-loading-state"><div className="map-loading-grid" /><span>{error ? "Unable to load map data." : loading ? "Loading live map data..." : "No map data available."}</span></div>;

  const nodeMap = new Map((twin.road_nodes || []).map((n: any) => [n.id, n]));

  // Center on zones
  const centerLat = twin.zones && twin.zones.length > 0 ? twin.zones[0].lat : 12.9716;
  const centerLon = twin.zones && twin.zones.length > 0 ? twin.zones[0].lon : 77.5946;
  const center: [number, number] = [centerLat, centerLon];

  return (
    <div className="relative h-full w-full" style={{ minHeight: compact ? '320px' : '520px' }}>
      {error && (
        <div role="status" className="absolute left-3 right-3 top-3 z-[1000] rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 shadow">
          Live map refresh failed. Showing the last successfully loaded snapshot.
        </div>
      )}
      <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }}>
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
              color: isBlocked ? '#DC2626' : isHighRisk ? '#F59E0B' : '#16A34A',
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

      {allocations.filter((allocation: any) =>
        ["approved", "dispatched", "in_transit"].includes(allocation.status?.toLowerCase()) &&
        allocation.route_node_ids?.length > 1
      ).map((allocation: any) => {
        const routePositions = allocation.route_node_ids
          .map((nodeId: string) => nodeMap.get(nodeId))
          .filter((node: any) => node != null)
          .map((node: any) => [node.lat, node.lon] as [number, number]);
        if (routePositions.length < 2) return null;
        return (
          <Polyline
            key={`route-${allocation.id}`}
            positions={routePositions}
            pathOptions={{ color: '#0EA5A4', weight: 6, opacity: 0.9 }}
          >
            <Popup>
              <strong>Active allocation route</strong><br />
              Resource: {allocation.resource_type?.replace("_", " ")} x{allocation.quantity}<br />
              Status: {allocation.status?.replace("_", " ").toUpperCase()}
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
            Reference: {n.id.substring(0, 8)}
          </Popup>
        </CircleMarker>
      ))}

      {/* Hospitals */}
      {twin.hospitals?.map((h: any) => (
        <Marker key={h.id} position={[h.lat, h.lon]} icon={iconHospital} title={`Hospital: ${h.name}`}>
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
        const isMedium = z.severity === 'medium';
        const color = isCrit ? '#DC2626' : isHigh ? '#F97316' : isMedium ? '#F59E0B' : '#16A34A';
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

      {twin.ambulances?.filter((ambulance: any) => Number.isFinite(ambulance.lat) && Number.isFinite(ambulance.lon)).map((ambulance: any) => (
        <Marker key={ambulance.id} position={[ambulance.lat, ambulance.lon]} icon={iconAmbulance} title={`Ambulance: ${ambulance.name || "Unit"}`}>
          <Popup>
            <strong>{ambulance.name || "Ambulance"}</strong><br />
            Status: {ambulance.availability_status?.replace("_", " ").toUpperCase()}
          </Popup>
        </Marker>
      ))}
      </MapContainer>
    </div>
  );
}
