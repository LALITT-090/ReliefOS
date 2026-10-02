"""
ReliefOS Adversarial QA Script
Tests 10 phases of end-to-end verification.
Uses ASCII-only output for Windows cp1252 compatibility.

API Shapes (verified against live backend):
  GET  /predictions        -> {"forecasts": [...]}
  POST /strategies/generate -> {"strategy_id": "<uuid>", "result": {...}}
  GET  /allocations        -> {"allocations": [...]}
  GET  /audit              -> {"events": [...]}
  POST /chaos/events:
       road_block, hospital_overload, vehicle_failure,
       demand_spike, medicine_shortage, new_incident_zone
"""
import sys
import httpx
import json

BASE = "http://localhost:8000/api/v1"
SCENARIO_ID = "00000000-0000-0000-0000-000000000001"

passed = 0
failed = 0
results = []

def check(name, ok, detail=""):
    global passed, failed
    marker = "[PASS]" if ok else "[FAIL]"
    msg = f"{marker} {name}"
    if detail and not ok:
        msg += f"\n       Detail: {detail}"
    print(msg)
    results.append((ok, name, detail))
    if ok:
        passed += 1
    else:
        failed += 1

def get(path, **kw):
    return httpx.get(f"{BASE}{path}", timeout=30, **kw)

def post(path, **kw):
    return httpx.post(f"{BASE}{path}", timeout=30, **kw)

def patch(path, **kw):
    return httpx.patch(f"{BASE}{path}", timeout=30, **kw)

print("=" * 60)
print("ReliefOS Adversarial QA")
print("=" * 60)

# =========================================================
# PHASE 0: Health Check
# =========================================================
print("\n-- Phase 0: Health --")
try:
    r = get("/health")
    check("Health endpoint returns 200", r.status_code == 200)
    check("Health returns status=ok", r.json().get("status") == "ok")
except Exception as e:
    check("Health endpoint reachable", False, str(e))

# =========================================================
# PHASE 1: Reset to Clean State
# =========================================================
print("\n-- Phase 1: Scenario Load --")
try:
    r = post(f"/scenarios/{SCENARIO_ID}/load")
    check("Scenario load returns 200", r.status_code == 200)
    data = r.json()
    check("Scenario load returns state_version", "state_version" in data, str(data))
    sv1 = data.get("state_version", 0)
except Exception as e:
    check("Scenario load", False, str(e))
    sv1 = 0

# =========================================================
# PHASE 2: Digital Twin Snapshot
# =========================================================
print("\n-- Phase 2: Digital Twin Snapshot --")
try:
    r = get("/twin")
    check("Twin endpoint returns 200", r.status_code == 200)
    twin = r.json()
    check("Twin has zones (5)", len(twin.get("zones", [])) == 5,
          f"got {len(twin.get('zones', []))}")
    check("Twin has hospitals (4)", len(twin.get("hospitals", [])) == 4,
          f"got {len(twin.get('hospitals', []))}")
    check("Twin has ambulances (12)", len(twin.get("ambulances", [])) == 12,
          f"got {len(twin.get('ambulances', []))}")
    check("Twin has medicine_inventory (>=9)", len(twin.get("medicine_inventory", [])) >= 9,
          f"got {len(twin.get('medicine_inventory', []))}")
    check("Twin has demands (>=1)", len(twin.get("demands", [])) >= 1,
          f"got {len(twin.get('demands', []))}")
except Exception as e:
    check("Twin snapshot", False, str(e))

# =========================================================
# PHASE 3: Predictions (wrapped in {"forecasts": [...]})
# =========================================================
print("\n-- Phase 3: Predictions --")
try:
    r = get("/predictions")
    check("Predictions endpoint returns 200", r.status_code == 200)
    body = r.json()
    check("Predictions has forecasts key", "forecasts" in body, str(list(body.keys())))
    forecasts = body.get("forecasts", [])
    check("Predictions forecasts is a list", isinstance(forecasts, list))
    check("Predictions has entries", len(forecasts) > 0, f"got {len(forecasts)}")
    if forecasts:
        p = forecasts[0]
        check("Forecast has zone_id", "zone_id" in p, str(list(p.keys())))
        check("Forecast has horizon_min", "horizon_min" in p, str(list(p.keys())))
        check("Forecast has predicted_demand", "predicted_demand" in p, str(list(p.keys())))
        check("Forecast has confidence", "confidence" in p, str(list(p.keys())))
        check("Forecast has risk_level", "risk_level" in p, str(list(p.keys())))
        # Verify no None crash on numeric fields
        all_numeric_ok = all(
            isinstance(f.get("predicted_demand"), (int, float)) and
            isinstance(f.get("confidence"), (int, float))
            for f in forecasts
        )
        check("All forecasts have non-null numeric fields", all_numeric_ok)
except Exception as e:
    check("Predictions", False, str(e))

# =========================================================
# PHASE 4: Resources Endpoint
# =========================================================
print("\n-- Phase 4: Resources --")
try:
    r = get("/resources")
    check("Resources endpoint returns 200", r.status_code == 200)
    res = r.json()
    check("Resources has ambulances", "ambulances" in res)
    check("Resources has medicine_inventory", "medicine_inventory" in res)
    check("Resources has hospitals", "hospitals" in res)
