# ReliefOS — Product Requirements Document (PRD)

**Version:** 2.0  
**Status:** Consolidated hackathon baseline  
**Problem Statement:** ELEVATE PS-02 / EL-02 — Intelligent & Transparent Disaster Relief Resource Allocation  
**Product:** ReliefOS — Self-Adaptive Disaster Resource Orchestration Platform

> **Single source of truth:** software, demo, architecture, UI terminology and presentation claims must conform to this PRD. A feature is not considered implemented until its acceptance criteria are demonstrated by working software.

---

## 0. Consolidation decision

This PRD combines the strongest product ideas from the original team PRD and the supplied **ReliefOS PRD v1.0**, while preserving the team's already-locked decisions.

### Locked team decisions
1. **Human approval is mandatory** before a recommendation becomes an applied simulated allocation.
2. **Medicines are modeled by distinct medicine types**, not as one generic medicine quantity.
3. **Transport uses road/network distance**, not straight-line distance.
4. **Disaster scenarios are separate configurations/types**, while sharing the same platform architecture.
5. **Future shortage prediction is included in the MVP.**
6. **Authentication is excluded from the MVP.**
7. **The core product must work without an external LLM API.** Deterministic explanations are the baseline; an optional LLM adapter may enhance wording later.
8. Team workstreams are **Frontend / Backend / Optimization-Data / AI-Integration**.

### What is adopted from the supplied ReliefOS PRD
The supplied PRD contributes the strongest closed-loop product framing: **Sense → Verify → Predict → Simulate → Optimize → Explain → Execute → Track → Adapt**, the Digital Twin, Counterfactual Simulator, Chaos Engine, strategy comparison, resource provenance, decision trace, state versioning, append-only audit/hash chaining, deterministic demo scenarios, explicit failure handling, and PRD-to-software traceability. These are solution-design decisions rather than claims that every named module is explicitly required by the official problem statement. fileciteturn3file0L46-L55

---

# 1. Official problem interpretation

EL-02 requires a software system that dynamically allocates scarce disaster-response resources as conditions change, considering factors such as demand, severity, hospital capacity, transport constraints, resource availability and geography, while providing transparency/traceability and demonstrating changing conditions and reallocation through simulation. The supplied ReliefOS PRD also interprets the problem as supporting resources such as hospital capacity, ambulances and relief supplies. fileciteturn3file0L46-L55

### Requirement vs solution distinction

**Problem-derived requirements**
- Dynamic allocation.
- Changing disaster conditions.
- Demand/severity/capacity/availability/geography/transport considerations.
- Transparent and traceable decisions.
- Simulation/reallocation demonstration.

**Our solution design**
- Digital Twin.
- Counterfactual Simulator.
- Chaos Engine.
- Strategy comparison.
- Resource Passport.
- Decision Trace.
- Prediction engine.
- Human approval workflow.
- Hash-chained audit events.
- Deterministic seeded scenarios.

---

# 2. Product vision

ReliefOS is a **decision-intelligence and orchestration platform for simulated disaster response**. It maintains a versioned operational model, estimates emerging resource shortages, compares feasible response strategies, explains recommendations, requires human approval, tracks applied allocations, and adapts when the simulated situation changes.

### One-line pitch

> **ReliefOS predicts evolving resource needs, compares response strategies, and dynamically reallocates scarce resources as disaster conditions change — with every recommendation explainable and human-approved.**

The closed-loop product framing is intentionally adapted from the supplied PRD's Sense/Verify/Predict/Simulate/Optimize/Explain/Execute/Track/Adapt model. fileciteturn3file0L125-L141

---

# 3. Goals

