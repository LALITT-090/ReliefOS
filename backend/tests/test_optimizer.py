from copy import deepcopy

from app.optimization.optimizer import (
    AmbulanceVar,
    DemandItem,
    OptimizationEngine,
    OptimizationInput,
    SupplyItem,
)


def make_input(
    demands: list[DemandItem],
    *,
    ambulances: list[AmbulanceVar] | None = None,
    hospitals: list[dict] | None = None,
    medicine_supplies: list[SupplyItem] | None = None,
    road_nodes: list[dict] | None = None,
    road_edges: list[dict] | None = None,
    forecasts: list[dict] | None = None,
) -> OptimizationInput:
    return OptimizationInput(
        scenario_id="scenario",
        state_version=1,
        mode="balanced",
        ambulances=(
            [AmbulanceVar("ambulance", "A-1", "station", "available")]
            if ambulances is None else ambulances
        ),
        demands=demands,
        medicine_supplies=[] if medicine_supplies is None else medicine_supplies,
        hospitals=[] if hospitals is None else hospitals,
        road_nodes=road_nodes or [
            {"id": node, "name": node, "lat": 0.0, "lon": float(index)}
            for index, node in enumerate(("station", "zone-a", "zone-b", "hospital-a", "hospital-b"))
        ],
        road_edges=road_edges or [
            {
                "id": f"edge-{source}-{destination}",
                "from_node_id": source,
                "to_node_id": destination,
                "distance_km": 1.0,
                "base_travel_min": 1.0,
                "risk_score": 0.0,
                "status": "open",
            }
            for source, destination in (
                ("station", "zone-a"),
                ("station", "zone-b"),
                ("zone-a", "hospital-a"),
                ("zone-a", "hospital-b"),
                ("zone-b", "hospital-a"),
                ("zone-b", "hospital-b"),
            )
        ],
        forecasts=forecasts or [],
        weights={},
    )


def demand(zone: str, *, severity: str = "medium", resource: str = "ambulance") -> DemandItem:
    severity_weight = {"critical": 8.0, "high": 4.0, "medium": 2.0, "low": 1.0}[severity]
    return DemandItem(
        id=f"demand-{zone}",
        zone_id=zone,
        zone_name=zone,
        zone_road_node_id=zone,
        resource_type=resource,
        medicine_type_id=None,
        quantity=1,
        severity=severity,
        urgency="urgent",
        severity_weight=severity_weight,
    )


def test_severity_counterfactual_changes_globally_assigned_zone():
    engine = OptimizationEngine()
    low_a = demand("zone-a", severity="low")
    critical_b = demand("zone-b", severity="critical")
    baseline = make_input([low_a, critical_b])
    baseline_result = engine.generate_strategy(baseline)
    changed = deepcopy(baseline)
    changed.demands[0].severity = "critical"
    changed.demands[0].severity_weight = 8.0
    changed.demands[1].severity = "low"
    changed.demands[1].severity_weight = 1.0
    changed_result = engine.generate_strategy(changed)

    assert [item.destination_id for item in baseline_result.allocations] == ["zone-b"]
    assert [item.destination_id for item in changed_result.allocations] == ["zone-a"]


def test_hospital_capacity_counterfactual_uses_alternative_hospital():
    engine = OptimizationEngine()
    icu_demand = demand("zone-a", resource="icu_bed")
    hospitals = [
        {"id": "hospital-a", "name": "Near", "icu_available": 1, "road_node_id": "hospital-a"},
        {"id": "hospital-b", "name": "Alternative", "icu_available": 2, "road_node_id": "hospital-b"},
    ]
    baseline = make_input(
        [], hospitals=hospitals, road_nodes=[
            {"id": "zone-a", "lat": 0.0, "lon": 0.0},
            {"id": "hospital-a", "lat": 0.0, "lon": 1.0},
            {"id": "hospital-b", "lat": 0.0, "lon": 2.0},
        ], road_edges=[
            {"id": "a", "from_node_id": "zone-a", "to_node_id": "hospital-a", "distance_km": 1, "base_travel_min": 1, "risk_score": 0, "status": "open"},
            {"id": "b", "from_node_id": "zone-a", "to_node_id": "hospital-b", "distance_km": 2, "base_travel_min": 2, "risk_score": 0, "status": "open"},
        ])
    baseline.icu_demands = [icu_demand]
    baseline_result = engine.generate_strategy(baseline)
    changed = deepcopy(baseline)
    changed.hospitals[0]["icu_available"] = 0
    changed_result = engine.generate_strategy(changed)

    assert baseline_result.allocations[0].destination_id == "hospital-a"
    assert changed_result.allocations[0].destination_id == "hospital-b"


def test_ambulance_availability_counterfactual_removes_assignment():
    engine = OptimizationEngine()
    baseline = make_input([demand("zone-a")])
    assert len(engine.generate_strategy(baseline).allocations) == 1

    baseline.ambulances[0].status = "failed"
    changed_result = engine.generate_strategy(baseline)
    assert changed_result.allocations == []
    assert changed_result.unmet_demand == 1


