# ReliefOS — Architecture

## 1. Architecture goal

Build a reliable, explainable, simulation-first disaster resource decision system where the backend Digital Twin is the source of truth.

## 2. Logical architecture

```text
                         ┌───────────────────────┐
                         │     Next.js UI        │
                         │ Dashboard / Map / Lab │
                         └───────────┬───────────┘
                                     │ REST
                                     ▼
                         ┌───────────────────────┐
                         │      FastAPI API       │
                         │ Validation + orchestration
                         └───────────┬───────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              ▼                      ▼                      ▼
      ┌──────────────┐      ┌────────────────┐      ┌──────────────┐
      │ Digital Twin │      │ Event Pipeline │      │ Audit Service│
      │ Source Truth │◄────►│ + Validation   │─────►│ Hash Chain   │
      └──────┬───────┘      └───────┬────────┘      └──────────────┘
             │                      │
       ┌─────┴───────────┐          │
       ▼                 ▼          ▼
┌─────────────┐   ┌─────────────┐  ┌─────────────┐
│ Prediction  │   │ Routing     │  │ Chaos Engine│
│ Engine      │   │ Service     │  │ / Simulator │
└──────┬──────┘   └──────┬──────┘  └──────┬──────┘
       │                 │                │
       └─────────────────┼────────────────┘
                         ▼
                ┌─────────────────┐
                │ Optimization    │
                │ Min-cost flow  │
                └────────┬────────┘
                         ▼
                ┌─────────────────┐
                │ Strategy +      │
                │ Evidence        │
                └────────┬────────┘
                         ▼
                ┌─────────────────┐
                │ Human Approval  │
                └────────┬────────┘
                         ▼
                ┌─────────────────┐
                │ Active Allocation│
                └─────────────────┘

       Optional, never authoritative:
                ┌─────────────────┐
                │ LLM Adapter     │
                │ Extract/Explain  │
                └─────────────────┘
```

## 3. Architecture rules

### ARCH-001 — Backend authority
Backend Digital Twin owns operational state.

### ARCH-002 — Versioned state
Every material state change increments `state_version`.

Strategies are bound to both the scenario ID and state version used to generate them. Switching the active scenario invalidates approval from a previously active scenario.

### ARCH-003 — Snapshot optimization
Optimizer consumes a state snapshot/version and returns a strategy.

The active optimizer is a deterministic successive-shortest-path min-cost-flow
implementation over shared resource and demand capacities. Reverse residual
edges allow global reassignment across zones; it does not call OR-Tools.

### ARCH-004 — No optimizer mutation
Optimization cannot directly mutate active state.

### ARCH-005 — Approval gate
Only approval creates active allocation state.

### ARCH-006 — Event-driven adaptation
Simulation/incident events enter the same domain-event pipeline.

### ARCH-007 — Explainability separation
Evidence is generated alongside strategy; explanation consumes evidence.

### ARCH-008 — LLM isolation
LLM cannot create/modify decision variables or constraints.

### ARCH-009 — Audit on mutation
All state-changing commands and operator decisions create audit events.

### ARCH-010 — Deterministic demo
Urban Flood and Earthquake have deterministic, independently resettable scenario data and entity IDs.

### ARCH-011 — UI is not business authority
No allocation logic should live only in the frontend.

---

# 4. Services

| ID | Service | Responsibility |
|---|---|---|
| ARCH-012 | Scenario Service | Select and deterministically load/reset Urban Flood or Earthquake |
| ARCH-013 | Digital Twin Service | Maintain canonical state |
| ARCH-014 | Event Service | Validate/apply domain events |
| ARCH-015 | Prediction Service | Forecast resource shortages |
| ARCH-016 | Routing Service | Network distance/route feasibility |
| ARCH-017 | Optimization Service | Candidate strategy generation |
| ARCH-018 | Simulation/Chaos Service | Controlled state disruptions |
| ARCH-019 | Explainability Service | Evidence → deterministic explanation |
| ARCH-020 | Approval Service | Approve/modify/reject |
| ARCH-021 | Allocation Tracking Service | Lifecycle state |
| ARCH-022 | Audit Service | Append-only trace |
| ARCH-023 | Optional AI Adapter | NL extraction/wording |