| ID | Goal |
|---|---|
| G-001 | Produce feasible allocations under explicit operational constraints. |
| G-002 | Reduce weighted unmet critical demand in the simulated scenario. |
| G-003 | Account for road/network transport cost and route availability. |
| G-004 | Detect and estimate future shortages before they become critical in the simulation. |
| G-005 | Re-plan after material changes such as road closure, hospital overload, vehicle failure or demand spike. |
| G-006 | Make recommendations understandable through structured evidence. |
| G-007 | Keep a human coordinator in control of high-impact allocation decisions. |
| G-008 | Preserve a traceable history of state changes, recommendations, approvals and reallocations. |
| G-009 | Produce a deterministic, repeatable hackathon demonstration. |

---

# 4. Non-goals

ReliefOS v2.0 will **not**:
- Operate certified real-world emergency command infrastructure.
- Autonomously dispatch real ambulances or public-safety assets.
- Make patient-level diagnoses or clinical decisions.
- Claim real-time government-data integration without an actual integration.
- Require blockchain.
- Claim perfect prediction accuracy.
- Treat synthetic simulation outputs as real emergency data.
- Require authentication for the MVP.
- Depend on an LLM for optimization or core operation.
- Perform complex multi-hazard physics simulation.

---

# 5. Users and actors

## 5.1 Primary actor — Emergency Command Operator

Responsibilities:
- View the current situation.
- Review predicted shortages.
- Generate and compare strategies.
- Inspect recommendation evidence.
- Approve, modify or reject recommendations.
- Trigger controlled simulation events.
- Review reallocation and audit history.

## 5.2 Conceptual actors

| Actor | MVP role |
|---|---|
| Emergency Command Operator | Approval and operational decisions |
| Hospital Coordinator | Data entity/workflow; maintains simulated capacity |
| Warehouse/Resource Coordinator | Data entity/workflow; maintains simulated inventory |
| Field Responder | Optional incident-report source |
| Observer/Judge | Read-only conceptual view; no authentication required |

Authentication is intentionally outside MVP scope.

---

# 6. Canonical terminology

| Term | Definition |
|---|---|
| **Digital Twin** | Backend-maintained authoritative simulated state of zones, facilities, roads, resources, incidents and allocations. |
| **Scenario** | A configured disaster environment with its own entities, demand patterns, resource state and event script. |
| **Incident** | An event that changes disaster state or creates/changing demand. |
| **Resource** | An assignable or consumable emergency asset. |
| **Demand** | Required/estimated quantity of a resource for a location or facility. |
| **Strategy** | A complete candidate allocation plan produced for comparison. |
| **Recommendation** | The strategy selected for operator review; it is not yet an active allocation. |
| **Counterfactual Simulator** | Evaluates candidate strategies or controlled future events before/around execution. |
| **Chaos Event** | A controlled simulation event that changes the Digital Twin. |
| **Dynamic Reallocation** | Re-running impact analysis and optimization after a material state change. |
| **Resource Passport** | Trace history of an allocated resource/batch from source through simulated lifecycle. |
| **Decision Trace** | Facts, constraints, objective contributions and operator action supporting a recommendation. |
| **State Version** | Monotonic version of the Digital Twin used to detect stale recommendations. |

The supplied PRD establishes the same core vocabulary around Digital Twin, Strategy, Counterfactual Simulation, Chaos Event, Dynamic Reallocation, Resource Passport and Decision Trace. fileciteturn3file0L99-L124

---

# 7. MVP resource model

## 7.1 Core resources

### R-001 Ambulances
Assignable assets with:
- current location,
- availability,
- status,
- capacity,
- assigned allocation,
- route.

### R-002 ICU beds
Facility capacity with:
- total ICU beds,
- available ICU beds,
- occupancy,
- destination hospital.

### R-003 Typed medicines
Consumable inventory with:
- medicine type,
- quantity,
- reserve quantity,
- source facility/warehouse,
- demand type.

**Medicine-type integrity:** one medicine type cannot silently satisfy demand for another type unless a future explicit substitution rule is configured.

## 7.2 Extensibility

The data model may support additional resource classes such as rescue teams or relief supplies later, but they are **not required to be fully implemented for the MVP**.

---

# 8. End-to-end product loop

