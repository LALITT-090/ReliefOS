type Coordinate = { lat: number; lon: number };

export default function OverviewMapPreview({
  twin,
  allocations,
}: {
  twin: any;
  allocations: any[];
}) {
  const nodes = twin.road_nodes || [];
  const zones = twin.zones || [];
  const hospitals = twin.hospitals || [];
  const ambulances = (twin.ambulances || []).filter((item: any) =>
    Number.isFinite(item.lat) && Number.isFinite(item.lon)
  );
  const coordinates: Coordinate[] = [
    ...nodes,
    ...zones,
    ...hospitals,
    ...ambulances,
  ].filter((item: any) => Number.isFinite(item.lat) && Number.isFinite(item.lon));

  if (coordinates.length === 0) {
    return <div className="map-loading-state">No geospatial data available.</div>;
  }

  const latitudes = coordinates.map((point) => point.lat);
  const longitudes = coordinates.map((point) => point.lon);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLon = Math.min(...longitudes);
  const maxLon = Math.max(...longitudes);
  const project = (point: Coordinate) => ({
    x: 40 + ((point.lon - minLon) / (maxLon - minLon || 1)) * 920,
    y: 40 + ((maxLat - point.lat) / (maxLat - minLat || 1)) * 520,
  });
  const nodeById = new Map(nodes.map((node: any) => [node.id, node]));
  const activeAllocations = allocations.filter((allocation: any) =>
    ["approved", "dispatched", "in_transit"].includes(allocation.status?.toLowerCase())
  );

  return (
    <div className="overview-map-preview" role="img" aria-label="Live road network, affected zones, hospitals, and active ambulance positions">
      <svg viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <defs>
          <pattern id="overview-map-grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#dce8e8" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="1000" height="600" fill="#f5f9f9" />
        <rect width="1000" height="600" fill="url(#overview-map-grid)" />
        {(twin.road_edges || []).map((edge: any) => {
          const from = nodeById.get(edge.from_node_id) as Coordinate | undefined;
          const to = nodeById.get(edge.to_node_id) as Coordinate | undefined;
          if (!from || !to) return null;
          const start = project(from);
          const end = project(to);
          const blocked = edge.status === "blocked" || edge.status === "closed";
          const risky = edge.status === "high_risk" || edge.risk_score > 0.5;
          return (
            <line
              key={edge.id}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke={blocked ? "#DC2626" : risky ? "#F59E0B" : "#8bb8b5"}
              strokeDasharray={blocked ? "8 7" : undefined}
              strokeWidth={blocked ? 5 : 3}
              strokeLinecap="round"
            />
          );
        })}
        {activeAllocations.map((allocation: any) => {
          const routePoints = (allocation.route_node_ids || [])
            .map((id: string) => nodeById.get(id))
            .filter((point: any) => point != null)
            .map((point: Coordinate) => {
              const projected = project(point);
              return `${projected.x},${projected.y}`;
            });
          if (routePoints.length < 2) return null;
          return <polyline key={allocation.id} points={routePoints.join(" ")} fill="none" stroke="#0EA5A4" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />;
        })}
        {zones.map((zone: any) => {
          const point = project(zone);
          const color = zone.severity === "critical" ? "#DC2626" : zone.severity === "high" ? "#F97316" : zone.severity === "moderate" ? "#F59E0B" : "#16A34A";
          return <circle key={zone.id} cx={point.x} cy={point.y} r="19" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="2"><title>{zone.name}: {zone.severity}</title></circle>;
        })}
        {hospitals.map((hospital: any) => {
          const point = project(hospital);
          return <rect key={hospital.id} x={point.x - 7} y={point.y - 7} width="14" height="14" rx="3" fill="#2563EB" stroke="white" strokeWidth="3"><title>{hospital.name}</title></rect>;
        })}
        {ambulances.map((ambulance: any) => {
          const point = project(ambulance);
          return <circle key={ambulance.id} cx={point.x} cy={point.y} r="6" fill="#0EA5A4" stroke="white" strokeWidth="3"><title>{ambulance.name || "Ambulance"}</title></circle>;
        })}
      </svg>
    </div>
  );
}