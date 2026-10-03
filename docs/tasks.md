# ReliefOS — Implementation Tasks

## Team structure

| Member | Primary ownership |
|---|---|
| Member 1 | Frontend |
| Member 2 | Backend / Digital Twin |
| Member 3 | Optimization / Data / Routing / Prediction |
| Member 4 | AI / Integration / Simulation / QA support |

Everyone integrates through typed contracts.

---

# Phase 0 — Freeze foundation

### TASK-001
Create repository and branch strategy.

### TASK-002
Create `/docs` and copy canonical documentation.

### TASK-003
Create frontend/backend/scenario directories.

### TASK-004
Configure environment variables.

### TASK-005
Create Docker Compose for local PostgreSQL.

### TASK-006
Freeze canonical terminology.

**Exit:** repository runs locally and all team members can start.

---

# Phase 1 — Scenario and Digital Twin

### TASK-007
Define Scenario schema.

### TASK-008
Define Zone/Hospital/ResourceSource models.

### TASK-009
Define Ambulance model.

### TASK-010
Define MedicineType and MedicineInventory models.

### TASK-011
Define Demand and Incident models.

### TASK-012
Define RoadNode/RoadEdge models.

### TASK-013
Implement Digital Twin state container.

### TASK-014
Implement `state_version`.

### TASK-015
Create seeded Urban Flood scenario.

### TASK-016
Create a complete deterministic alternate disaster configuration with isolated entities and operational data; Urban Flood remains the primary demo.

### TASK-017
Implement scenario selection and deterministic load/reset for both configured scenarios, including active-state and audit-history isolation.

**Exit:** deterministic scenario appears in API.

---

# Phase 2 — Routing

### TASK-018
Create road graph format.

### TASK-019
Add route distance/time fields.

### TASK-020
Implement route feasibility.

### TASK-021
Implement blocked-road handling.

### TASK-022
Implement shortest/feasible route calculation.

### TASK-023
Test route changes after Road Block.

**Exit:** road distance is used by optimizer.

---

# Phase 3 — Optimization

### TASK-024
Define decision variables.

### TASK-025
Implement resource availability constraints.

### TASK-026
Implement ICU capacity constraints.

### TASK-027
Implement typed medicine constraints.

### TASK-028
Implement ambulance exclusivity.

### TASK-029
Implement route constraints.

### TASK-030
Implement severity-weighted unmet-demand objective.

### TASK-031
Implement transport objective.

### TASK-032
Implement predicted-shortage objective.

### TASK-033
Implement Baseline strategy.

### TASK-034
Implement Severity-first strategy.

### TASK-035
Implement Balanced strategy.

### TASK-036
Implement optional Coverage-first strategy.

### TASK-037
Return structured metrics and DecisionEvidence.

### TASK-038
Write optimizer unit tests.

**Exit:** 3 feasible candidate strategies from same state.

---

# Phase 4 — Prediction

### TASK-039
Define forecast contract.

### TASK-040
Create synthetic demand history.

### TASK-041
Implement rolling-average/trend baseline.

### TASK-042
Generate T+30/T+60/T+120 forecasts.

### TASK-043
Calculate shortage estimates.

### TASK-044
Expose uncertainty/risk.

### TASK-045
Integrate forecast with optimization.

### TASK-046
Test prediction determinism.

**Exit:** shortage prediction appears and influences planning where configured.

---

# Phase 5 — Backend APIs

### TASK-047
Implement scenario API.

### TASK-048
Implement Digital Twin API.

### TASK-049
Implement resources API.

### TASK-050
Implement predictions API.

### TASK-051
Implement strategy generation API.

### TASK-052
Implement strategy detail/evidence API.

### TASK-053
Implement approve API.

### TASK-054
Implement modify API.

### TASK-055
Implement reject API.

### TASK-056
Implement chaos-event API.

### TASK-057
Implement allocation lifecycle API.

### TASK-058
Implement audit API.

### TASK-059
Add API validation.

### TASK-060
Add integration tests.

**Exit:** complete backend closed loop works through API.

---

# Phase 6 — Approval + state safety

### TASK-061
Store strategy state version.

### TASK-062
Implement stale-strategy check.

### TASK-063
Block stale approval.

### TASK-064
Apply approved allocation transactionally.

### TASK-065
Supersede conflicting allocations.