```text
SENSE
  ↓
VERIFY
  ↓
PREDICT
  ↓
SIMULATE / COMPARE
  ↓
OPTIMIZE
  ↓
EXPLAIN
  ↓
HUMAN APPROVAL
  ↓
APPLY / TRACK
  ↓
AUDIT
  ↓
ADAPT
  ↓
RE-OPTIMIZE
```

### Step definitions

1. **Sense** — receive scenario state, resource updates and simulation events.
2. **Verify** — validate schema, references, timestamps and confidence where applicable.
3. **Predict** — estimate near-term resource demand/shortage risk.
4. **Simulate** — evaluate candidate strategies and controlled disruption events.
5. **Optimize** — generate feasible allocations using hard constraints and objective terms.
6. **Explain** — produce evidence-grounded reasons and comparison metrics.
7. **Human approval** — operator approves, modifies or rejects.
8. **Apply/Track** — approved plan enters simulated allocation lifecycle.
9. **Audit** — record state-changing action and operator decision.
10. **Adapt** — material state changes trigger impact analysis and reallocation.

---

# 9. MVP modules

| ID | Module | Outcome | Priority |
|---|---|---|---|
| M-001 | Command Dashboard | KPIs, alerts, active allocations, prediction summary | MUST |
| M-002 | Live Disaster Map | Zones, hospitals, resources and road-state overlays | MUST |
| M-003 | Digital Twin Engine | Single authoritative simulated state | MUST |
| M-004 | Resource Optimization | Feasible allocation recommendations | MUST |
| M-005 | Routing & Rerouting | Road-network distance and blocked-route handling | MUST |
| M-006 | Counterfactual Simulator | Compare multiple feasible strategies | MUST |
| M-007 | Prediction Engine | Near-term shortage estimates | MUST |
| M-008 | Chaos Engine | Controlled disruption events | MUST |
| M-009 | Dynamic Reallocation | Impact detection + replacement plan | MUST |
| M-010 | Explainability | Evidence-grounded recommendation reasons | MUST |
| M-011 | Human Approval | Approve/modify/reject recommendation | MUST |
| M-012 | Tracking & Audit | Allocation lifecycle + trace history | MUST |
| M-013 | Scenario Manager | Load/reset/replay deterministic scenarios | MUST |
| M-014 | Optional AI Adapter | Natural-language extraction/explanation enhancement | SHOULD |

---

# 10. Functional requirements

## Scenario and Digital Twin

| ID | Requirement | Priority |
|---|---|---|
| REQ-001 | System shall support multiple disaster scenario types/configurations through shared platform logic. | MUST |
| REQ-002 | System shall load and reset deterministic seeded scenarios. | MUST |
| REQ-003 | Backend shall own the authoritative Digital Twin state. | MUST |
| REQ-004 | Accepted state-changing events shall update the Digital Twin and increment its state version. | MUST |
| REQ-005 | System shall display affected locations, facilities, resources, roads and active allocations. | MUST |

## Resources and demand

| ID | Requirement | Priority |
|---|---|---|
| REQ-006 | System shall expose resource availability by type and location. | MUST |
| REQ-007 | System shall support ambulance assignment. | MUST |
| REQ-008 | System shall support ICU capacity constraints. | MUST |
| REQ-009 | System shall support medicine inventory by medicine type. | MUST |
| REQ-010 | System shall represent location-level demand and severity/urgency. | MUST |

## Routing

| ID | Requirement | Priority |
|---|---|---|
| REQ-011 | System shall use a road/network graph for transport cost. | MUST |
| REQ-012 | Blocked/infeasible road edges shall not be used in approved routes. | MUST |
| REQ-013 | Road-state changes shall be able to trigger impact analysis. | MUST |

## Prediction

| ID | Requirement | Priority |
|---|---|---|
| REQ-014 | System shall estimate future demand/shortage risk for configured horizons. | MUST |
| REQ-015 | Forecast output shall be labelled as an estimate, not a fact. | MUST |
| REQ-016 | Prediction shall expose enough inputs/metrics to support explanation. | MUST |

