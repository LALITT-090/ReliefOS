# ReliefOS — Technical Requirements Document (TRD)

**PRD baseline:** v2.0  
**Technical scope:** derived from the consolidated PRD

## 1. Technical architecture principles

1. Backend Digital Twin is the authoritative state.
2. Frontend is a view/controller, never the source of truth.
3. Optimizer reads a versioned state snapshot and returns a recommendation.
4. Optimizer does not mutate live state.
5. Only approved recommendations create active simulated allocations.
6. Every material state change passes through validation.
7. Every state-changing command creates an audit event.
8. Explanation consumes structured evidence.
9. Optional LLM cannot modify allocation decisions.
10. State versions prevent stale approvals.

---

# 2. Technical requirements

| ID | Requirement |
|---|---|
| TR-001 | Support multiple scenario configurations/types using common domain contracts. |
| TR-002 | Scenario load/reset must be deterministic when a seed is fixed. |
| TR-003 | Digital Twin state must be persisted/versioned. |
| TR-004 | State-changing events must be validated before application. |
| TR-005 | Ambulance state must include location, availability, capacity and active allocation. |
| TR-006 | ICU state must include total, occupied and available capacity. |
| TR-007 | Medicine inventory must include medicine type, available quantity and reserve quantity. |
| TR-008 | Demand must include location, resource type, quantity and severity/urgency. |
| TR-009 | Geographic entities must store coordinates. |
| TR-010 | Routing must use a road/network graph. |
| TR-011 | Blocked road edges must be excluded from feasible route calculations. |
| TR-012 | Optimizer must enforce resource/capacity/assignment/route constraints. |
| TR-013 | Optimizer must produce structured strategy metrics. |
| TR-014 | System must generate ≥3 candidate strategies for the primary demo. |
| TR-015 | Prediction engine must produce T+30/T+60/T+120 estimates. |
| TR-016 | Prediction output must be distinguishable from measured state. |
| TR-017 | Prediction confidence/risk must be derived from known inputs; no fabricated precision. |
| TR-018 | Material events must trigger impact analysis. |
| TR-019 | Material impact must cause re-planning. |
| TR-020 | Strategy must store the Digital Twin state version used to generate it. |
| TR-021 | Approval must fail/revalidate if a material state-version conflict exists. |
| TR-022 | Approved strategy must create active allocation records. |
| TR-023 | Reallocation must preserve superseded allocation history. |
| TR-024 | Explanation service must consume decision evidence. |
| TR-025 | Explanation service must have deterministic templates/fallbacks. |
| TR-026 | Optional LLM must operate behind an adapter. |
| TR-027 | LLM failure must not break core optimization. |
| TR-028 | Audit events must be append-only through the normal UI. |
| TR-029 | Audit events must support hash chaining. |
| TR-030 | Resource Passport must be reconstructable from persisted lifecycle events. |
| TR-031 | API schemas must be validated with Pydantic. |
| TR-032 | APIs must expose scenario, twin, resource, strategy, approval, chaos and audit operations. |
| TR-033 | UI must expose simulation mode visibly. |
| TR-034 | Synthetic data must be used for demo. |
| TR-035 | Secrets must remain server-side. |
| TR-036 | Authentication is not required for MVP. |
| TR-037 | Core strategy generation target is <5 seconds on the seeded demo dataset. |
| TR-038 | Tests must cover optimizer constraints, state transitions, reallocation and critical UI flow. |

The MVP configurations are **Urban Flood — Metro District** (primary, seed 42) and **Earthquake — District Response** (alternate, seed 99). Each configuration has its own scenario/entity IDs, zones, hospitals, ambulances, typed inventory, demands and road graph. Scenario-scoped strategies, allocations and audit verification must remain isolated when the active scenario changes.

---

# 3. Domain state model

```text
Scenario
  ├── Zones
  ├── Hospitals
  ├── Resource Sources
  ├── Ambulances
  ├── Medicine Inventory
  ├── Road Graph
  ├── Demand
  ├── Incidents
  ├── Predictions
  ├── Strategies
  ├── Allocations
  └── Audit Events
```

## State version

Every accepted domain event:
1. validates,
2. is audited,
3. mutates the Digital Twin transactionally,
4. increments `state_version`.

