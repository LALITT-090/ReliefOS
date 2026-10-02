import pytest
import httpx

BASE_URL = "http://localhost:8000/api/v1"
SCENARIO_ID = "00000000-0000-0000-0000-000000000001"

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
        assert "allocations" in detail
        assert "explanation" in detail
        assert len(detail["explanation"]) > 0

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

    mod_res = httpx.post(f"{BASE_URL}/strategies/{strat_id}/modify", json={
        "operator_id": "Commander",
        "operator_note": "Adjusted route weights"
    })
    assert mod_res.status_code == 200
    assert mod_res.json()["status"] == "success"

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

def test_all_six_chaos_events():
    """Independently verify all 6 chaos simulation events."""
    # 1. Road block
    r1 = httpx.post(f"{BASE_URL}/chaos/events", json={
        "event_type": "road_block",
        "payload": {"edge_id": "77000000-0000-0000-0000-000000000003"}
    })
    assert r1.status_code == 200

    # 2. Hospital overload
    r2 = httpx.post(f"{BASE_URL}/chaos/events", json={
        "event_type": "hospital_overload",
        "payload": {"hospital_id": "33000000-0000-0000-0000-000000000001", "icu_reduction": 5}
    })
    assert r2.status_code == 200

    # 3. Vehicle failure
    r3 = httpx.post(f"{BASE_URL}/chaos/events", json={
        "event_type": "vehicle_failure",
        "payload": {"ambulance_id": "66000000-0000-0000-0000-000000000001"}
    })
    assert r3.status_code == 200

    # 4. Demand spike
    r4 = httpx.post(f"{BASE_URL}/chaos/events", json={
        "event_type": "demand_spike",
        "payload": {"zone_id": "22000000-0000-0000-0000-000000000001", "resource_type": "ambulance", "increase_amount": 2}
    })
    assert r4.status_code == 200

    # 5. Medicine shortage
    r5 = httpx.post(f"{BASE_URL}/chaos/events", json={
        "event_type": "medicine_shortage",
        "payload": {"inventory_id": "88000000-0000-0000-0000-000000000001", "reduction": 30}
    })
    assert r5.status_code == 200

    # 6. New incident zone
    r6 = httpx.post(f"{BASE_URL}/chaos/events", json={
        "event_type": "new_incident_zone",
        "payload": {
            "name": "Zone G — Flood Outskirts",
            "lat": 18.5500,
            "lon": 73.8800,
            "severity": "critical",
            "affected_population": 400,
            "demands": [{"resource_type": "ambulance", "quantity": 1, "severity": "critical", "urgency": "immediate"}]
        }
    })
    assert r6.status_code == 200

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