## Optimization and strategies

| ID | Requirement | Priority |
|---|---|---|
| REQ-017 | System shall generate a feasible initial allocation strategy. | MUST |
| REQ-018 | System shall enforce inventory, capacity, assignment and route constraints. | MUST |
| REQ-019 | System shall consider demand and severity in the objective. | MUST |
| REQ-020 | System shall consider transport cost/distance. | MUST |
| REQ-021 | System shall be able to consider predicted shortage risk. | MUST |
| REQ-022 | System shall generate at least three candidate strategies from the same scenario state for the primary demo. | MUST |
| REQ-023 | Strategy comparison shall show coverage/unmet demand and transport/ETA metrics where applicable. | MUST |

## Approval and adaptation

| ID | Requirement | Priority |
|---|---|---|
| REQ-024 | Operator shall approve, modify or reject a recommendation. | MUST |
| REQ-025 | Only an approved recommendation may become an active simulated allocation. | MUST |
| REQ-026 | System shall detect material changes affecting active allocations. | MUST |
| REQ-027 | System shall generate a revised feasible plan after material changes. | MUST |
| REQ-028 | Old conflicting allocations shall be superseded, not silently overwritten. | MUST |
| REQ-029 | A strategy generated against an obsolete state version shall require revalidation/regeneration before approval. | MUST |

## Explainability and traceability

| ID | Requirement | Priority |
|---|---|---|
| REQ-030 | Every recommendation shall include structured decision evidence. | MUST |
| REQ-031 | Explanation shall list factual factors from the strategy snapshot. | MUST |
| REQ-032 | Explanation shall show relevant constraint checks. | MUST |
| REQ-033 | Explanation shall show predicted/estimated impact where available. | MUST |
| REQ-034 | System shall maintain an allocation lifecycle/history. | MUST |
| REQ-035 | System shall maintain an append-only audit history of state changes and operator decisions. | MUST |
| REQ-036 | System shall support resource provenance/passport information for at least one demo allocation. | MUST |

---

# 11. Prediction specification

Prediction is a **MVP requirement for this team**, while the supplied friend PRD treated forecasting as SHOULD-have. This consolidation intentionally promotes it because the team explicitly chose future shortage prediction.

### Forecast horizons
- T+30 minutes.
- T+60 minutes.
- T+120 minutes.

### Candidate inputs
- Recent simulated demand.
- Affected population.
- Severity.
- Current inventory/availability.
- Consumption/delivery rate.
- Facility capacity/inflow.

### MVP method
Start with a transparent deterministic trend + rolling-average baseline. A lightweight regression model may be added only if synthetic history is sufficient and the baseline is stable.

### Output
- Resource type.
- Medicine type where applicable.
- Location.
- Horizon.
- Predicted demand.
- Projected supply.
- Estimated shortage.
- Lower/upper bound where available.
- Confidence/risk indicator.

No forecast may be represented as certainty.

---

# 12. Optimization model

## 12.1 Principle

The optimizer is authoritative for allocation generation.

> **LLM/AI does not choose the final allocation.**

## 12.2 Conceptual objective

Minimize a weighted objective:

```text
Score =
  w1 * UnmetCriticalDemand
+ w2 * TravelTime
+ w3 * RouteRisk
+ w4 * CapacityOverloadPenalty
+ w5 * PredictedShortagePenalty
+ w6 * OptionalCoveragePenalty
```

Weights are configuration values and must not be presented as scientifically validated weights.

## 12.3 Hard constraints

- Allocation quantity ≤ available quantity.
- ICU allocation ≤ available ICU capacity.
- Medicine quantity ≤ inventory minus required reserve.
- Medicine demand type must match medicine type.
- Ambulance cannot have conflicting active assignments.
- Blocked roads cannot be used.
- Transport assignments must satisfy configured feasibility rules.
- Quantities must be non-negative and integer where required.

---

# 13. Strategy modes

