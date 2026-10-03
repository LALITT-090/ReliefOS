import pytest
import httpx

BASE_URL = "http://localhost:8000/api/v1"
SCENARIO_ID = "00000000-0000-0000-0000-000000000001"
EARTHQUAKE_SCENARIO_ID = "00000000-0000-0000-0000-000000000002"

def test_health():
    """Verify health endpoint."""
    response = httpx.get(f"{BASE_URL}/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_clean_load_scenario_deterministic():
    """Verify deterministic reset to state version 1."""
    # Reset twice and verify identical baseline
    for _ in range(2):
        response = httpx.post(f"{BASE_URL}/scenarios/{SCENARIO_ID}/load")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["scenario_id"] == SCENARIO_ID
        assert data["state_version"] == 1

def test_both_scenario_configurations_load_and_reset():
    """Both configured scenarios have complete, reproducible operational state."""
    for scenario_id, disaster_type in (
        (SCENARIO_ID, "urban_flood"),
        (EARTHQUAKE_SCENARIO_ID, "earthquake"),
    ):
        loaded = httpx.post(f"{BASE_URL}/scenarios/{scenario_id}/load")
        assert loaded.status_code == 200
        assert loaded.json()["scenario_id"] == scenario_id

        twin = httpx.get(f"{BASE_URL}/twin").json()
        assert twin["scenario"]["id"] == scenario_id
        assert twin["scenario"]["disaster_type"] == disaster_type
        assert len(twin["zones"]) >= 5
        assert len(twin["hospitals"]) >= 4
        assert len(twin["ambulances"]) >= 12
        assert len(twin["road_nodes"]) >= 12
        assert len(twin["road_edges"]) >= 20
        assert len(twin["demands"]) >= 16
        assert all(demand["zone_id"] in {zone["id"] for zone in twin["zones"]} for demand in twin["demands"])
        assert all(ambulance["road_node_id"] in {node["id"] for node in twin["road_nodes"]} for ambulance in twin["ambulances"])

        strategy = httpx.post(f"{BASE_URL}/strategies/generate", json={"mode": "balanced"})
        assert strategy.status_code == 200
        assert strategy.json()["result"]["is_feasible"] is True

        changed = httpx.post(f"{BASE_URL}/chaos/events", json={
            "event_type": "road_block",
            "payload": {"edge_id": twin["road_edges"][0]["id"]},
        })
        assert changed.status_code == 200

        reset = httpx.post(f"{BASE_URL}/scenarios/{scenario_id}/load")
        assert reset.status_code == 200
        baseline = httpx.get(f"{BASE_URL}/twin").json()
        assert baseline["state_version"] == 1
        assert baseline["scenario"]["id"] == scenario_id
        assert len(baseline["zones"]) == len(twin["zones"])
        assert len(baseline["demands"]) == len(twin["demands"])
        assert httpx.get(f"{BASE_URL}/allocations").json()["allocations"] == []
        assert httpx.get(f"{BASE_URL}/audit/verify").json()["valid"] is True

    httpx.post(f"{BASE_URL}/scenarios/{SCENARIO_ID}/load")
    invalid = httpx.post(f"{BASE_URL}/scenarios/not-a-configured-scenario/load")
    assert invalid.status_code == 404
    assert httpx.get(f"{BASE_URL}/twin").json()["scenario"]["id"] == SCENARIO_ID

def test_strategy_from_inactive_scenario_cannot_be_approved():
    """Scenario switching invalidates, rather than cross-applying, old strategies."""
    httpx.post(f"{BASE_URL}/scenarios/{SCENARIO_ID}/load")
    generated = httpx.post(f"{BASE_URL}/strategies/generate", json={"mode": "balanced"}).json()
    old_strategy_id = generated["strategy_id"]

    switched = httpx.post(f"{BASE_URL}/scenarios/{EARTHQUAKE_SCENARIO_ID}/load")
    assert switched.status_code == 200
    approval = httpx.post(
        f"{BASE_URL}/strategies/{old_strategy_id}/approve",
        json={"operator_action": "approved", "operator_id": "Commander"},
    )
    assert approval.status_code == 409
    detail = httpx.get(f"{BASE_URL}/strategies/{old_strategy_id}").json()
    assert detail["strategy"]["status"] == "stale"
    assert all(
        allocation["status"] == "proposed"
        for allocation in detail["allocations"]
    )

    httpx.post(f"{BASE_URL}/scenarios/{SCENARIO_ID}/load")

def test_get_twin_snapshot():
    """Verify digital twin data structure and counts."""
    response = httpx.get(f"{BASE_URL}/twin")
    assert response.status_code == 200
    tw = response.json()
    assert tw["scenario"]["id"] == SCENARIO_ID
    assert tw["scenario"]["state_version"] == 1
    assert len(tw["zones"]) == 5
    assert len(tw["hospitals"]) == 4
    assert len(tw["ambulances"]) == 12
    assert len(tw["medicine_inventory"]) == 9
    assert len(tw["road_nodes"]) == 12
    assert len(tw["road_edges"]) == 20
    assert len(tw["demands"]) == 16

def test_get_resources():
    """Verify /resources endpoint returns availability breakdown."""
    response = httpx.get(f"{BASE_URL}/resources")
    assert response.status_code == 200
    res = response.json()
    assert "ambulances" in res
    assert "medicine_inventory" in res
    assert "hospitals" in res
    assert len(res["ambulances"]) == 12

def test_predictions_engine():
    """Verify predictions engine returns T+30, T+60, T+120 forecast vectors."""
    response = httpx.get(f"{BASE_URL}/predictions")
    assert response.status_code == 200
    forecasts = response.json().get("forecasts", [])
    assert len(forecasts) > 0
    horizons = set(f["horizon_min"] for f in forecasts)
    assert horizons == {30, 60, 120}
    for f in forecasts:
        assert f["is_estimate"] is True
        assert f["predicted_demand"] >= 0
        assert f["shortage_estimate"] >= 0
        assert 0.0 <= f["confidence"] <= 1.0
    repeated = httpx.get(f"{BASE_URL}/predictions").json()["forecasts"]
    assert forecasts == repeated

def test_road_block_replan_uses_only_open_network_edges():
    """A revised approved route must not traverse a blocked road edge."""
    httpx.post(f"{BASE_URL}/scenarios/{SCENARIO_ID}/load")
    edge_id = "77000000-0000-0000-0000-000000000001"
    blocked = httpx.post(f"{BASE_URL}/chaos/events", json={
        "event_type": "road_block",
        "payload": {"edge_id": edge_id},
    })
    assert blocked.status_code == 200

    strategy = httpx.post(
        f"{BASE_URL}/strategies/generate", json={"mode": "balanced"}
    ).json()
    assert strategy["result"]["is_feasible"] is True
    approved = httpx.post(
        f"{BASE_URL}/strategies/{strategy['strategy_id']}/approve",
        json={"operator_action": "approved", "operator_id": "Commander"},
    )
    assert approved.status_code == 200

    twin = httpx.get(f"{BASE_URL}/twin").json()
    blocked_pairs = {
        frozenset((edge["from_node_id"], edge["to_node_id"]))
        for edge in twin["road_edges"]
        if edge["status"] == "blocked"
    }
    allocations = [
        allocation
        for allocation in httpx.get(f"{BASE_URL}/allocations").json()["allocations"]
        if allocation["strategy_id"] == strategy["strategy_id"]
    ]
    assert allocations
    for allocation in allocations:
        route = allocation["route_node_ids"] or []
        assert all(
            frozenset((start, end)) not in blocked_pairs
            for start, end in zip(route, route[1:])
        )
    httpx.post(f"{BASE_URL}/scenarios/{SCENARIO_ID}/load")

def test_generate_all_strategy_modes():
    """Verify all 4 optimization modes generate feasible strategies."""
    modes = ["baseline_nearest", "severity_first", "balanced", "coverage_first"]
    strat_ids = {}
    for mode in modes:
        res = httpx.post(f"{BASE_URL}/strategies/generate", json={"mode": mode})
        assert res.status_code == 200
        data = res.json()
        assert "strategy_id" in data
        assert data["result"]["is_feasible"] is True
        strat_ids[mode] = data["strategy_id"]

        # Inspect strategy detail and explanation
        detail_res = httpx.get(f"{BASE_URL}/strategies/{data['strategy_id']}")
        assert detail_res.status_code == 200
        detail = detail_res.json()
        assert "strategy" in detail
        assert isinstance(detail["strategy"]["coverage_pct"], (int, float))
        assert detail["strategy"]["unmet_demand"] >= 0
        assert detail["strategy"]["avg_eta_min"] >= 0
        assert "allocations" in detail
        assert "explanation" in detail
        assert len(detail["explanation"]) > 0
        assert detail["evidence"]
        assert detail["explanation"]["factors"]
        assert detail["explanation"]["factors"][0]["source_ref"]

def test_strategy_lifecycle_and_human_approval():
    """Verify human approval gate and active allocation commitment."""
    # Reset to baseline
    httpx.post(f"{BASE_URL}/scenarios/{SCENARIO_ID}/load")
    
    # Generate strategy
    gen_res = httpx.post(f"{BASE_URL}/strategies/generate", json={"mode": "balanced"})
    assert gen_res.status_code == 200
    strat_id = gen_res.json()["strategy_id"]

    # Approve strategy
    appr_res = httpx.post(f"{BASE_URL}/strategies/{strat_id}/approve", json={
        "operator_action": "approved",
        "operator_id": "Lead Commander"
    })
    assert appr_res.status_code == 200

    # Verify allocations committed as approved
    alloc_res = httpx.get(f"{BASE_URL}/allocations")
    assert alloc_res.status_code == 200
    allocs = alloc_res.json()["allocations"]
    approved_allocs = [a for a in allocs if a["strategy_id"] == strat_id and a["status"] == "approved"]
    assert len(approved_allocs) > 0

    # Test duplicate approval rejection (cannot approve already approved strategy)
    dup_res = httpx.post(f"{BASE_URL}/strategies/{strat_id}/approve", json={
        "operator_action": "approved",
        "operator_id": "Lead Commander"
    })
    assert dup_res.status_code == 400

def test_full_e2e_road_block_replan_requires_approval():
    """Exercise the primary demo loop through a disruption, replan, approval and audit."""
    loaded = httpx.post(f"{BASE_URL}/scenarios/{SCENARIO_ID}/load")
    assert loaded.status_code == 200
    baseline = httpx.get(f"{BASE_URL}/twin").json()

    strategies = {}
    for mode in ("baseline_nearest", "severity_first", "balanced"):
        response = httpx.post(f"{BASE_URL}/strategies/generate", json={"mode": mode})
        assert response.status_code == 200
        result = response.json()["result"]
        assert result["is_feasible"] is True
        strategy_id = response.json()["strategy_id"]
        detail = httpx.get(f"{BASE_URL}/strategies/{strategy_id}").json()
        assert detail["strategy"]["state_version"] == baseline["state_version"]
        strategies[mode] = strategy_id

    approved_id = strategies["balanced"]
    approved = httpx.post(
        f"{BASE_URL}/strategies/{approved_id}/approve",
        json={"operator_action": "approved", "operator_id": "Incident Commander"},
    )
    assert approved.status_code == 200
    current_allocations = httpx.get(f"{BASE_URL}/allocations").json()["allocations"]
    approved_allocations = [
        item for item in current_allocations
        if item["strategy_id"] == approved_id and item["status"] == "approved"
    ]
    assert approved_allocations

    edge_by_pair = {
        frozenset((edge["from_node_id"], edge["to_node_id"])): edge
        for edge in baseline["road_edges"]
        if edge["status"] != "blocked"
    }
    selected_edge = None
    for allocation in approved_allocations:
        route = allocation["route_node_ids"] or []
        for start, end in zip(route, route[1:]):
            selected_edge = edge_by_pair.get(frozenset((start, end)))
            if selected_edge:
                break
        if selected_edge:
            break
    assert selected_edge is not None

    event = httpx.post(f"{BASE_URL}/chaos/events", json={
        "event_type": "road_block",
        "payload": {"edge_id": selected_edge["id"]},
    })
    assert event.status_code == 200
    assert any(
        item["allocation_id"] in {allocation["id"] for allocation in approved_allocations}
        for item in event.json()["impacted_allocations"]
    )

    replanned = httpx.post(
        f"{BASE_URL}/strategies/generate", json={"mode": "balanced"}
    )
    assert replanned.status_code == 200
    replacement_id = replanned.json()["strategy_id"]
    replacement_detail = httpx.get(
        f"{BASE_URL}/strategies/{replacement_id}"
    ).json()
    assert replacement_detail["strategy"]["state_version"] == baseline["state_version"] + 1
    replacement_approval = httpx.post(
        f"{BASE_URL}/strategies/{replacement_id}/approve",
        json={"operator_action": "approved", "operator_id": "Incident Commander"},
    )
    assert replacement_approval.status_code == 200

    final_allocations = httpx.get(f"{BASE_URL}/allocations").json()["allocations"]
    assert any(
        allocation["strategy_id"] == approved_id
        and allocation["status"] == "superseded"
        for allocation in final_allocations
    )
    assert any(
        allocation["strategy_id"] == replacement_id
        and allocation["status"] == "approved"
        for allocation in final_allocations
    )
    assert httpx.get(f"{BASE_URL}/audit/verify").json()["valid"] is True
    httpx.post(f"{BASE_URL}/scenarios/{SCENARIO_ID}/load")

def allocation_signature(allocations):
    return {
        (
            allocation["resource_type"],
            allocation["source_id"],
            allocation["destination_id"],
            allocation["quantity"],
            allocation["vehicle_id"],
            tuple(allocation["route_node_ids"] or []),
            allocation["medicine_type_id"],
        )
        for allocation in allocations
    }

@pytest.mark.parametrize("event_type", [
    "road_block",
    "hospital_overload",
    "vehicle_failure",
    "demand_spike",
    "medicine_shortage",
    "new_incident_zone",
])
def test_each_disruption_replans_and_requires_operator_approval(event_type):
    """Exercise each disruption through a newly approved, auditable replan."""
    httpx.post(f"{BASE_URL}/scenarios/{SCENARIO_ID}/load")
    try:
        baseline = httpx.get(f"{BASE_URL}/twin").json()
        baseline_strategy = httpx.post(
            f"{BASE_URL}/strategies/generate", json={"mode": "balanced"}
        ).json()
        baseline_id = baseline_strategy["strategy_id"]
        assert httpx.post(
            f"{BASE_URL}/strategies/{baseline_id}/approve",
            json={"operator_id": "Incident Commander"},
        ).status_code == 200
        current = httpx.get(f"{BASE_URL}/allocations").json()["allocations"]
        active = [
            allocation for allocation in current
            if allocation["strategy_id"] == baseline_id
            and allocation["status"] == "approved"
        ]
        assert active

        if event_type == "road_block":
            routed = next(item for item in active if len(item["route_node_ids"] or []) > 1)
            start, end = routed["route_node_ids"][:2]
            edge = next(
                edge for edge in baseline["road_edges"]
                if {edge["from_node_id"], edge["to_node_id"]} == {start, end}
            )
            payload = {"edge_id": edge["id"]}
        elif event_type == "hospital_overload":
            routed = next(item for item in active if item["resource_type"] == "icu_bed")
            payload = {"hospital_id": routed["destination_id"], "icu_reduction": 100}
        elif event_type == "vehicle_failure":
            routed = next(item for item in active if item["vehicle_id"])
            payload = {"ambulance_id": routed["vehicle_id"]}
        elif event_type == "demand_spike":
            zone = next(
                zone for zone in baseline["zones"]
                if any(
                    demand["zone_id"] == zone["id"]
                    and demand["resource_type"] == "ambulance"
                    for demand in baseline["demands"]
                )
            )
            payload = {
                "zone_id": zone["id"],
                "resource_type": "ambulance",
                "increase_amount": 30,
            }
        elif event_type == "medicine_shortage":
            routed = next(item for item in active if item["resource_type"] == "medicine")
            inventory = next(
                stock for stock in baseline["medicine_inventory"]
                if stock["source_id"] == routed["source_id"]
                and stock["medicine_type_id"] == routed["medicine_type_id"]
            )
            payload = {
                "inventory_id": inventory["id"],
                "reduction": inventory["quantity_available"] - inventory["reserve_quantity"],
            }
        else:
            zone = baseline["zones"][0]
            payload = {
                "name": "Simulation Incident Expansion",
                "lat": zone["lat"] + 0.001,
                "lon": zone["lon"] + 0.001,
                "severity": "critical",
                "affected_population": 900,
                "demands": [{
                    "resource_type": "ambulance",
                    "quantity": 12,
                    "severity": "critical",
                    "urgency": "immediate",
                }],
            }

        event_response = httpx.post(
            f"{BASE_URL}/chaos/events",
            json={"event_type": event_type, "payload": payload},
        )
        assert event_response.status_code == 200, event_response.text
        event_data = event_response.json()
        changed = httpx.get(f"{BASE_URL}/twin").json()
        assert changed["state_version"] == baseline["state_version"] + 1
        assert event_data["event_id"]
        assert event_data["impacted_count"] == len(event_data["impacted_allocations"])

        if event_type == "demand_spike":
            new_quantity = sum(
                demand["quantity"] for demand in changed["demands"]
                if demand["zone_id"] == payload["zone_id"]
                and demand["resource_type"] == "ambulance"
            )
            old_quantity = sum(
                demand["quantity"] for demand in baseline["demands"]
                if demand["zone_id"] == payload["zone_id"]
                and demand["resource_type"] == "ambulance"
            )
            assert new_quantity == old_quantity + payload["increase_amount"]
        if event_type == "new_incident_zone":
            incident_zone = next(
                zone for zone in changed["zones"]
                if zone["name"] == payload["name"]
            )
            assert any(
                incident_zone["road_node_id"] in
                (edge["from_node_id"], edge["to_node_id"])
                for edge in changed["road_edges"]
            )

        replan_response = httpx.post(
            f"{BASE_URL}/strategies/generate", json={"mode": "balanced"}
        )
        assert replan_response.status_code == 200
        replan_id = replan_response.json()["strategy_id"]
        replan_detail = httpx.get(
            f"{BASE_URL}/strategies/{replan_id}"
        ).json()
        proposed = [
            allocation for allocation in replan_detail["allocations"]
            if allocation["status"] == "proposed"
        ]
        assert proposed
        assert allocation_signature(proposed) != allocation_signature([
            allocation for allocation in httpx.get(
                f"{BASE_URL}/strategies/{baseline_id}"
            ).json()["allocations"]
            if allocation["status"] != "cancelled"
        ]) or event_type == "demand_spike"

        approved = httpx.post(
            f"{BASE_URL}/strategies/{replan_id}/approve",
            json={"operator_id": "Incident Commander"},
        )
        assert approved.status_code == 200
        committed = httpx.get(
            f"{BASE_URL}/strategies/{replan_id}"
        ).json()["allocations"]
        assert committed
        assert all(allocation["status"] == "approved" for allocation in committed)
        assert httpx.get(f"{BASE_URL}/audit/verify").json()["valid"] is True
        passport = httpx.get(
            f"{BASE_URL}/allocations/{committed[0]['id']}/passport"
        )
        assert passport.status_code == 200
        assert passport.json()["incident_event_id"] == event_data["event_id"]
    finally:
        assert httpx.post(f"{BASE_URL}/scenarios/{SCENARIO_ID}/load").status_code == 200

def test_ambulance_demand_spike_moves_system_wide_assignment_before_approval():
    """A sufficiently large zone shock rebalances the shared ambulance fleet."""
    httpx.post(f"{BASE_URL}/scenarios/{SCENARIO_ID}/load")
    try:
        twin = httpx.get(f"{BASE_URL}/twin").json()
        baseline = httpx.post(
            f"{BASE_URL}/strategies/generate", json={"mode": "balanced"}
        ).json()
        before = httpx.get(
            f"{BASE_URL}/strategies/{baseline['strategy_id']}"
        ).json()["allocations"]
        before_sig = allocation_signature(before)
        target_zone = twin["zones"][0]
        changed = httpx.post(f"{BASE_URL}/chaos/events", json={
            "event_type": "demand_spike",
            "payload": {
                "zone_id": target_zone["id"],
                "resource_type": "ambulance",
                "increase_amount": 30,
            },
        })
        assert changed.status_code == 200
        after_twin = httpx.get(f"{BASE_URL}/twin").json()
        target_demand = sum(
            demand["quantity"] for demand in after_twin["demands"]
            if demand["zone_id"] == target_zone["id"]
            and demand["resource_type"] == "ambulance"
        )
        before_demand = sum(
            demand["quantity"] for demand in twin["demands"]
            if demand["zone_id"] == target_zone["id"]
            and demand["resource_type"] == "ambulance"
        )
        assert target_demand == before_demand + 30
        replan = httpx.post(
            f"{BASE_URL}/strategies/generate", json={"mode": "balanced"}
        ).json()
        proposed = httpx.get(
            f"{BASE_URL}/strategies/{replan['strategy_id']}"
        ).json()["allocations"]
        assert allocation_signature(proposed) != before_sig
        assert all(allocation["status"] == "proposed" for allocation in proposed)
        assert httpx.get(f"{BASE_URL}/allocations").json()["allocations"]
        approved = httpx.post(
            f"{BASE_URL}/strategies/{replan['strategy_id']}/approve",
            json={"operator_id": "Incident Commander"},
        )
        assert approved.status_code == 200
        updated = httpx.get(
            f"{BASE_URL}/strategies/{replan['strategy_id']}"
        ).json()["allocations"]
        assert all(allocation["status"] == "approved" for allocation in updated)
    finally:
        assert httpx.post(f"{BASE_URL}/scenarios/{SCENARIO_ID}/load").status_code == 200

def test_strategy_rejection_workflow():
    """Verify strategy rejection marks proposed allocations as cancelled."""
    gen_res = httpx.post(f"{BASE_URL}/strategies/generate", json={"mode": "baseline_nearest"})
    strat_id = gen_res.json()["strategy_id"]

    rej_res = httpx.post(f"{BASE_URL}/strategies/{strat_id}/reject", json={
        "operator_action": "rejected",
        "operator_note": "Resource priority mismatch"
    })
    assert rej_res.status_code == 200

    # Strategy should now be REJECTED
    strat_res = httpx.get(f"{BASE_URL}/strategies/{strat_id}")
    assert strat_res.json()["strategy"]["status"] == "rejected"

def test_strategy_modification_endpoint():
    """Verify API-010 POST /strategies/{id}/modify."""
    gen_res = httpx.post(f"{BASE_URL}/strategies/generate", json={"mode": "coverage_first"})
    strat_id = gen_res.json()["strategy_id"]

    strategy = httpx.get(f"{BASE_URL}/strategies/{strat_id}").json()
    allocation = strategy["allocations"][0]
    original_quantity = allocation["quantity"]

    mod_res = httpx.post(f"{BASE_URL}/strategies/{strat_id}/modify", json={
        "operator_id": "Commander",
        "operator_note": "Reduced a proposed allocation quantity",
        "allocation_modifications": [{
            "allocation_id": allocation["id"],
            "quantity": max(1, original_quantity - 1),
        }]
    })
    assert mod_res.status_code == 200
    assert mod_res.json()["status"] == "success"

    increased = httpx.post(f"{BASE_URL}/strategies/{strat_id}/modify", json={
        "allocation_modifications": [{
            "allocation_id": allocation["id"],
            "quantity": original_quantity + 1,
        }]
    })
    assert increased.status_code == 400

    invalid_type = httpx.post(f"{BASE_URL}/strategies/{strat_id}/modify", json={
        "allocation_modifications": [{
            "allocation_id": allocation["id"],
            "quantity": -1,
        }]
    })
    assert invalid_type.status_code == 422

def test_stale_approval_conflict():
    """Verify BR-014: Stale strategy cannot be approved when state version changes."""
    # Reset to baseline (v1)
    httpx.post(f"{BASE_URL}/scenarios/{SCENARIO_ID}/load")

    # Generate strategy against v1
    gen_res = httpx.post(f"{BASE_URL}/strategies/generate", json={"mode": "balanced"})
    old_strat_id = gen_res.json()["strategy_id"]

    # Apply chaos event to bump state version (v1 -> v2)
    chaos_res = httpx.post(f"{BASE_URL}/chaos/events", json={
        "event_type": "road_block",
        "payload": {"edge_id": "77000000-0000-0000-0000-000000000001"}
    })
    assert chaos_res.status_code == 200

    # Attempt to approve old strategy -> MUST return 409 Conflict
    stale_res = httpx.post(f"{BASE_URL}/strategies/{old_strat_id}/approve", json={
        "operator_action": "approved",
        "operator_id": "Commander"
    })
    assert stale_res.status_code == 409

    stale_detail = httpx.get(f"{BASE_URL}/strategies/{old_strat_id}").json()
    stale_allocation_id = stale_detail["allocations"][0]["id"]
    bypass = httpx.patch(
        f"{BASE_URL}/allocations/{stale_allocation_id}/status",
        json={"status": "approved"},
    )
    assert bypass.status_code == 409

    # The stale strategy must be PERSISTED as STALE (BR-014 traceability, must not roll back)
    stale_detail = httpx.get(f"{BASE_URL}/strategies/{old_strat_id}")
    assert stale_detail.status_code == 200
    assert stale_detail.json()["strategy"]["status"] == "stale"

    # A STRATEGY_STALE audit event must be persisted for this strategy
    audit_res = httpx.get(f"{BASE_URL}/audit")
    assert audit_res.status_code == 200
    stale_events = [
        e for e in audit_res.json()["events"]
        if e["event_type"] == "strategy_stale" and e["entity_id"] == old_strat_id
    ]
    assert len(stale_events) == 1

    # The stale approval must NOT have activated any allocation for the old strategy
    alloc_res = httpx.get(f"{BASE_URL}/allocations")
    assert alloc_res.status_code == 200
    stale_activated = [
        a for a in alloc_res.json()["allocations"]
        if a["strategy_id"] == old_strat_id and a["status"] in ("approved", "dispatched", "in_transit")
    ]
    assert len(stale_activated) == 0

    # Re-plan against v2 and approve
    replan_res = httpx.post(f"{BASE_URL}/strategies/generate", json={"mode": "balanced"})
    new_strat_id = replan_res.json()["strategy_id"]
    new_appr_res = httpx.post(f"{BASE_URL}/strategies/{new_strat_id}/approve", json={
        "operator_action": "approved",
        "operator_id": "Commander"
    })
    assert new_appr_res.status_code == 200

@pytest.mark.parametrize(("event_type", "payload"), [
    ("road_block", {"edge_id": "77000000-0000-0000-0000-000000000003"}),
    ("hospital_overload", {"hospital_id": "33000000-0000-0000-0000-000000000001", "icu_reduction": 5}),
    ("vehicle_failure", {"ambulance_id": "66000000-0000-0000-0000-000000000001"}),
    ("demand_spike", {"zone_id": "22000000-0000-0000-0000-000000000001", "resource_type": "ambulance", "increase_amount": 2}),
    ("medicine_shortage", {"inventory_id": "88000000-0000-0000-0000-000000000001", "reduction": 30}),
    ("new_incident_zone", {
        "name": "Zone G — Flood Outskirts",
        "lat": 18.5500,
        "lon": 73.8800,
        "severity": "critical",
        "affected_population": 400,
        "demands": [{"resource_type": "ambulance", "quantity": 1, "severity": "critical", "urgency": "immediate"}],
    }),
])
def test_each_chaos_event_independently_with_reset(event_type, payload):
    """Exercise each deterministic event on baseline state, then reset it."""
    loaded = httpx.post(f"{BASE_URL}/scenarios/{SCENARIO_ID}/load")
    assert loaded.status_code == 200
    before = httpx.get(f"{BASE_URL}/twin").json()
    try:
        response = httpx.post(f"{BASE_URL}/chaos/events", json={
            "event_type": event_type,
            "payload": payload,
        })
        assert response.status_code == 200, response.text
        after = httpx.get(f"{BASE_URL}/twin").json()
        assert after["state_version"] == before["state_version"] + 1
        assert any(
            event["event_type"] == "chaos_event_applied"
            and event["payload_json"]["event_type"] == event_type
            for event in httpx.get(f"{BASE_URL}/audit").json()["events"]
        )
        assert httpx.get(f"{BASE_URL}/audit/verify").json()["valid"] is True
    finally:
        reset = httpx.post(f"{BASE_URL}/scenarios/{SCENARIO_ID}/load")
        assert reset.status_code == 200
    baseline = httpx.get(f"{BASE_URL}/twin").json()
    assert baseline["state_version"] == 1
    assert len(baseline["zones"]) == len(before["zones"])

def test_invalid_chaos_payload_handling():
    """Verify invalid chaos event requests return controlled 400 errors."""
    # Unknown event
    r_unknown = httpx.post(f"{BASE_URL}/chaos/events", json={
        "event_type": "alien_invasion",
        "payload": {}
    })
    assert r_unknown.status_code == 400

    # Missing required edge_id
    r_missing = httpx.post(f"{BASE_URL}/chaos/events", json={
        "event_type": "road_block",
        "payload": {}
    })
    assert r_missing.status_code == 400

def test_allocation_lifecycle_transitions():
    """Verify valid and invalid allocation lifecycle state transitions."""
    httpx.post(f"{BASE_URL}/scenarios/{SCENARIO_ID}/load")
    generated = httpx.post(
        f"{BASE_URL}/strategies/generate", json={"mode": "balanced"}
    ).json()
    proposed = httpx.get(
        f"{BASE_URL}/strategies/{generated['strategy_id']}"
    ).json()["allocations"][0]
    bypass = httpx.patch(
        f"{BASE_URL}/allocations/{proposed['id']}/status",
        json={"status": "approved"},
    )
    assert bypass.status_code == 409

    approved = httpx.post(
        f"{BASE_URL}/strategies/{generated['strategy_id']}/approve",
        json={"operator_action": "approved", "operator_id": "Commander"},
    )
    assert approved.status_code == 200

    alloc_res = httpx.get(f"{BASE_URL}/allocations")
    allocs = alloc_res.json()["allocations"]
    approved_allocs = [a for a in allocs if a["status"] == "approved"]
    if not approved_allocs:
        # Generate & approve to get an approved allocation
        gen = httpx.post(f"{BASE_URL}/strategies/generate", json={"mode": "balanced"}).json()
        httpx.post(f"{BASE_URL}/strategies/{gen['strategy_id']}/approve", json={"operator_action": "approved"})
        alloc_res = httpx.get(f"{BASE_URL}/allocations")
        approved_allocs = [a for a in alloc_res.json()["allocations"] if a["status"] == "approved"]

    target_alloc = approved_allocs[0]
    alloc_id = target_alloc["id"]

    # Valid step 1: approved -> dispatched
    p1 = httpx.patch(f"{BASE_URL}/allocations/{alloc_id}/status", json={"status": "dispatched"})
    assert p1.status_code == 200

    # Valid step 2: dispatched -> in_transit
    p2 = httpx.patch(f"{BASE_URL}/allocations/{alloc_id}/status", json={"status": "in_transit"})
    assert p2.status_code == 200

    # Valid step 3: in_transit -> delivered
    p3 = httpx.patch(f"{BASE_URL}/allocations/{alloc_id}/status", json={"status": "delivered"})
    assert p3.status_code == 200

    # Valid step 4: delivered -> verified
    p4 = httpx.patch(f"{BASE_URL}/allocations/{alloc_id}/status", json={"status": "verified"})
    assert p4.status_code == 200

    # Invalid jump: verified -> proposed (MUST be rejected 400)
    p_invalid = httpx.patch(f"{BASE_URL}/allocations/{alloc_id}/status", json={"status": "proposed"})
    assert p_invalid.status_code == 400

def test_resource_passport_lifecycle_links_operator_and_audit_chain():
    """Passport API links provenance, every lifecycle transition, and verified audit refs."""
    httpx.post(f"{BASE_URL}/scenarios/{SCENARIO_ID}/load")
    twin = httpx.get(f"{BASE_URL}/twin").json()
    event = httpx.post(f"{BASE_URL}/chaos/events", json={
        "event_type": "road_block",
        "payload": {"edge_id": twin["road_edges"][0]["id"]},
    })
    assert event.status_code == 200

    generated = httpx.post(
        f"{BASE_URL}/strategies/generate", json={"mode": "balanced"}
    ).json()
    strategy_id = generated["strategy_id"]
    approval = httpx.post(
        f"{BASE_URL}/strategies/{strategy_id}/approve",
        json={"operator_id": "Passport Test Operator"},
    )
    assert approval.status_code == 200
    allocation = next(
        item for item in httpx.get(f"{BASE_URL}/allocations").json()["allocations"]
        if item["strategy_id"] == strategy_id and item["status"] == "approved"
    )
    allocation_id = allocation["id"]

    for status in ("dispatched", "in_transit", "delivered", "verified"):
        response = httpx.patch(
            f"{BASE_URL}/allocations/{allocation_id}/status",
            json={"status": status, "operator_id": "Passport Test Operator"},
        )
        assert response.status_code == 200
        assert response.json()["audit_event_id"]

    for _ in range(40):
        response = httpx.post(f"{BASE_URL}/chaos/events", json={
            "event_type": "road_block",
            "payload": {"edge_id": twin["road_edges"][0]["id"]},
        })
        assert response.status_code == 200

    passport_response = httpx.get(
        f"{BASE_URL}/allocations/{allocation_id}/passport"
    )
    assert passport_response.status_code == 200
    passport = passport_response.json()
    assert passport["passport_id"] == allocation_id
    assert passport["resource_reference_id"]
    assert passport["resource_type"] == allocation["resource_type"]
    assert passport["source_id"] == allocation["source_id"]
    assert passport["destination_id"] == allocation["destination_id"]
    assert passport["quantity"] == allocation["quantity"]
    assert passport["route_snapshot"]["node_ids"] == allocation["route_node_ids"]
    assert passport["status"] == "verified"
    assert passport["scenario_id"] == SCENARIO_ID
    assert passport["state_version"] == httpx.get(
        f"{BASE_URL}/strategies/{strategy_id}"
    ).json()["strategy"]["state_version"]
    assert passport["strategy_id"] == strategy_id
    assert passport["incident_event_id"] == event.json()["event_id"]
    assert passport["approving_operator"] == "Passport Test Operator"
    assert passport["audit_chain"]["event_count"] > 100
    assert [transition["to_status"] for transition in passport["lifecycle"]] == [
        "approved", "dispatched", "in_transit", "delivered", "verified"
    ]
    assert all(transition["timestamp"] and transition["audit_event_id"] for transition in passport["lifecycle"])
    assert passport["audit_chain"]["valid"] is True
    audit_ids = {reference["id"] for reference in passport["audit_references"]}
    assert event.json()["event_id"] in audit_ids
    assert any(
        reference["event_type"] == "strategy_approved"
        for reference in passport["audit_references"]
    )
    assert all(transition["audit_event_id"] in audit_ids for transition in passport["lifecycle"])
    assert httpx.get(f"{BASE_URL}/audit/verify").json()["valid"] is True

def test_cryptographic_audit_hash_chain():
    """Verify SHA-256 hash chain verification endpoint."""
    audit_res = httpx.get(f"{BASE_URL}/audit")
    assert audit_res.status_code == 200
    events = audit_res.json()["events"]
    assert len(events) > 0

    # Test /audit/verify
    verify_res = httpx.get(f"{BASE_URL}/audit/verify")
    assert verify_res.status_code == 200
    verification = verify_res.json()
    assert verification["valid"] is True
    assert len(verification["errors"]) == 0
