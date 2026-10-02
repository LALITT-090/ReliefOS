# ReliefOS — Rules, Constraints & Invariants

## 1. Core invariants

### BR-001 — No over-allocation
`allocated_quantity <= available_quantity`

### BR-002 — ICU capacity
`planned_icu_arrivals <= available_icu_capacity` within the configured planning window.

### BR-003 — Medicine type integrity
A medicine demand can only be satisfied by the same medicine type unless a future explicit substitution rule exists.

### BR-004 — Reserve stock
Inventory reserve must remain above configured minimum unless an explicit emergency override is enabled.

### BR-005 — Ambulance exclusivity
An ambulance cannot hold conflicting active assignments.

### BR-006 — Route feasibility
Blocked road edges cannot be part of an approved route.

### BR-007 — Road distance
Transport cost must use network/road distance or network travel time. Straight-line distance must not silently replace it.

### BR-008 — Severity
Severity must influence allocation priority through a documented optimization factor.

### BR-009 — Prediction distinction
Predicted quantities are estimates and must remain visually/data-model distinct from current measured quantities.

### BR-010 — Prediction confidence
Low-confidence prediction must not silently become a hard operational fact.

### BR-011 — Reallocation
A material state change creates a new strategy/allocation version.

### BR-012 — No silent overwrite
Superseded allocations remain in history.

### BR-013 — Human approval
A recommendation cannot become an active allocation without operator approval.

### BR-014 — Stale approval protection
A strategy based on a materially older state version cannot be approved without revalidation.

### BR-015 — Audit
Every state mutation and operator decision must have an audit record.

### BR-016 — Deterministic demo
The primary demo scenario and event payloads must be reproducible.

---

# 2. Optimization rules

### BR-017
Hard constraints are never traded away for a better objective score.

### BR-018
If no feasible solution exists, the system reports infeasibility and unmet demand rather than fabricating a plan.

### BR-019
Strategy scores are scenario-specific decision metrics, not universal quality scores.

### BR-020
The UI shall present multiple strategies without declaring an unsupported universal winner.

---

# 3. Explanation rules

### AI-001 — Evidence only
Every factual explanation factor must exist in the strategy snapshot/evidence.

### AI-002 — No invented numbers
The explanation cannot invent demand, capacity, route distance, severity, ETA or confidence.

### AI-003 — Deterministic baseline
Useful explanations must work without an LLM.

### AI-004 — LLM non-authority
An LLM may summarize/explain validated evidence but may not choose allocations.

### AI-005 — LLM failure
LLM failure falls back to deterministic templates.

### AI-006 — Unknowns
If a required fact is unavailable, explanation must state that it is unavailable rather than guessing.

---

# 4. State transition rules

## Strategy

```text
GENERATED
   ├── APPROVED
   │      └── ACTIVE
   ├── REJECTED
   └── STALE → REVALIDATE
```

## Allocation

```text
PROPOSED → APPROVED → DISPATCHED → IN_TRANSIT → DELIVERED → VERIFIED
```

Not every demo allocation needs to complete every transition.

---

# 5. Event rules

A material event may trigger re-planning if it causes:
- route blockage/high risk,
- hospital capacity conflict,
- ambulance unavailability,
- inventory/reserve conflict,
- critical demand increase,
- new high-severity zone.

Every accepted event:
1. validates,
2. audits,
3. updates the Digital Twin,
4. increments state version,
5. runs impact detection.

---

# 6. Simulation rules

### SIM-001
Simulation events are clearly marked `source=simulation`.

### SIM-002
Simulation uses deterministic payloads in the primary demo.

### SIM-003
Simulation cannot bypass approval for allocation changes.

### SIM-004
Reset restores the exact baseline state.

### SIM-005
A chaos event may intentionally create an infeasible condition; the system must report that condition safely.

---

# 7. Data validation

### VAL-001
Quantities are non-negative.

### VAL-002
Coordinates are valid latitude/longitude values.

### VAL-003
Entity references belong to the active scenario.

### VAL-004
Medicine records require medicine type.

### VAL-005
State versions are monotonically increasing.

### VAL-006
Allocation versions are unique.

### VAL-007
Audit event hashes form a valid chain.

---

# 8. Security and responsible use

### SEC-001
No authentication required in MVP.

### SEC-002
Secrets never appear in frontend source.

### SEC-003
API mutation payloads are validated server-side.

### SEC-004
Synthetic data only.

### SEC-005
No patient PII/PHI.

### SEC-006
Simulation banner remains visible.

---

# 9. Failure rules

| Failure | Rule |
|---|---|
| LLM unavailable | Core product remains operational. |
| Optimizer infeasible | Explain infeasibility; do not fabricate allocation. |
| Routing unavailable | Use prepared network data or explicitly fail. |
| Map unavailable | Tables remain usable. |
| Stale strategy | Require regeneration/revalidation. |
| Database disconnected | Client cannot become source of truth. |
| Invalid event | Reject or return controlled validation error. |