For the primary demo, generate at least three strategies:

| Strategy | Purpose |
|---|---|
| **Baseline / Nearest** | Minimize immediate transport distance/time; benchmark. |
| **Severity-first** | Prioritize critical/urgent demand. |
| **Balanced** | Trade off severity, coverage, travel time, risk and shortage protection. |

Optional fourth:
- **Coverage-first** — reduce underserved locations.

The system should display metrics rather than declaring a universal “best” strategy.

---

# 14. Chaos Engine

The primary demo should support deterministic versions of:

| ID | Event | Expected effect |
|---|---|---|
| CE-001 | Road Block | Route becomes unavailable/riskier; impacted allocations identified. |
| CE-002 | Hospital Overload | Available ICU capacity falls; destinations may change. |
| CE-003 | Vehicle Failure | Ambulance becomes unavailable; dependent allocation is replanned. |
| CE-004 | Demand Spike | Demand rises; strategy metrics and allocations change. |
| CE-005 | Medicine Shortage | Inventory falls below plan/reserve; alternate source/reallocation considered. |
| CE-006 | New Incident Zone | New affected location and demand are introduced. |

Events are deterministic in the main demo so judging produces repeatable results.

The supplied PRD defines the same six core disruption types and explicitly recommends deterministic payloads for the primary demo. fileciteturn3file0L385-L402

---

# 15. Explainability

Every recommendation must expose:
- Destination and resource assignment.
- Top 3–5 factual decision factors.
- Constraint checks.
- Estimated effect on coverage/unmet demand/ETA/risk.
- Alternative strategy comparison.
- Data freshness/confidence when relevant.

Example:

> **Recommendation:** Allocate 2 ambulances to Zone B.  
> **Why:** critical demand is high, local availability is low, Hospital C has available capacity, and the feasible road route has the lowest configured transport cost.  
> **Alternative:** Severity-first vs Balanced metrics are shown side-by-side.

This follows the supplied PRD's grounded explanation model while keeping all facts tied to the current strategy snapshot. fileciteturn3file0L403-L419

---

# 16. Human approval and allocation lifecycle

```text
PROPOSED
   ↓
APPROVED / REJECTED
   ↓
DISPATCHED
   ↓
IN_TRANSIT
   ↓
DELIVERED
   ↓
VERIFIED
```

For the MVP simulation, not every lifecycle transition needs to be physically realistic; the state machine exists to demonstrate traceability.

**Critical rule:** approval is required before the recommendation changes the active simulated allocation.

---

# 17. Resource Passport

At least one demo resource/batch must show:
- Resource/batch ID.
- Source.
- Destination.
- Quantity.
- Assigned vehicle where applicable.
- Route snapshot.
- State transitions.
- Timestamps.
- Approving operator.
- Associated strategy/incident.
- Audit-event references.

---

# 18. Audit integrity

Use an append-only `AuditEvent` record.

Each event contains:
- event ID,
- event type,
- actor,
- entity,
- timestamp,
- payload,
- previous hash,
- event hash.

The hash is computed from the canonical event payload plus the previous event hash.

This provides tamper-evidence without introducing blockchain.

---

# 19. Primary demo scenario

## Scenario: Urban Flood

The supplied PRD uses a deterministic urban-flood scenario as its primary demonstration. We retain this because it exercises roads, hospitals, vehicles and resource shortages clearly. fileciteturn3file0L569-L582

### Suggested seeded baseline
- 5 affected zones.
- 4 hospitals.
- 3 resource/medicine supply locations where needed.
- 12 ambulances.
- Multiple ICU beds.
- Multiple typed medicines.
- Predefined road graph with normal/risky/blocked states.
- Synthetic affected population and demand.

Exact quantities are demo configuration, not real-world evidence.

### Demo sequence

**D0 — Load**
- Load/reset urban-flood scenario.
- Show map and Digital Twin.

**D1 — Compare**
- Generate 3+ strategies.
- Compare metrics.