except Exception as e:
    check("Resources", False, str(e))

# =========================================================
# PHASE 5: Strategy Generation and Approval
# POST /strategies/generate -> {"strategy_id": "...", "result": {...}}
# =========================================================
print("\n-- Phase 5: Strategy Generation & Approval --")
strategy_id = None
try:
    r = post("/strategies/generate", json={"mode": "balanced"})
    check("Strategy generate returns 200", r.status_code == 200,
          f"status={r.status_code} body={r.text[:200]}")
    sdata = r.json()
    # Correct field: "strategy_id" at top level
    strategy_id = sdata.get("strategy_id")
    check("Strategy has strategy_id", strategy_id is not None, str(list(sdata.keys())))
    result = sdata.get("result", {})
    check("Result has score", "score" in result, str(list(result.keys())))
    check("Result has coverage_pct", "coverage_pct" in result, str(list(result.keys())))
    check("Result has is_feasible", "is_feasible" in result, str(list(result.keys())))
except Exception as e:
    check("Strategy generate", False, str(e))

if strategy_id:
    try:
        r = get(f"/strategies/{strategy_id}")
        check("Strategy GET returns 200", r.status_code == 200,
              f"status={r.status_code}")
        sdetail = r.json()
        check("Strategy detail has strategy", "strategy" in sdetail, str(list(sdetail.keys())))
        check("Strategy detail has explanation", "explanation" in sdetail, str(list(sdetail.keys())))
        check("Strategy detail has allocations", "allocations" in sdetail, str(list(sdetail.keys())))
    except Exception as e:
        check("Strategy GET detail", False, str(e))

    try:
        r = post(f"/strategies/{strategy_id}/approve", json={})
        check("Strategy approve returns 200 or 409", r.status_code in (200, 409),
              f"status={r.status_code} body={r.text[:200]}")
    except Exception as e:
        check("Strategy approve", False, str(e))

# =========================================================
# PHASE 6: All 6 Chaos Events (correct event type names)
# =========================================================
print("\n-- Phase 6: All 6 Chaos Events --")

# Reset scenario first to ensure clean state
post(f"/scenarios/{SCENARIO_ID}/load")

chaos_events = [
    ("road_block",         {"edge_id": "77000000-0000-0000-0000-000000000001"}),
    ("hospital_overload",  {"hospital_id": "33000000-0000-0000-0000-000000000001"}),
    ("vehicle_failure",    {"ambulance_id": "66000000-0000-0000-0000-000000000001"}),
    ("demand_spike",       {"zone_id": "22000000-0000-0000-0000-000000000002", "multiplier": 1.5}),
    ("medicine_shortage",  {"inventory_id": "88000000-0000-0000-0000-000000000001"}),
    ("new_incident_zone",  {"name": "QA Test Zone", "lat": 18.48, "lon": 73.87, "severity": "high"}),
]

for event_type, payload in chaos_events:
    try:
        body = {"event_type": event_type, "payload": payload}
        r = post("/chaos/events", json=body)
        check(f"Chaos event: {event_type}", r.status_code == 200,
              f"status={r.status_code} body={r.text[:300]}")
    except Exception as e:
        check(f"Chaos event: {event_type}", False, str(e))

# =========================================================
# PHASE 7: Invalid Chaos Payloads Return 400
# =========================================================
print("\n-- Phase 7: Invalid Chaos Payload Handling --")

invalid_events = [
    ("road_block",        {}),   # missing edge_id
    ("hospital_overload", {}),   # missing hospital_id
    ("vehicle_failure",   {}),   # missing ambulance_id
    ("unknown_event_xyz", {}),   # unknown event type -> 400
]

for event_type, payload in invalid_events:
    try:
        body = {"event_type": event_type, "payload": payload}
        r = post("/chaos/events", json=body)
        check(f"Invalid chaos '{event_type}' returns 400", r.status_code == 400,
              f"status={r.status_code} body={r.text[:200]}")
    except Exception as e:
        check(f"Invalid chaos '{event_type}'", False, str(e))

# =========================================================
# PHASE 8: Allocations (wrapped in {"allocations": [...]})
# =========================================================
print("\n-- Phase 8: Allocations --")
alloc_id = None
try:
    r = get("/allocations")
    check("Allocations endpoint returns 200", r.status_code == 200)
    body = r.json()
    check("Allocations has 'allocations' key", "allocations" in body, str(list(body.keys())))
    allocs = body.get("allocations", [])
    check("Allocations returns a list", isinstance(allocs, list))
    if allocs:
        alloc_id = allocs[0].get("id")
        check("Allocation entry has id", alloc_id is not None)
        check("Allocation entry has status", "status" in allocs[0])
        check("Allocation entry has resource_type", "resource_type" in allocs[0])
        check("Allocation entry has destination_name", "destination_name" in allocs[0])
except Exception as e:
    check("Allocations", False, str(e))