---

# 4. Core data requirements

### DATA-001 Scenario
`id, name, disaster_type, status, seed, state_version, created_at`

### DATA-002 Zone
`id, scenario_id, name, lat, lon, severity, affected_population, status`

### DATA-003 Hospital
`id, scenario_id, name, lat, lon, beds_total, beds_available, icu_total, icu_available, status`

### DATA-004 ResourceSource
`id, scenario_id, type, name, lat, lon, status`

### DATA-005 MedicineType
`id, code, name, unit`

### DATA-006 MedicineInventory
`id, source_id, medicine_type_id, quantity_available, reserve_quantity, updated_at`

### DATA-007 Ambulance
`id, scenario_id, lat, lon, capacity, availability_status, assigned_allocation_id`

### DATA-008 RoadNode
`id, lat, lon`

### DATA-009 RoadEdge
`id, from_node, to_node, distance_km, base_travel_min, risk_score, status`

### DATA-010 Demand
`id, zone_id, resource_type, medicine_type_id, quantity, severity, urgency, due_by, confidence, status`

### DATA-011 Incident
`id, scenario_id, type, source, severity, confidence, event_time, payload_json`

### DATA-012 Forecast
`id, zone_id, resource_type, medicine_type_id, horizon_min, predicted_quantity, lower_bound, upper_bound, confidence`

### DATA-013 Strategy
`id, scenario_id, state_version, objective_mode, score, coverage, unmet_demand, avg_eta, risk, created_at`

### DATA-014 Allocation
`id, strategy_id, resource_type, source_id, destination_id, quantity, vehicle_id, route_id, status`

### DATA-015 DecisionEvidence
`id, strategy_id, factor_type, factor_name, value, contribution, source_ref`

### DATA-016 Decision
`id, strategy_id, operator_action, operator_note, timestamp`

### DATA-017 AuditEvent
`id, event_type, actor, entity_type, entity_id, previous_hash, event_hash, payload_json, timestamp`

---

# 5. API contract

| ID | Method | Endpoint | Purpose |
|---|---|---|---|
| API-001 | POST | `/api/v1/scenarios/{id}/load` | Load/reset deterministic scenario |
| API-002 | GET | `/api/v1/twin` | Current Digital Twin snapshot |
| API-003 | GET | `/api/v1/resources` | Resource availability |
| API-004 | POST | `/api/v1/incidents` | Submit structured incident |
| API-005 | POST | `/api/v1/incidents/parse` | Optional natural-language extraction |
| API-006 | GET | `/api/v1/predictions` | Forecast/shortage estimates |
| API-007 | POST | `/api/v1/strategies/generate` | Generate candidate strategies |
| API-008 | GET | `/api/v1/strategies/{id}` | Strategy metrics/evidence |
| API-009 | POST | `/api/v1/strategies/{id}/approve` | Approve strategy |
| API-010 | POST | `/api/v1/strategies/{id}/modify` | Submit operator changes and revalidate |
| API-011 | POST | `/api/v1/strategies/{id}/reject` | Reject strategy |
| API-012 | POST | `/api/v1/chaos/events` | Trigger simulation event |
| API-013 | GET | `/api/v1/allocations` | Active/history allocations |
| API-014 | PATCH | `/api/v1/allocations/{id}/status` | Advance simulated lifecycle |
| API-015 | GET | `/api/v1/audit` | Audit timeline |
| API-016 | GET | `/api/v1/health` | Health check |
| API-017 | GET | `/api/v1/allocations/{id}/passport` | Persisted allocation provenance, lifecycle and linked audit events |
| API-018 | GET | `/api/v1/audit/verify` | Verify the active scenario's SHA-256 event chain |

---

# 6. Event contract

```json
{
  "event_id": "uuid",
  "event_type": "road_block",
  "scenario_id": "uuid",
  "source": "operator | field_report | system | simulation",
  "event_time": "ISO-8601",
  "received_time": "ISO-8601",
  "confidence": 0.0,
  "entity_refs": [],
  "payload": {},
  "schema_version": "2.0"
}
```

Material re-planning events:
- road becomes blocked/high-risk,
- hospital capacity drops below incoming load,
- assigned ambulance becomes unavailable,
- inventory falls below allocated quantity/reserve,
- critical demand rises,
- new high-severity zone appears.