**D2 — Approve**
- Operator reviews evidence.
- Approves recommendation.
- Active allocation appears.

**D3 — Road Block**
- Trigger road block.
- Show affected route/allocation.
- Generate replacement strategy.

**D4 — Hospital Overload**
- Reduce available ICU capacity.
- Show changed destination planning.

**D5 — Demand Spike**
- Increase demand.
- Show changed shortage estimate and allocation.

**D6 — Trace**
- Open Resource Passport.
- Open Audit Timeline.
- Show state versions and before/after allocation.

---

# 20. Product/demo metrics

| Metric | Target/behavior |
|---|---|
| Allocation feasibility | 100% of approved generated plans satisfy hard constraints |
| Replan latency | Target <5 seconds on demo scenario |
| Strategy count | ≥3 candidates from same state |
| Critical coverage | Display per strategy; no invented universal target |
| Unmet demand | Display and compare against baseline |
| Average ETA | Display where route data exists |
| Audit completeness | 100% of state-changing actions have audit records |
| Explanation grounding | 100% of displayed factors exist in strategy snapshot |
| Scenario reproducibility | Reset returns to deterministic baseline |

The supplied PRD uses a <5 second demo re-plan target and requires feasibility, audit completeness and explanation grounding; these are retained as implementation targets rather than real-world performance claims. fileciteturn3file0L594-L607

---

# 21. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-001 | Scenario reset shall return to deterministic baseline. |
| NFR-002 | Core strategy generation should complete within 5 seconds on the demo dataset. |
| NFR-003 | Frontend and backend shall use the same state version and allocation identifiers. |
| NFR-004 | Explanations shall not cite factors absent from the strategy snapshot. |
| NFR-005 | State mutations and operator decisions shall be timestamped and protected from normal UI editing. |
| NFR-006 | Mutation inputs shall be validated server-side. |
| NFR-007 | Demo data shall be synthetic/non-personal. |
| NFR-008 | Core optimizer/simulator shall continue if the optional LLM service is unavailable. |
| NFR-009 | Primary scenario and event sequence shall be reproducible. |
| NFR-010 | Critical status shall not be conveyed by color alone. |

---

# 22. Responsible-use rules

- A visible **SIMULATION MODE** indicator must distinguish synthetic data from live emergency operations.
- No patient names, diagnoses or protected health information.
- No direct public-safety dispatch integration.
- No unsupported claim of real-time government integration.
- Forecasts are estimates.
- Operator approval remains required.
- Secrets remain server-side.
- Optional LLM receives minimized structured data where possible.

---

# 23. Failure behavior

| Failure | Required fallback |
|---|---|
| LLM unavailable | Deterministic explanation and core optimizer continue. |
| Map tiles unavailable | Tables/list views remain usable; cached/preloaded geometry may be used. |
| Routing unavailable | Use prepared demo network matrix or fail explicitly; never silently use straight-line distance. |
| Optimizer infeasible | Show infeasibility reason/unmet demand; never fabricate a plan. |
| Database reconnect | Client state never becomes authoritative truth. |
| Stale recommendation | Approval blocked until revalidated/regenerated. |
| Invalid chaos event | Reject or surface controlled infeasibility. |
| Prediction unavailable | Mark prediction unavailable; current-state optimization may continue. |

---

# 24. Security

Authentication is **not part of MVP**.

Still required:
- Backend-only secrets.
- API validation.
- No API keys in frontend code.
- CORS configuration for deployed frontend.
- No sensitive real-world personal data.
- Explicit simulation mode.

---

# 25. Technology decisions

| Layer | Choice |
|---|---|
| Frontend | Next.js + React + TypeScript |
| Styling | Tailwind CSS |
| Map | Leaflet + OpenStreetMap-compatible tiles |
| Backend | Python 3.11+ + FastAPI |
| Optimization | Google OR-Tools |
| Database | PostgreSQL; Supabase may host PostgreSQL |
| Geo | PostGIS + predefined road graph/routing adapter |
| Prediction | Python + pandas; scikit-learn only if justified |
| Validation | Pydantic |
| Realtime | FastAPI WebSockets, optional after core loop |
| Testing | Pytest + Playwright |
| Deployment | Vercel frontend + Render/Railway backend + managed PostgreSQL |
| Version control | GitHub |
| LLM | Optional adapter; no provider required for core MVP |