---

# 5. State flow

```text
Event
  ↓
Validate
  ↓
Audit Event
  ↓
Apply to Twin
  ↓
state_version++
  ↓
Impact Detection
  ↓
Affected allocations?
  ├─ No → Continue monitoring
  └─ Yes
       ↓
  Prediction refresh
       ↓
  Route refresh
       ↓
  Strategy generation
       ↓
  Evidence
       ↓
  Operator review
       ↓
  Approve / Modify / Reject
```

---

# 6. Counterfactual strategy flow

```text
Same Twin Snapshot
      │
      ├── Baseline / Nearest
      ├── Severity-first
      ├── Balanced
      └── Coverage-first (optional)
                │
                ▼
        Metric calculation
                │
                ▼
       Side-by-side Strategy Lab
```

This makes the system more than a single optimizer: it shows why different objectives produce different allocations.

---

# 7. Dynamic reallocation

When a chaos event occurs:

1. Validate event.
2. Audit event.
3. Apply event transactionally.
4. Increment state version.
5. Identify impacted allocations/routes.
6. Recompute relevant predictions.
7. Recompute routes.
8. Generate replacement strategies.
9. Present the changed state and available impact information to the operator.
10. The operator explicitly generates and reviews a replacement recommendation.
11. Require approval before applying the replacement and superseding conflicting
    active allocations.
12. Record lifecycle and audit history. The event itself never reallocates.

---

# 8. Database architecture

The application persists through the configured SQLAlchemy database URL. The
local demonstration and tests use SQLite; PostgreSQL is a compatible deployment
option, not evidence of a live operational deployment. The current demonstration
uses a persisted synthetic road graph; external GIS ingestion is outside MVP.

Potential spatial extensions:
- coordinates,
- spatial queries,
- zone/facility proximity,
- road graph metadata where useful.

Core tables:
`scenarios, zones, hospitals, resource_sources, medicine_types, medicine_inventory, ambulances, road_nodes, road_edges, demands, incidents, forecasts, strategies, allocations, resource_passports, decisions, audit_events`.

---

# 9. Frontend architecture

```text
app/
components/
features/
  dashboard/
  map/
  strategy-lab/
  prediction/
  recommendation/
  simulation/
  tracking/
  audit/
lib/
  api/
types/
```

Frontend consumes typed APIs and does not contain authoritative allocation logic.

---

# 10. Backend architecture

```text
backend/
  app/
    main.py
  api/
  domain/
    models/
    events/
    services/
  digital_twin/
  optimization/
  routing/
  forecasting/
  simulation/
  explanation/
  ai/
  audit/
  persistence/
  tests/
```

---

# 11. Repository structure

```text
reliefos/
├── frontend/
├── backend/
│   └── app/persistence/seed_data.py  # Urban Flood and Earthquake configurations
├── docs/
├── docker-compose.yml
└── README.md
```

Both current scenario configurations are seeded in the backend persistence module; separate GIS ingestion and external scenario files are not required for MVP.

---

# 12. Deployment topology

```text
Vercel
  │
  │ HTTPS
  ▼
FastAPI on Render/Railway
  │
  ├── PostgreSQL/PostGIS
  ├── Optional WebSocket
  └── Optional LLM provider
```

For the hackathon, the system should remain usable locally with Docker Compose.

---

# 13. Architecture decisions

| ID | Decision |
|---|---|
| DEC-001 | Next.js + React + TypeScript |
| DEC-002 | Python + FastAPI |
| DEC-003 | Deterministic min-cost flow over the snapshot's shared supply/demand graph; no OR-Tools runtime dependency |
| DEC-004 | PostgreSQL/PostGIS |
| DEC-005 | Leaflet + OSM-compatible tiles |
| DEC-006 | Digital Twin as backend authority |
| DEC-007 | Versioned strategy approval |
| DEC-008 | Deterministic explanation baseline |
| DEC-009 | Optional LLM adapter |
| DEC-010 | Append-only hash-chained audit |
| DEC-011 | Seeded simulation |
| DEC-012 | Road graph for MVP routing |