### TASK-066
Persist operator decision.

**Exit:** no stale recommendation can silently overwrite current state.

---

# Phase 7 — Chaos and dynamic reallocation

### TASK-067
Implement Road Block.

### TASK-068
Implement Hospital Overload.

### TASK-069
Implement Vehicle Failure.

### TASK-070
Implement Demand Spike.

### TASK-071
Implement Medicine Shortage.

### TASK-072
Implement New Incident Zone.

### TASK-073
Implement impact detector.

### TASK-074
Trigger re-planning from material impact.

### TASK-075
Preserve before/after history.

**Exit:** each of the six deterministic chaos events has an independent
event → changed-state → replan → approval regression flow; applying an event
alone never commits a replacement allocation.

---

# Phase 8 — Explanation and audit

### TASK-076
Implement DecisionEvidence schema.

### TASK-077
Implement deterministic explanation templates.

### TASK-078
Implement constraint explanation.

### TASK-079
Implement alternative-strategy explanation.

### TASK-080
Implement Resource Passport.

### TASK-081
Implement AuditEvent.

### TASK-082
Implement audit hash chain.

### TASK-083
Build audit verification test.

**Exit:** every recommendation can be explained and traced.

---

# Phase 9 — Frontend

### TASK-084
Create Next.js shell.

### TASK-085
Create navigation.

### TASK-086
Build Dashboard.

### TASK-087
Build Map.

### TASK-088
Build Predictions.

### TASK-089
Build Strategy Lab.

### TASK-090
Build Recommendation Drawer.

### TASK-091
Build Why panel.

### TASK-092
Build Approve/Modify/Reject flow.

### TASK-093
Build Chaos Panel.

### TASK-094
Build Active Allocation Tracker.

### TASK-095
Build Resource Passport.

### TASK-096
Build Audit Timeline.

### TASK-097
Add simulation-mode banner.

**Exit:** operator can complete full demo from UI.

---

# Phase 10 — Optional AI adapter

### TASK-098
Define LLM adapter interface.

### TASK-099
Create grounded explanation prompt.

### TASK-100
Create structured incident extraction prompt.

### TASK-101
Validate structured output.

### TASK-102
Implement deterministic fallback.

### TASK-103
Test with LLM disabled.

**Exit:** optional AI adds value without becoming a dependency.

---

# Phase 11 — Testing

### TASK-104
Test inventory never goes negative.

### TASK-105
Test blocked road never appears in approved route.

### TASK-106
Test ambulance cannot have conflicting assignments.

### TASK-107
Test ICU capacity.

### TASK-108
Test medicine-type integrity.

### TASK-109
Test stale approval.

### TASK-110
Test reallocation preserves history.

### TASK-111
Test audit hash chain.

### TASK-112
Test prediction reproducibility.

### TASK-113
Run full E2E demo.

### TASK-121
Run each of the six chaos events independently from baseline and reset the scenario after each event.

---

# Phase 12 — Demo hardening

### TASK-114
Freeze Urban Flood seed.

### TASK-115
Freeze chaos payloads.

### TASK-116
Capture real strategy metrics from software.

### TASK-117
Verify all PPT claims against implementation.

### TASK-118
Prepare backup local deployment.

### TASK-119
Prepare database/scenario reset.

### TASK-120
Rehearse 3–5 minute demo.

---

# Recommended execution order

```text
Digital Twin
     ↓
Data
     ↓
Routing
     ↓
Optimizer
     ↓
Prediction
     ↓
Approval
     ↓
Chaos/Reallocation
     ↓
Explanation/Audit
     ↓
Dashboard
     ↓
Polish
```

Do not spend major time on UI polish before the optimizer and reallocation loop works.

---

# MVP cut line

## Must ship
- Digital Twin.
- Urban Flood scenario.
- Alternate scenario configuration.
- Ambulances.
- ICU beds.
- Typed medicines.
- Road-network routing.
- 3 strategies.
- Prediction.
- Human approval.
- 3+ chaos events.
- Dynamic reallocation.
- Deterministic explanation.
- Audit.
- Resource Passport.
- Dashboard/map.

## Defer if necessary
- LLM.
- WebSockets.
- Natural-language incident parsing.
- Advanced forecasting.
- Authentication.
- Advanced fairness modes.
- Complex GIS ingestion.