def test_route_disruption_changes_path_and_estimated_travel_time():
    engine = OptimizationEngine()
    nodes = [{"id": node, "lat": 0.0, "lon": float(index)} for index, node in enumerate(("station", "detour", "zone-a"))]
    edges = [
        {"id": "direct", "from_node_id": "station", "to_node_id": "zone-a", "distance_km": 1, "base_travel_min": 12, "risk_score": 0, "status": "open"},
        {"id": "detour-1", "from_node_id": "station", "to_node_id": "detour", "distance_km": 2, "base_travel_min": 5, "risk_score": 0, "status": "open"},
        {"id": "detour-2", "from_node_id": "detour", "to_node_id": "zone-a", "distance_km": 2, "base_travel_min": 5, "risk_score": 0, "status": "open"},
    ]
    baseline = make_input([demand("zone-a")], road_nodes=nodes, road_edges=edges)
    baseline_result = engine.generate_strategy(baseline)
    changed = deepcopy(baseline)
    changed.road_edges[1]["status"] = "blocked"
    changed_result = engine.generate_strategy(changed)

    assert baseline_result.allocations[0].route_node_ids == ["station", "detour", "zone-a"]
    assert baseline_result.allocations[0].route_travel_min == 10
    assert changed_result.allocations[0].route_node_ids == ["station", "zone-a"]
    assert changed_result.allocations[0].route_travel_min == 12


def test_travel_time_changes_which_ambulance_is_assigned():
    engine = OptimizationEngine()
    inputs = make_input(
        [demand("zone-a")],
        ambulances=[
            AmbulanceVar("near-slow", "Near", "near-node", "available"),
            AmbulanceVar("far-fast", "Fast", "far-node", "available"),
        ],
        road_nodes=[
            {"id": node, "lat": 0.0, "lon": 0.0}
            for node in ("near-node", "far-node", "zone-a")
        ],
        road_edges=[
            {"id": "slow", "from_node_id": "near-node", "to_node_id": "zone-a", "distance_km": 1, "base_travel_min": 20, "risk_score": 0, "status": "open"},
            {"id": "fast", "from_node_id": "far-node", "to_node_id": "zone-a", "distance_km": 10, "base_travel_min": 2, "risk_score": 0, "status": "open"},
        ],
    )

    result = engine.generate_strategy(inputs)
    assert result.allocations[0].vehicle_id == "far-fast"
    assert result.allocations[0].route_travel_min == 2


def test_typed_medicine_availability_and_reserve_constrain_assignments():
    engine = OptimizationEngine()
    medicine_demand = demand("zone-a", resource="medicine")
    medicine_demand.quantity = 4
    medicine_demand.medicine_type_id = "antibiotic"
    inputs = make_input(
        [medicine_demand],
        medicine_supplies=[
            SupplyItem("central", "Central", "warehouse-a", None, "medicine", "antibiotic", 5, 3, None, None),
            SupplyItem("wrong-type", "Other type", "warehouse-b", None, "medicine", "analgesic", 100, 0, None, None),
        ],
        road_nodes=[
            {"id": node, "lat": 0.0, "lon": 0.0}
            for node in ("warehouse-a", "warehouse-b", "zone-a")
        ],
        road_edges=[
            {"id": "central", "from_node_id": "warehouse-a", "to_node_id": "zone-a", "distance_km": 1, "base_travel_min": 1, "risk_score": 0, "status": "open"},
            {"id": "other", "from_node_id": "warehouse-b", "to_node_id": "zone-a", "distance_km": 1, "base_travel_min": 1, "risk_score": 0, "status": "open"},
        ],
    )
    baseline = engine.generate_strategy(inputs)
    assert [(allocation.source_id, allocation.quantity) for allocation in baseline.allocations] == [("central", 2)]

    inputs.medicine_supplies[0].quantity_available = inputs.medicine_supplies[0].reserve_quantity
    inputs.medicine_supplies.append(
        SupplyItem("backup", "Backup", "warehouse-b", None, "medicine", "antibiotic", 6, 2, None, None)
    )
    changed = engine.generate_strategy(inputs)
    assert [(allocation.source_id, allocation.quantity) for allocation in changed.allocations] == [("backup", 4)]


def test_predicted_shortage_counterfactual_changes_assigned_zone():
    engine = OptimizationEngine()
    baseline = make_input([demand("zone-a"), demand("zone-b")])
    baseline.road_edges = [
        {
            **edge,
            "base_travel_min": 5 if edge["to_node_id"] == "zone-a" else 1,
        }
        for edge in baseline.road_edges
    ]
    baseline_result = engine.generate_strategy(baseline)
    changed = deepcopy(baseline)
    changed.forecasts = [{
        "resource_type": "ambulance",
        "zone_id": "zone-a",
        "predicted_demand": 10,
        "shortage_estimate": 10,
        "risk_level": "critical",
    }]
    changed_result = engine.generate_strategy(changed)

    assert [item.destination_id for item in baseline_result.allocations] == ["zone-b"]
    assert [item.destination_id for item in changed_result.allocations] == ["zone-a"]


def test_global_matching_reroutes_flexible_unit_for_constrained_zone():
    engine = OptimizationEngine()
    inputs = make_input(
        [demand("zone-a"), demand("zone-b")],
        ambulances=[
            AmbulanceVar("flexible", "A-1", "station", "available"),
            AmbulanceVar("constrained", "A-2", "detour", "available"),
        ],
        road_nodes=[
            {"id": node, "lat": 0.0, "lon": 0.0}
            for node in ("station", "detour", "zone-a", "zone-b")
        ],
        road_edges=[
            {"id": "flex-a", "from_node_id": "station", "to_node_id": "zone-a", "distance_km": 1, "base_travel_min": 1, "risk_score": 0, "status": "open"},
            {"id": "flex-b", "from_node_id": "station", "to_node_id": "zone-b", "distance_km": 1, "base_travel_min": 3, "risk_score": 0, "status": "open"},
            {"id": "constrained-a", "from_node_id": "detour", "to_node_id": "zone-a", "distance_km": 1, "base_travel_min": 2, "risk_score": 0, "status": "open"},
        ],
    )
    result = engine.generate_strategy(inputs)

    assert {
        (allocation.vehicle_id, allocation.destination_id)
        for allocation in result.allocations
    } == {("flexible", "zone-b"), ("constrained", "zone-a")}