if alloc_id:
    # Try a valid transition: PROPOSED -> approved
    try:
        r = patch(f"/allocations/{alloc_id}/status", json={"status": "approved"})
        check("Allocation PROPOSED->approved transition returns 200 or 400",
              r.status_code in (200, 400),
              f"status={r.status_code} body={r.text[:200]}")
    except Exception as e:
        check("Allocation status update", False, str(e))

# =========================================================
# PHASE 9: Audit Trail (wrapped in {"events": [...]})
# =========================================================
print("\n-- Phase 9: Audit Trail --")
try:
    r = get("/audit")
    check("Audit endpoint returns 200", r.status_code == 200)
    body = r.json()
    check("Audit has 'events' key", "events" in body, str(list(body.keys())))
    events = body.get("events", [])
    check("Audit events is a list", isinstance(events, list))
    check("Audit has entries", len(events) > 0, f"got {len(events)}")
    if events:
        e0 = events[0]
        check("Audit event has id", "id" in e0)
        check("Audit event has event_type", "event_type" in e0)
        check("Audit event has event_hash", "event_hash" in e0)
        check("Audit event has timestamp", "timestamp" in e0)
except Exception as e:
    check("Audit trail", False, str(e))

try:
    r = get("/audit/verify")
    check("Audit verify endpoint returns 200", r.status_code == 200,
          f"status={r.status_code} body={r.text[:200]}")
    v = r.json()
    check("Audit verify has 'valid' field", "valid" in v, str(list(v.keys())))
    check("Audit hash chain is valid", v.get("valid") == True,
          f"valid={v.get('valid')} detail={v.get('detail','')}")
except Exception as e:
    check("Audit verify", False, str(e))

# =========================================================
# PHASE 10: Strategy Modify (API-010)
# =========================================================
print("\n-- Phase 10: Strategy Modify (API-010) --")
try:
    # Generate a fresh strategy (scenario may have changed state — generate against current state)
    r2 = post("/strategies/generate", json={"mode": "severity_first"})
    if r2.status_code == 200:
        sid2 = r2.json().get("strategy_id")
        check("Strategy generate for modify test", sid2 is not None,
              str(list(r2.json().keys())))
        if sid2:
            r3 = post(f"/strategies/{sid2}/modify", json={
                "operator_note": "QA test modification",
                "operator_id": "qa_agent"
            })
            check("Strategy modify returns 200", r3.status_code == 200,
                  f"status={r3.status_code} body={r3.text[:300]}")
            if r3.status_code == 200:
                mod_data = r3.json()
                check("Modify response has status", mod_data.get("status") == "success",
                      str(mod_data))
    else:
        check("Strategy generate for modify test", False,
              f"status={r2.status_code} body={r2.text[:200]}")
except Exception as e:
    check("Strategy modify", False, str(e))

# =========================================================
# PHASE 10B: Stale Strategy Detection
# =========================================================
print("\n-- Phase 10B: Stale Strategy Detection --")
try:
    # Generate a strategy
    rg = post("/strategies/generate", json={"mode": "balanced"})
    if rg.status_code == 200:
        stale_sid = rg.json().get("strategy_id")
        # Mutate state with a chaos event
        post("/chaos/events", json={
            "event_type": "hospital_overload",
            "payload": {"hospital_id": "33000000-0000-0000-0000-000000000002"}
        })
        # Now try to approve the stale strategy -> should get 409
        if stale_sid:
            ra = post(f"/strategies/{stale_sid}/approve", json={})
            check("Stale strategy approval returns 409", ra.status_code == 409,
                  f"status={ra.status_code} body={ra.text[:200]}")
    else:
        check("Generate strategy for staleness test", False, f"status={rg.status_code}")
except Exception as e:
    check("Stale strategy detection", False, str(e))

# =========================================================
# PHASE 11: Concurrency Safety (double-approve)
# =========================================================
print("\n-- Phase 11: Double-Approve Guard --")
try:
    # Reset to clean state first
    post(f"/scenarios/{SCENARIO_ID}/load")
    rg = post("/strategies/generate", json={"mode": "balanced"})
    if rg.status_code == 200:
        dup_sid = rg.json().get("strategy_id")
        if dup_sid:
            r_a1 = post(f"/strategies/{dup_sid}/approve", json={})
            r_a2 = post(f"/strategies/{dup_sid}/approve", json={})
            check("First approve returns 200", r_a1.status_code == 200,
                  f"status={r_a1.status_code}")
            check("Second approve returns 400", r_a2.status_code == 400,
                  f"status={r_a2.status_code} body={r_a2.text[:200]}")
    else:
        check("Generate for double-approve test", False, f"status={rg.status_code}")
except Exception as e:
    check("Double-approve guard", False, str(e))

# =========================================================
# SUMMARY
# =========================================================
print("\n" + "=" * 60)
print(f"RESULT: {passed} passed, {failed} failed out of {passed+failed} checks")
print("=" * 60)

if failed > 0:
    print("\nFailed checks:")
    for ok, name, detail in results:
        if not ok:
            print(f"  [FAIL] {name}")
            if detail:
                print(f"         {detail}")

sys.exit(0 if failed == 0 else 1)