The supplied PRD uses Next.js/React/TypeScript, FastAPI, OR-Tools, PostgreSQL/Supabase, Leaflet/OSM, Pydantic, Pytest/Playwright and Vercel/Render/Railway. fileciteturn3file0L484-L513

---

# 26. Acceptance / Definition of Done

- [ ] At least two scenario configurations exist; urban flood is the primary demo.
- [ ] Scenario reset is deterministic.
- [ ] Digital Twin is backend-authoritative.
- [ ] Map displays core entities and road states.
- [ ] Three core resource classes work: ambulances, ICU beds, typed medicines.
- [ ] Road-network distance is used.
- [ ] At least three strategies can be generated.
- [ ] Hard constraints are enforced.
- [ ] Future shortage estimates are visible.
- [ ] Operator can approve/reject a recommendation.
- [ ] Approval is required before applying an allocation.
- [ ] Road Block causes visible impact and replanning.
- [ ] Hospital Overload changes destination/capacity planning.
- [ ] Demand Spike or Vehicle Failure causes replanning.
- [ ] Recommendation includes grounded explanation.
- [ ] Resource Passport is demonstrated.
- [ ] Audit timeline is demonstrated.
- [ ] State version prevents stale approval.
- [ ] Core loop works with LLM disabled.
- [ ] Demo uses only synthetic data.
- [ ] Presentation claims can be traced to working software.

---

# 27. Risks

| Risk | Mitigation |
|---|---|
| Scope creep | Freeze MUST scope; defer optional AI/realtime features. |
| Weak optimizer | Start with explicit hard constraints and baseline strategy. |
| Routing complexity | Use predefined road graph for MVP. |
| Prediction overclaim | Label forecasts as estimates and show uncertainty. |
| LLM hallucination | LLM has no decision authority; evidence-grounded prompts only. |
| State desynchronization | Backend Digital Twin + state version. |
| Demo randomness | Seeded scenario and deterministic chaos events. |
| UI polish consumes time | Build functional loop before visual refinement. |

---

# 28. Traceability summary

| PRD | Technical | Architecture | Rules | Task |
|---|---|---|---|---|
| REQ-001..005 | TR-001..006 | ARCH-001..003 | BR-010 | TASK-007..014 |
| REQ-006..010 | TR-002..006 | ARCH-003/010 | BR-001..004 | TASK-007..014 |
| REQ-011..013 | TR-007 | ARCH-006 | BR-007/008 | TASK-015..018 |
| REQ-014..016 | TR-011/012 | ARCH-005 | BR-009 | TASK-028..032 |
| REQ-017..023 | TR-008..010 | ARCH-004 | BR-001..009 | TASK-019..027 |
| REQ-024..029 | TR-013..015 | ARCH-003/011 | BR-010/011 | TASK-057..059 |
| REQ-030..036 | TR-016..019 | ARCH-007/009 | BR-013/014 + AI rules | TASK-060..063 |

---

# 29. Claims we must not make without evidence

- “Real-time government integration.”
- “AI predicts disasters.”
- “Saves X% more lives.”
- “100% accurate.”
- “Zero hallucinations.”
- “Blockchain secured.”
- “Works offline.”
- “Autonomous allocation.”

Preferred language:
- **decision support**
- **adaptive recommendation**
- **simulated disaster environment**
- **estimated future demand**
- **evidence-grounded explanation**

---

# 30. Change control

Every material scope change must:
1. Update this PRD.
2. Update affected TRD/architecture/rules/design/tasks/memory.
3. Update the traceability matrix.
4. Update the demo/PPT claims.
5. Record a DEC identifier.
