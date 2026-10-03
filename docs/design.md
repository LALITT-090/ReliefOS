# ReliefOS — UX/UI Design

## 1. Design objective

ReliefOS should feel like a **disaster operations command center**, not a generic admin dashboard.

The operator should be able to answer:

1. What is happening?
2. Where are the critical needs?
3. What resources are available?
4. What shortages are coming?
5. What strategies are possible?
6. Why is this recommendation being shown?
7. What changed?
8. What should I approve?
9. What happened afterward?

---

# 2. Global UI rules

- Persistent **SIMULATION MODE** banner.
- Accessible **Load / reset scenario** control for Urban Flood (primary) and Earthquake (alternate).
- Never label a recommendation as an “AI order”.
- Use **Recommendation**.
- Use **Estimate** for forecasts.
- Show **Confidence** only when derived from known inputs.
- Critical status must not rely on color alone.
- Use consistent resource terminology.
- Always show allocation/strategy version where relevant.

These terminology rules consolidate the supplied PRD's UI language guidance. fileciteturn3file0L438-L464

---

# 3. Navigation

```text
Overview
Situation Map
Predictions
Strategy Lab
Active Allocations
Simulation
Audit
```

---

# 4. Command Dashboard

## Header
- ReliefOS logo/name.
- Active scenario selector; switching loads that scenario's deterministic baseline and requires confirmation because its history is reset.
- Simulation mode.
- Current state version.
- Current allocation version.

## KPI cards
- Affected population.
- Critical demand.
- Available ambulances.
- Available ICU beds.
- Medicine shortage alerts.
- Active allocations.
- Unmet demand.
- Average ETA.

## Main panels
1. Critical alerts.
2. Live map preview.
3. Predicted shortages.
4. Active allocations.
5. Latest recommendation.
6. Recent events.

---

# 5. Situation Map

### Map layers
- Affected zones.
- Severity.
- Hospitals.
- Medicine/resource sources.
- Ambulances.
- Road states.
- Active routes.
- Blocked roads.

### Interaction
Clicking an entity opens details.

### Road state
Use:
- Normal.
- Risky.
- Blocked.

Do not rely on color alone.

---

# 6. Prediction screen

Each forecast card:

```text
Medicine: Antibiotic-X
Zone: Zone B
Current supply: 48
Estimated demand at T+60: 71
Estimated shortage: 23
Confidence: Medium
Drivers:
  Demand trend ↑
  Severity: High
  Delivery rate: Low
```

Forecasts must visibly be **estimates**.

---

# 7. Strategy Lab

The Strategy Lab is a core differentiator.

### Columns

| Metric | Baseline | Severity-first | Balanced |
|---|---:|---:|---:|
| Critical coverage | live | live | live |
| Unmet demand | live | live | live |
| Average ETA | live | live | live |
| Route risk | live | live | live |
| Predicted shortage | live | live | live |

Do not use a static “winner” label.

---

# 8. Recommendation Drawer

Show:

### Recommendation
Resource → Destination

### Why
Top 3–5 factual factors.

### Constraint status
- Inventory ✓
- Capacity ✓
- Route ✓
- Vehicle ✓
- Medicine type ✓

### Estimated impact
- Coverage.
- Unmet demand.
- ETA.
- Risk.

### Actions
- **Approve**
- **Modify**
- **Reject**

Approval button must communicate that the selected strategy will become active simulated allocation state.

---

# 9. Why panel

Example:

```text
WHY THIS RECOMMENDATION?

2 ambulances → Zone B

FACTORS
• 9 critical ambulance demand
• Zone B severity = High
• 1 local ambulance available
• Hospital H2 has 16 ICU beds available
• Feasible route ETA = 14 min

CONSTRAINTS
✓ Vehicle available
✓ Route open
✓ Capacity valid

ALTERNATIVE
Severity-first vs Balanced:
show live metrics

DATA
State version: 42
Prediction horizon: T+60
```

All numbers are generated from backend evidence.

---

# 10. Simulation / Chaos Panel

Presets:

- Road Block.
- Hospital Overload.
- Vehicle Failure.
- Demand Spike.
- Medicine Shortage.
- New Incident Zone.

Workflow:

```text
Select event
    ↓
Preview impact
    ↓
Apply event
    ↓
State version changes
    ↓
Impact detection
    ↓
Operator generates a replacement recommendation
    ↓
Review recommendation
    ↓
Approve
```

An event never automatically applies a replacement allocation; an operator must review and approve it.

After generating a replacement candidate, the Simulation page exposes an
explicit **Approve and apply replan** action. The candidate remains proposed
until that action succeeds; stale approval errors are surfaced to the operator.

---

# 11. Active Allocation Tracker

Use lifecycle columns:

```text
PROPOSED
APPROVED
DISPATCHED
IN TRANSIT
DELIVERED
VERIFIED
```

Each allocation links to:
- strategy,
- route,
- source,
- destination,
- resource,
- decision,
- audit events.

The Passport view exposes the persisted provenance and route snapshot, lifecycle
timestamps, recorded operator, strategy/scenario/incident references, linked
audit hashes and chain-verification result. Lifecycle changes are operator-
triggered simulation records, not GPS-confirmed movement or physical delivery
attestations.

---

# 12. Resource Passport

Show:

```text
Resource: Ambulance A-07

SOURCE
Station 2

DESTINATION
Zone B

ROUTE
Road R17 → R22 → R31

TIMELINE
10:02 Proposed
10:03 Approved
10:04 Dispatched
10:06 In Transit

APPROVED BY
Emergency Command Operator

STRATEGY
Balanced v12
```

---

# 13. Audit Timeline

Chronological feed:

```text
10:00 Scenario loaded
10:01 Strategy generated
10:03 Strategy approved
10:05 Road Block event
10:05 State version 43
10:06 Impact detected
10:06 Reallocation generated
10:08 Reallocation approved
```

Each event opens structured details.

---

# 14. Responsive behavior

Desktop-first.

Minimum useful width:
- 1280px recommended for full command-center layout.

Tablet support is desirable if low effort.

Mobile is not MVP priority.

---

# 15. Visual hierarchy

Priority order:
1. Critical alerts.
2. Current resource shortages.
3. Recommendation requiring action.
4. Strategy comparison.
5. Map context.
6. Audit/details.

Avoid excessive animation.
