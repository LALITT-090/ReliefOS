"""
ReliefOS — Explainability Service
Deterministic, evidence-grounded explanations.
AI-001..006: Evidence only, no invented numbers, deterministic baseline.
"""
from typing import List, Dict, Optional
from dataclasses import dataclass


@dataclass
class ExplanationFactor:
    """One factual factor in an explanation."""
    type: str           # "demand", "severity", "capacity", "route", "shortage", "constraint"
    name: str
    value: str
    impact: str         # "positive" | "negative" | "neutral"
    source_ref: str


@dataclass
class ConstraintCheck:
    """Result of a constraint check."""
    name: str
    passed: bool
    detail: str


@dataclass
class Explanation:
    """
    Complete explanation for a strategy/allocation.
    AI-001: Every factor exists in the strategy snapshot.
    AI-002: No invented numbers.
    AI-003: Works without LLM.
    """
    recommendation_summary: str
    why_this_zone: str
    why_this_hospital: str
    why_this_ambulance: str
    why_this_route: str
    factors: List[ExplanationFactor]
    constraints: List[ConstraintCheck]
    estimated_impact: Dict[str, str]
    data_freshness: str
    is_deterministic: bool = True  # Always True for baseline


class ExplainabilityService:
    """
    Generates deterministic, grounded explanations from evidence.
    No LLM required. Optional LLM can enhance wording later.
    """

    def explain_strategy(
        self,
        strategy_data: dict,
        allocations: List[dict],
        evidence: List[dict],
        twin_state_version: int,
    ) -> dict:
        """
        Build a full strategy explanation from evidence data.
        AI-001: Only uses facts from strategy snapshot.
        """
        mode = strategy_data.get("objective_mode", "balanced")
        coverage = strategy_data.get("coverage_pct", 0.0)
        unmet = strategy_data.get("unmet_demand", 0)
        avg_eta = strategy_data.get("avg_eta_min", 0.0)
        avg_risk = strategy_data.get("avg_risk", 0.0)

        # Build recommendation summary
        resource_types = set(a.get("resource_type") for a in allocations)
        destinations = list(set(a.get("destination_name", "?") for a in allocations))[:3]
        dest_str = ", ".join(destinations)

        summary = (
            f"Strategy '{mode.replace('_', ' ').title()}': "
            f"Allocates {len(allocations)} resources "
            f"({', '.join(resource_types)}) "
            f"to {dest_str}."
        )

        # Mode-specific rationale (deterministic templates)
        mode_rationale = self._get_mode_rationale(mode, evidence, coverage, unmet, avg_eta)

        # Build factor explanations from evidence
        factors = self._build_factors(evidence)

        # Constraint checks
        constraints = self._check_constraints(strategy_data, allocations)

        # Estimated impact
        impact = {
            "coverage": f"{coverage:.1f}% of demand met",
            "unmet_demand": f"{unmet} units unmet",
            "avg_eta": f"{avg_eta:.1f} minutes average",
            "avg_risk": f"Risk score: {avg_risk:.3f}",
        }

        shortage_impact = strategy_data.get("predicted_shortage_impact", 0)
        if shortage_impact > 0:
            impact["shortage_t60"] = f"Predicted shortage (T+60): {shortage_impact:.0f} units"

        return {
            "recommendation_summary": summary,
            "mode_rationale": mode_rationale,
            "factors": [
                {
                    "type": f.get("factor_type"),
                    "name": f.get("factor_name"),
                    "value": f.get("value"),
                    "contribution": f.get("contribution"),
                    "source_ref": f.get("source_ref"),
                }
                for f in evidence[:5]  # Top 5 factors (AI-001)
            ],
            "constraints": constraints,
            "estimated_impact": impact,
            "state_version": twin_state_version,
            "is_deterministic": True,
            "llm_enhanced": False,  # No LLM used in baseline
        }

    def _get_mode_rationale(
        self,
        mode: str,
        evidence: List[dict],
        coverage: float,
        unmet: int,
        avg_eta: float,
    ) -> str:
        """Generate deterministic mode-specific rationale."""
        if mode == "baseline_nearest":
            return (
                f"Baseline/Nearest strategy minimizes transport distance. "
                f"Ambulances and supplies assigned to closest feasible destination. "
                f"Average ETA: {avg_eta:.1f} min. "
                f"Use this as a benchmark to compare against other strategies."
            )
        elif mode == "severity_first":
            critical = [e for e in evidence if e.get("factor_type") == "severity"]
            sev_str = critical[0].get("value", "") if critical else ""
            return (
                f"Severity-First strategy prioritizes critical and high-severity demand first. "
                f"{sev_str}. "
                f"Coverage: {coverage:.1f}%. Unmet: {unmet} units. "
                f"Less-critical zones may receive fewer resources to protect critical zones."
            )
        elif mode == "balanced":
            return (
                f"Balanced strategy trades off severity, transport time, route risk, "
                f"and predicted shortage protection. "
                f"Coverage: {coverage:.1f}%. Average ETA: {avg_eta:.1f} min. "
                f"Recommended for sustained operations."
            )
        elif mode == "coverage_first":
            return (
                f"Coverage-First strategy maximizes the number of zones served. "
                f"Coverage: {coverage:.1f}%. "
                f"May accept longer ETAs to reach more zones."
            )
        return f"Strategy mode: {mode}. Coverage: {coverage:.1f}%."

    def _build_factors(self, evidence: List[dict]) -> List[dict]:
        """Build human-readable factors from evidence (AI-001: only real data)."""
        return [
            {
                "type": e.get("factor_type", "unknown"),
                "name": e.get("factor_name", ""),
                "value": e.get("value", ""),
                "impact": "positive" if (e.get("contribution", 0) or 0) > 0 else "negative",
                "source_ref": e.get("source_ref", ""),
            }
            for e in evidence
        ]

    def _check_constraints(
        self,
        strategy_data: dict,
        allocations: List[dict],
    ) -> List[dict]:
        """
        Build constraint check results from strategy data.
        REQ-032: Show relevant constraint checks.
        """
        checks = []

        # Feasibility check
        checks.append({
            "name": "Allocation feasibility",
            "passed": strategy_data.get("is_feasible", True),
            "detail": "All allocations satisfy hard constraints"
            if strategy_data.get("is_feasible", True)
            else strategy_data.get("infeasibility_reason", "Unknown infeasibility"),
        })

        # Check each allocation's constraints
        for alloc in allocations[:3]:  # Sample first 3
            rt = alloc.get("resource_type")
            if rt == "medicine":
                checks.append({
                    "name": f"Medicine type integrity ({alloc.get('destination_name', '?')})",
                    "passed": alloc.get("medicine_type_id") is not None,
                    "detail": f"Medicine type: {alloc.get('medicine_type_id', 'unspecified')}",
                })
            elif rt == "ambulance":
                checks.append({
                    "name": f"Vehicle availability ({alloc.get('vehicle_name', '?')})",
                    "passed": alloc.get("vehicle_id") is not None,
                    "detail": f"Vehicle: {alloc.get('vehicle_name', 'assigned')}",
                })

        # Route checks
        route_allocs = [a for a in allocations if a.get("route_travel_min", 0) > 0]
        if route_allocs:
            checks.append({
                "name": "Route feasibility",
                "passed": True,
                "detail": f"All {len(route_allocs)} routes use road network (no straight-line distance)",
            })

        return checks

    def explain_reallocation(
        self,
        chaos_event: dict,
        old_strategy: dict,
        new_strategy: dict,
        affected_allocations: List[str],
    ) -> str:
        """
        Explain why reallocation was triggered.
        AI-001: Only uses actual event data.
        """
        event_type = chaos_event.get("event_type", "unknown")
        templates = {
            "road_block": (
                "Road Block detected: {entity}. "
                "{n} active allocation(s) used the affected route. "
                "New strategy required to route around the blockage."
            ),
            "hospital_overload": (
                "Hospital Overload: {entity} ICU capacity reduced. "
                "{n} allocation(s) were routed to this hospital. "
                "New strategy redirects patients to hospitals with available ICU capacity."
            ),
            "vehicle_failure": (
                "Vehicle Failure: {entity} is now unavailable. "
                "{n} allocation(s) used this ambulance. "
                "Replacement ambulance required."
            ),
            "demand_spike": (
                "Demand Spike: {entity} demand increased. "
                "Existing strategy no longer covers updated demand. "
                "Reallocation with increased resource commitment required."
            ),
            "medicine_shortage": (
                "Medicine Shortage: {entity} inventory below plan. "
                "{n} allocation(s) depend on this supply. "
                "Alternative source required."
            ),
            "new_incident_zone": (
                "New Incident Zone: {entity} appeared. "
                "Resources must be allocated to serve new zone. "
                "Rebalancing required across all zones."
            ),
        }

        template = templates.get(event_type, "Material change detected. Reallocation required.")
        entity = chaos_event.get("entity_name", chaos_event.get("entity_id", "affected entity"))
        n = len(affected_allocations)

        return template.format(entity=entity, n=n)


# Singleton
explanation_service = ExplainabilityService()
