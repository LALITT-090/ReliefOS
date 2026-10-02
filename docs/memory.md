# ReliefOS — Project Memory

## Identity
**Product:** ReliefOS  
**Description:** Self-Adaptive Disaster Resource Orchestration Platform  
**Problem:** ELEVATE PS-02 / EL-02  
**Primary demo:** Urban Flood  
**Mode:** Software-only simulated decision-support platform

---

## Canonical pitch

> ReliefOS predicts evolving resource needs, compares response strategies, and dynamically reallocates scarce resources as disaster conditions change — with every recommendation explainable and human-approved.

---

## Core loop

```text
Sense
→ Verify
→ Predict
→ Simulate
→ Optimize
→ Explain
→ Approve
→ Track
→ Audit
→ Adapt
```

---

## Locked team decisions

- Human approval is mandatory.
- Medicines are typed resources.
- Transport uses road/network distance.
- Disaster scenarios are separate configurations/types.
- Future shortage prediction is part of MVP.
- Authentication is not part of MVP.
- External LLM is not required.
- Deterministic explanation is the baseline.
- Optional LLM cannot control allocation.
- Four workstreams: frontend, backend, optimization/data, AI/integration.

---

## MVP resources

1. Ambulances.
2. ICU beds.
3. Typed medicines.

Additional resource types are extensibility, not MVP requirements.

---

## Architectural authority

```text
Digital Twin
     ↓
Prediction + Routing
     ↓
Optimization
     ↓
Strategy + Evidence
     ↓
Human Approval
     ↓
Active Allocation
     ↓
Audit
```

The frontend never becomes the source of truth.

---

## Trust boundary

The optimizer creates allocation recommendations.

The explanation engine explains the recommendation.

The optional LLM may improve wording.

The LLM never decides the allocation.

---

## Core differentiators

1. Digital Twin.
2. Counterfactual Strategy Lab.
3. Chaos Engine.
4. Dynamic Reallocation.
5. Explainability/Decision Trace.
6. Human Approval.
7. Resource Passport.
8. Hash-chained Audit.

These are product-design differentiators, not claims that the official problem statement explicitly names every module.

---

## Canonical scenario

Urban Flood:
- 5 affected zones.
- 4 hospitals.
- seeded road network.
- ambulances.
- ICU capacity.
- typed medicine inventory.
- synthetic demand.
- deterministic chaos events.

Exact quantities belong in scenario configuration files.

---

## Primary chaos events

- Road Block.
- Hospital Overload.
- Vehicle Failure.
- Demand Spike.
- Medicine Shortage.
- New Incident Zone.

---

## Strategy modes

- Baseline / Nearest.
- Severity-first.
- Balanced.
- Optional Coverage-first.

Do not claim a universal winner.

---

## Prediction

Horizons:
- T+30.
- T+60.
- T+120.

Baseline:
- rolling average + deterministic trend.

Prediction is an estimate.

---

## Audit

Use append-only audit events with:
- previous hash,
- current hash,
- canonical payload.

No blockchain.

---

## State safety

Every strategy stores the Digital Twin `state_version`.

Approval must be rejected/revalidated if the live state has materially changed.

---

## Technology

- Next.js.
- React.
- TypeScript.
- Tailwind.
- Leaflet.
- OpenStreetMap-compatible tiles.
- Python.
- FastAPI.
- Pydantic.
- OR-Tools.
- PostgreSQL/PostGIS.
- pandas.
- optional scikit-learn.
- Pytest.
- Playwright.
- Docker.
- GitHub.

---

## Claims discipline

Never claim:
- real government integration,
- AI disaster prediction,
- autonomous allocation,
- perfect accuracy,
- blockchain security,
- offline operation,
- real-world medical outcomes.

---

## Stable identifiers

- `REQ-*` — Product requirement.
- `US-*` — User story.
- `BR-*` — Business/system rule.
- `ARCH-*` — Architecture.
- `API-*` — API contract.
- `DATA-*` — Data entity.
- `TASK-*` — Implementation task.
- `DEC-*` — Decision.

---

## Documentation rule

Any material implementation change must update:
1. PRD.
2. TRD.
3. Architecture.
4. Rules.
5. Design.
6. Tasks.
7. Memory.
8. Traceability/PPT claims.