---

# 7. Optimization technical specification

## Decision variables
- Ambulance → destination assignment.
- ICU allocation quantities.
- Medicine source → demand-zone quantities.
- Route selection where the predefined network permits alternatives.

## Hard constraints
- Availability.
- Capacity.
- Medicine type.
- Vehicle exclusivity.
- Route feasibility.
- Reserve inventory.
- Non-negative/integer quantities.

## Soft objectives
- Critical unmet demand.
- Travel time.
- Route risk.
- Capacity overload.
- Predicted shortage.
- Optional coverage balance.

## Strategy modes
1. `baseline_nearest`
2. `severity_first`
3. `balanced`
4. optional `coverage_first`

The UI compares metrics; it does not hard-code a universal winner.

The active implementation is deterministic min-cost flow across shared
resource and demand capacities, with reverse residual edges for reassignment.
It applies severity, urgency, forecast shortage pressure, route travel time and
risk to assignment costs. Availability, typed-medicine reserves, ICU capacity
and feasible network routes are hard constraints. This implementation does not
use OR-Tools.

---

# 8. Prediction technical specification

### Baseline
Use deterministic trend + rolling average over synthetic scenario history.

### Optional
Lightweight scikit-learn model if enough seeded history exists.

### Forecast horizons
`30, 60, 120 minutes`

### Minimum output
- current measured quantity,
- projected demand,
- projected supply,
- shortage estimate,
- uncertainty/range,
- confidence/risk,
- source inputs.

Prediction should influence optimization only when its configured confidence threshold is satisfied.

---

# 9. Routing

For MVP reliability, use:
- a predefined road graph,
- explicit edge distance and scenario-provided `base_travel_min`,
- road risk,
- edge status (`normal`, `risky`, `blocked`).

The route ETA is a deterministic synthetic estimate from those edge values, not
measured travel time, live traffic, or a live routing-provider result. Route ETA
and risk are used in assignment costs. A road closure excludes the blocked edge
and can change both route feasibility and the recommendation.

**Do not substitute straight-line distance silently.**

---

# 10. Approval concurrency

Every Strategy stores:
`generated_state_version`.

At approval:
1. Fetch the active scenario ID and Digital Twin version.
2. Compare both values to the strategy's scenario ID and generated state version.
3. Allow approval only when the scenario matches and there is no material version change.
4. Otherwise reject stale approval and require regeneration/revalidation in the active scenario.

This prevents a recommendation from being applied to a materially different situation.

---

# 11. Audit hash chain

```text
event_hash[n] =
  SHA256(
    canonical_payload[n]
    + previous_hash[n]
  )
```

The database stores both hashes.

No blockchain is required.
Audit payloads include a generated event ID; Passport responses link the
allocation's generated, approved and lifecycle events to their hashes and
include the active scenario chain-verification result. This demonstrates
payload-chain integrity verification, not signatures or tamper-proof storage.

---

# 12. Technology stack

- Next.js + React + TypeScript.
- Tailwind CSS.
- Leaflet + OpenStreetMap-compatible tiles.
- Python 3.11+.
- FastAPI.
- Pydantic.
- Deterministic in-process min-cost flow (no OR-Tools dependency).
- PostgreSQL/PostGIS.
- pandas.
- scikit-learn only if prediction needs it.
- Pytest.
- Playwright.
- Docker.
- GitHub.

Optional:
- FastAPI WebSockets.
- Supabase as managed PostgreSQL.
- Vercel frontend.
- Render/Railway backend.
- Optional LLM provider.

---

# 13. Testing requirements

### Unit
- Constraint calculations.
- Medicine-type matching.
- Route feasibility.
- Forecast calculations.
- State transitions.
- Hash-chain validation.

### Integration
- Scenario load → twin state.
- Strategy generation → evidence.
- Approval → active allocation.
- Chaos event → impact detection → reallocation.
- State version conflict → stale approval rejected.

### E2E
Primary:
`load → generate 3 strategies → compare → approve → road block → replan → approve → audit`

Secondary:
`hospital overload → changed destination`
`demand spike → changed unmet demand/allocation`
`LLM disabled → core flow still works`
