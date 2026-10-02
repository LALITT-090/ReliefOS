import httpx
import time

BASE_URL = "http://localhost:8000/api/v1"

def print_step(msg):
    print(f"\n{'='*60}\n>>> {msg}\n{'='*60}")

def run_demo():
    print_step("1. Load Urban Flood Scenario")
    res = httpx.post(f"{BASE_URL}/scenarios/00000000-0000-0000-0000-000000000001/load")
    print(res.json())

    print_step("2. Check Twin State")
    twin = httpx.get(f"{BASE_URL}/twin").json()
    print(f"Twin Version: {twin['state_version']}")
    
    print_step("3. Generate 3 Strategies (Baseline, Severity, Balanced)")
    strategies = []
    for mode in ["baseline_nearest", "severity_first", "balanced"]:
        res = httpx.post(f"{BASE_URL}/strategies/generate", json={"mode": mode})
        strat = res.json()
        strategies.append(strat)
        print(f"Generated {mode}: score={strat['result']['score']}, feasible={strat['result']['is_feasible']}")

    print_step("4. Inspect Explanation")
    strat_id = strategies[2]["strategy_id"]
    res = httpx.get(f"{BASE_URL}/strategies/{strat_id}")
    strat_data = res.json()
    print(f"Explanation: {strat_data['explanation'][:200]}...")

    print_step("5. Approve Balanced Strategy")
    res = httpx.post(f"{BASE_URL}/strategies/{strat_id}/approve", json={"operator_action": "approved", "operator_id": "System"})
    print(res.json())

    print_step("6. Verify Active Allocations")
    res = httpx.get(f"{BASE_URL}/allocations")
    allocs = res.json()["allocations"]
    print(f"Total active allocations: {len(allocs)}")
    
    print_step("7. Attack: Try stale approval (Approve a strategy generated on older state version)")
    # Since we approved a strategy, the state version didn't change (approval just changes alloc status).
    # Wait, chaos event changes state version. Let's trigger chaos first.
    
    print_step("8. Chaos: Road Block")
    res = httpx.post(f"{BASE_URL}/chaos/events", json={
        "event_type": "road_block",
        "payload": {"edge_id": "77000000-0000-0000-0000-000000000001"}
    })
    print(res.json())

    print_step("9. Attack: Try stale approval now that state version changed")
    strat_id_baseline = strategies[0]["strategy_id"]
    res = httpx.post(f"{BASE_URL}/strategies/{strat_id_baseline}/approve", json={"operator_action": "approved", "operator_id": "System"})
    print(f"Stale approval response: {res.status_code} - {res.json()}")

    print_step("10. Replan after road block")
    res = httpx.post(f"{BASE_URL}/strategies/generate", json={"mode": "balanced"})
    new_strat = res.json()
    print(f"New strategy score: {new_strat['result']['score']}")

    print_step("11. Chaos: Hospital Overload")
    res = httpx.post(f"{BASE_URL}/chaos/events", json={
        "event_type": "hospital_overload",
        "payload": {"hospital_id": "11000000-0000-0000-0000-000000000001", "icu_reduction": 10}
    })
    print(res.json())

    print_step("12. Replan after hospital overload")
    res = httpx.post(f"{BASE_URL}/strategies/generate", json={"mode": "severity_first"})
    new_strat2 = res.json()
    print(f"New strategy score: {new_strat2['result']['score']}")

    print_step("13. Chaos: Demand Spike")
    res = httpx.post(f"{BASE_URL}/chaos/events", json={
        "event_type": "demand_spike",
        "payload": {"zone_id": "00000000-0000-0000-0000-000000000001", "resource_type": "icu_bed", "increase_amount": 15}
    })
    print(res.json())

    print_step("14. Inspect Audit Timeline")
    res = httpx.get(f"{BASE_URL}/audit")
    events = res.json()["events"]
    print(f"Total audit events: {len(events)}")
    for e in events[-5:]:
        print(f" - {e['event_type']} @ {e['timestamp']}")
        
    print_step("15. Attack: Impossible route")
    # By blocking the only road into a node, we make it impossible.
    opt = httpx.post(f"{BASE_URL}/chaos/events", json={"event_type": "road_block", "payload": {"edge_id": "77000000-0000-0000-0000-000000000002"}})
    res = httpx.post(f"{BASE_URL}/strategies/generate", json={"mode": "balanced"})
    print(f"Impossible route strategy feasible? {res.json()['result']['is_feasible']}")

if __name__ == "__main__":
    run_demo()
