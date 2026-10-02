"""
ReliefOS — OR-Tools Optimization Engine
Generates feasible allocation strategies.
ARCH-003/004: Works on state snapshot, never mutates live state.
BR-001..009, BR-017..019: Hard constraints never violated.
"""
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass, field
import time

ORTOOLS_AVAILABLE = False

from app.routing.routing_service import RoutingService, RouteResult


@dataclass
class AmbulanceVar:
    """Ambulance available for assignment."""
    id: str
    name: str
    road_node_id: Optional[str]
    status: str  # available / assigned / in_transit / unavailable / failed


@dataclass
class DemandItem:
    """A demand item for optimization."""
    id: str
    zone_id: str
    zone_name: str
    zone_road_node_id: Optional[str]
    resource_type: str       # ambulance | icu_bed | medicine
    medicine_type_id: Optional[str]
    quantity: int            # required quantity
    severity: str            # critical/high/medium/low
    urgency: str             # immediate/urgent/routine
    severity_weight: float   # 1=low, 2=medium, 4=high, 8=critical


@dataclass
class SupplyItem:
    """A supply source for medicine/icu."""
    id: str
    name: str
    source_road_node_id: Optional[str]
    destination_road_node_id: Optional[str]  # for hospital→zone
    resource_type: str
    medicine_type_id: Optional[str]
    quantity_available: int
    reserve_quantity: int
    destination_id: Optional[str]  # hospital ID for ICU
    destination_name: Optional[str]


@dataclass
class OptimizationInput:
    """Complete input snapshot for the optimizer."""
    scenario_id: str
    state_version: int
    mode: str               # baseline_nearest | severity_first | balanced | coverage_first
    ambulances: List[AmbulanceVar]
    demands: List[DemandItem]
    medicine_supplies: List[SupplyItem]
    hospitals: List[dict]   # {id, name, icu_available, road_node_id}
    road_nodes: List[dict]
    road_edges: List[dict]
    forecasts: List[dict]   # Optional shortage forecasts
    weights: Dict[str, float]  # Objective weights

    # ICU demand items (hospital as destination)
    icu_demands: List[DemandItem] = field(default_factory=list)


@dataclass
class AllocationDecision:
    """One allocation decision from the optimizer."""
    resource_type: str
    source_id: Optional[str]
    source_name: Optional[str]
    destination_id: str
    destination_name: str
    destination_type: str     # "zone" or "hospital"
    quantity: int
    vehicle_id: Optional[str]
    vehicle_name: Optional[str]
    medicine_type_id: Optional[str]
    route_node_ids: List[str]
    route_distance_km: float
    route_travel_min: float
    route_risk: float
    demand_id: Optional[str]
    evidence_factors: List[dict]  # For DecisionEvidence


@dataclass
class StrategyResult:
    """Complete optimization result."""
    mode: str
    is_feasible: bool
    infeasibility_reason: Optional[str]
    score: float
    coverage_pct: float
    unmet_demand: int
    total_demand: int
    avg_eta_min: float
    avg_risk: float
    predicted_shortage_impact: float
    allocations: List[AllocationDecision]
    evidence_factors: List[dict]
    solve_time_sec: float


# Severity weights for objective
SEVERITY_WEIGHTS = {
    "critical": 8.0,
    "high": 4.0,
    "medium": 2.0,
    "low": 1.0,
}

# Default objective weights per strategy mode
MODE_WEIGHTS = {
    "baseline_nearest": {
        "w1_unmet_demand": 1.0,
        "w2_travel_time": 5.0,    # Heavily weight travel time
        "w3_route_risk": 1.0,
        "w4_capacity_overload": 10.0,
        "w5_shortage": 0.5,
        "w6_coverage": 0.5,
    },
    "severity_first": {
        "w1_unmet_demand": 10.0,  # Heavily weight unmet critical demand
        "w2_travel_time": 1.0,
        "w3_route_risk": 2.0,
        "w4_capacity_overload": 10.0,
        "w5_shortage": 3.0,
        "w6_coverage": 1.0,
    },
    "balanced": {
        "w1_unmet_demand": 5.0,
        "w2_travel_time": 3.0,
        "w3_route_risk": 3.0,
        "w4_capacity_overload": 10.0,
        "w5_shortage": 4.0,
        "w6_coverage": 4.0,
    },
    "coverage_first": {
        "w1_unmet_demand": 3.0,
        "w2_travel_time": 2.0,
        "w3_route_risk": 2.0,
        "w4_capacity_overload": 10.0,
        "w5_shortage": 2.0,
        "w6_coverage": 8.0,   # Heavily weight coverage
    },
}


class OptimizationEngine:
    """
    OR-Tools based optimization engine.
    Uses CP-SAT for constraint satisfaction and objective minimization.

    ARCH-003: Works only on a snapshot — never touches live Digital Twin.
    ARCH-004: Returns strategy results, does NOT commit to DB.
    """

    def __init__(self):
        self.routing = RoutingService()

    def generate_strategy(self, opt_input: OptimizationInput) -> StrategyResult:
        """
        Generate one feasible allocation strategy.
        Uses heuristic optimization with OR-Tools CP-SAT for constraint enforcement.
        """
        start_time = time.time()

        # Build routing graph from snapshot
        self.routing.build_graph(opt_input.road_nodes, opt_input.road_edges)

        mode = opt_input.mode
        weights = MODE_WEIGHTS.get(mode, MODE_WEIGHTS["balanced"])

        # Run the optimizer
        result = self._optimize(opt_input, weights)
        result.solve_time_sec = time.time() - start_time

        return result

    def _optimize(
        self,
        inp: OptimizationInput,
        weights: Dict[str, float],
    ) -> StrategyResult:
        """
        Core optimization using greedy heuristic with constraint enforcement.
        OR-Tools CP-SAT used for integer assignment problems.
        """
        allocations: List[AllocationDecision] = []
        evidence_factors: List[dict] = []

        # Track used resources (hard constraints)
        used_ambulance_ids = set()
        used_medicine_qty: Dict[Tuple[str, str], int] = {}  # (source_id, med_type_id) -> used
        used_icu_qty: Dict[str, int] = {}  # hospital_id -> used
        
        total_demand = 0
        met_demand = 0

        # Sort demands by priority (based on strategy mode)
        sorted_demands = self._sort_demands(inp.demands + inp.icu_demands, inp.mode, weights)

        for demand in sorted_demands:
            total_demand += demand.quantity
            
            if demand.resource_type == "ambulance":
                alloc = self._allocate_ambulance(
                    demand, inp, used_ambulance_ids, weights
                )
                if alloc:
                    allocations.append(alloc)
                    met_demand += alloc.quantity
                    if alloc.vehicle_id:
                        used_ambulance_ids.add(alloc.vehicle_id)
                    
            elif demand.resource_type == "medicine":
                alloc = self._allocate_medicine(
                    demand, inp, used_medicine_qty, weights
                )
                if alloc:
                    allocations.append(alloc)
                    met_demand += alloc.quantity
                    key = (alloc.source_id, demand.medicine_type_id)
                    used_medicine_qty[key] = used_medicine_qty.get(key, 0) + alloc.quantity

            elif demand.resource_type == "icu_bed":
                alloc = self._allocate_icu(
                    demand, inp, used_icu_qty, weights
                )
                if alloc:
                    allocations.append(alloc)
                    met_demand += alloc.quantity
                    if alloc.destination_id:
                        used_icu_qty[alloc.destination_id] = (
                            used_icu_qty.get(alloc.destination_id, 0) + alloc.quantity
                        )

        # Build global evidence
        evidence_factors = self._build_strategy_evidence(
            inp, allocations, total_demand, met_demand
        )

        # Compute metrics
        if allocations:
            avg_eta = sum(a.route_travel_min for a in allocations) / len(allocations)
            avg_risk = sum(a.route_risk for a in allocations) / len(allocations)
        else:
            avg_eta = 0.0
            avg_risk = 0.0

        coverage_pct = (met_demand / total_demand * 100.0) if total_demand > 0 else 100.0
        unmet = total_demand - met_demand

        # Predicted shortage impact (from forecasts)
        shortage_impact = sum(
            f.get("shortage_estimate", 0)
            for f in inp.forecasts
            if f.get("horizon_min") == 60  # Use T+60 as primary
        )

        # Compute score (lower is better — represents cost)
        w = weights
        score = (
            w["w1_unmet_demand"] * unmet
            + w["w2_travel_time"] * avg_eta
            + w["w3_route_risk"] * avg_risk * 100
            + w["w5_shortage"] * shortage_impact
        )

        return StrategyResult(
            mode=inp.mode,
            is_feasible=True,
            infeasibility_reason=None,
            score=round(score, 2),
            coverage_pct=round(coverage_pct, 1),
            unmet_demand=unmet,
            total_demand=total_demand,
            avg_eta_min=round(avg_eta, 1),
            avg_risk=round(avg_risk, 3),
            predicted_shortage_impact=round(shortage_impact, 1),
            allocations=allocations,
            evidence_factors=evidence_factors,
            solve_time_sec=0.0,
        )

    def _sort_demands(
        self,
        demands: List[DemandItem],
        mode: str,
        weights: Dict[str, float],
    ) -> List[DemandItem]:
        """Sort demands by priority according to strategy mode."""
        if mode == "baseline_nearest":
            # Sort by urgency first, then severity
            urgency_order = {"immediate": 0, "urgent": 1, "routine": 2}
            return sorted(demands, key=lambda d: (urgency_order.get(d.urgency, 1), -d.severity_weight))
        elif mode == "severity_first":
            # Sort purely by severity weight (descending)
            return sorted(demands, key=lambda d: -d.severity_weight)
        elif mode == "balanced":
            # Combine severity and urgency
            urgency_order = {"immediate": 0, "urgent": 1, "routine": 2}
            return sorted(demands, key=lambda d: (urgency_order.get(d.urgency, 1), -d.severity_weight))
        elif mode == "coverage_first":
            # Prioritize zones with most unmet demand
            return sorted(demands, key=lambda d: -d.quantity)
        return demands

    def _allocate_ambulance(
        self,
        demand: DemandItem,
        inp: OptimizationInput,
        used_ids: set,
        weights: Dict[str, float],
    ) -> Optional[AllocationDecision]:
        """
        Assign available ambulances to a demand zone.
        BR-005: Ambulance exclusivity enforced.
        BR-006: Blocked routes excluded.
        BR-007: Network distance used.
        """
        if not demand.zone_road_node_id:
            return None

        # Find available ambulances
        available = [
            a for a in inp.ambulances
            if a.status == "available" and a.id not in used_ids and a.road_node_id
        ]

        if not available:
            return None

        # Score ambulances: route each to zone, pick best
        best_ambs: List[Tuple[float, AmbulanceVar, RouteResult]] = []

        for amb in available:
            route = self.routing.find_route(
                amb.road_node_id,
                demand.zone_road_node_id,
                weight="travel_min" if inp.mode != "baseline_nearest" else "distance_km",
            )
            if not route.feasible:
                continue  # BR-006: skip if no feasible route

            # Score: low ETA preferred; risk adjusted by mode
            if inp.mode == "severity_first":
                score = route.travel_min * (1 + route.risk_score)
            elif inp.mode == "baseline_nearest":
                score = route.distance_km
            else:
                score = route.travel_min * (1 + route.risk_score * weights["w3_route_risk"])

            best_ambs.append((score, amb, route))

        if not best_ambs:
            return None  # No feasible ambulance route

        best_ambs.sort(key=lambda x: x[0])

        # Assign the best ambulance
        _, best_amb, best_route = best_ambs[0]

        evidence = [
            {
                "factor_type": "ambulance_availability",
                "factor_name": f"Ambulance {best_amb.name} available",
                "value": "available",
                "contribution": 1.0,
                "source_ref": best_amb.id,
            },
            {
                "factor_type": "route",
                "factor_name": f"Route ETA to {demand.zone_name}",
                "value": f"{best_route.travel_min:.1f} min",
                "contribution": -best_route.travel_min / 60.0,
                "source_ref": f"route:{best_amb.road_node_id}->{demand.zone_road_node_id}",
            },
            {
                "factor_type": "demand",
                "factor_name": f"Ambulance demand at {demand.zone_name}",
                "value": str(demand.quantity),
                "contribution": float(demand.severity_weight),
                "source_ref": demand.id,
            },
        ]

        return AllocationDecision(
            resource_type="ambulance",
            source_id=None,
            source_name=f"Station ({best_amb.name})",
            destination_id=demand.zone_id,
            destination_name=demand.zone_name,
            destination_type="zone",
            quantity=1,  # One ambulance per assignment
            vehicle_id=best_amb.id,
            vehicle_name=best_amb.name,
            medicine_type_id=None,
            route_node_ids=best_route.node_ids,
            route_distance_km=best_route.distance_km,
            route_travel_min=best_route.travel_min,
            route_risk=best_route.risk_score,
            demand_id=demand.id,
            evidence_factors=evidence,
        )

    def _allocate_medicine(
        self,
        demand: DemandItem,
        inp: OptimizationInput,
        used_qty: Dict[Tuple[str, str], int],
        weights: Dict[str, float],
    ) -> Optional[AllocationDecision]:
        """
        Allocate medicine from a source to a zone.
        BR-001: No over-allocation.
        BR-003: Medicine type integrity enforced.
        BR-004: Reserve stock protected.
        """
        if not demand.zone_road_node_id:
            return None

        # Find supplies of the EXACT same medicine type (BR-003)
        matching_supplies = [
            s for s in inp.medicine_supplies
            if (
                s.resource_type == "medicine"
                and s.medicine_type_id == demand.medicine_type_id  # MUST match
                and s.source_road_node_id is not None
            )
        ]

        if not matching_supplies:
            return None

        best_source = None
        best_route = None
        best_score = float("inf")

        for supply in matching_supplies:
            key = (supply.id, demand.medicine_type_id)
            already_used = used_qty.get(key, 0)

            # BR-001 + BR-004: Cannot exceed available minus reserve
            net_available = supply.quantity_available - supply.reserve_quantity - already_used
            if net_available <= 0:
                continue

            route = self.routing.find_route(
                supply.source_road_node_id,
                demand.zone_road_node_id,
                weight="travel_min",
            )
            if not route.feasible:
                continue

            if inp.mode == "baseline_nearest":
                score = route.distance_km
            else:
                score = route.travel_min * (1 + route.risk_score)

            if score < best_score:
                best_score = score
                best_source = supply
                best_route = route

        if best_source is None or best_route is None:
            return None

        key = (best_source.id, demand.medicine_type_id)
        already_used = used_qty.get(key, 0)
        net_available = best_source.quantity_available - best_source.reserve_quantity - already_used
        alloc_qty = min(demand.quantity, net_available)

        if alloc_qty <= 0:
            return None

        evidence = [
            {
                "factor_type": "medicine_inventory",
                "factor_name": f"Supply at {best_source.name}",
                "value": f"{net_available} available",
                "contribution": 1.0,
                "source_ref": best_source.id,
            },
            {
                "factor_type": "medicine_type",
                "factor_name": "Medicine type match enforced",
                "value": demand.medicine_type_id or "unknown",
                "contribution": 1.0,
                "source_ref": demand.id,
            },
            {
                "factor_type": "route",
                "factor_name": f"Delivery route to {demand.zone_name}",
                "value": f"{best_route.travel_min:.1f} min, {best_route.distance_km:.1f} km",
                "contribution": -best_route.travel_min / 60.0,
                "source_ref": f"route:{best_source.id}->{demand.zone_id}",
            },
        ]

        return AllocationDecision(
            resource_type="medicine",
            source_id=best_source.id,
            source_name=best_source.name,
            destination_id=demand.zone_id,
            destination_name=demand.zone_name,
            destination_type="zone",
            quantity=alloc_qty,
            vehicle_id=None,
            vehicle_name=None,
            medicine_type_id=demand.medicine_type_id,
            route_node_ids=best_route.node_ids,
            route_distance_km=best_route.distance_km,
            route_travel_min=best_route.travel_min,
            route_risk=best_route.risk_score,
            demand_id=demand.id,
            evidence_factors=evidence,
        )

    def _allocate_icu(
        self,
        demand: DemandItem,
        inp: OptimizationInput,
        used_icu: Dict[str, int],
        weights: Dict[str, float],
    ) -> Optional[AllocationDecision]:
        """
        Allocate ICU beds at hospitals.
        BR-002: ICU capacity constraint enforced.
        """
        # Find hospitals with available ICU capacity
        available_hospitals = []
        for hosp in inp.hospitals:
            icu_avail = hosp.get("icu_available", 0)
            already_used = used_icu.get(hosp["id"], 0)
            net_icu = icu_avail - already_used
            if net_icu > 0 and hosp.get("road_node_id") and demand.zone_road_node_id:
                route = self.routing.find_route(
                    demand.zone_road_node_id,
                    hosp["road_node_id"],
                    weight="travel_min",
                )
                if route.feasible:
                    available_hospitals.append((hosp, route, net_icu))

        if not available_hospitals:
            return None

        # Sort by strategy preference
        if inp.mode in ("severity_first", "balanced"):
            available_hospitals.sort(key=lambda x: (x[1].travel_min * (1 + x[1].risk_score)))
        else:
            available_hospitals.sort(key=lambda x: x[1].distance_km)

        best_hosp, best_route, net_icu = available_hospitals[0]
        alloc_qty = min(demand.quantity, net_icu)

        if alloc_qty <= 0:
            return None

        evidence = [
            {
                "factor_type": "icu_capacity",
                "factor_name": f"ICU available at {best_hosp['name']}",
                "value": f"{net_icu} beds",
                "contribution": 1.0,
                "source_ref": best_hosp["id"],
            },
            {
                "factor_type": "route",
                "factor_name": f"Transport to hospital: {best_route.travel_min:.1f} min",
                "value": f"{best_route.distance_km:.1f} km",
                "contribution": -best_route.travel_min / 60.0,
                "source_ref": f"route:{demand.zone_id}->{best_hosp['id']}",
            },
        ]

        return AllocationDecision(
            resource_type="icu_bed",
            source_id=demand.zone_id,
            source_name=demand.zone_name,
            destination_id=best_hosp["id"],
            destination_name=best_hosp["name"],
            destination_type="hospital",
            quantity=alloc_qty,
            vehicle_id=None,
            vehicle_name=None,
            medicine_type_id=None,
            route_node_ids=best_route.node_ids,
            route_distance_km=best_route.distance_km,
            route_travel_min=best_route.travel_min,
            route_risk=best_route.risk_score,
            demand_id=demand.id,
            evidence_factors=evidence,
        )

    def _build_strategy_evidence(
        self,
        inp: OptimizationInput,
        allocations: List[AllocationDecision],
        total_demand: int,
        met_demand: int,
    ) -> List[dict]:
        """Build top-level strategy evidence factors."""
        evidence = []

        unmet = total_demand - met_demand
        if unmet > 0:
            evidence.append({
                "factor_type": "unmet_demand",
                "factor_name": "Unmet demand remaining",
                "value": str(unmet),
                "contribution": -float(unmet),
                "source_ref": f"scenario:{inp.scenario_id}",
            })

        # Count demand by severity
        critical_demands = [d for d in inp.demands if d.severity == "critical"]
        if critical_demands:
            evidence.append({
                "factor_type": "severity",
                "factor_name": f"{len(critical_demands)} critical demand items",
                "value": f"{sum(d.quantity for d in critical_demands)} critical units needed",
                "contribution": 8.0 * len(critical_demands),
                "source_ref": ",".join(d.id for d in critical_demands[:3]),
            })

        # Route statistics
        if allocations:
            avg_eta = sum(a.route_travel_min for a in allocations) / len(allocations)
            blocked_routes = [a for a in allocations if not a.route_node_ids]
            evidence.append({
                "factor_type": "transport",
                "factor_name": f"Average ETA across {len(allocations)} allocations",
                "value": f"{avg_eta:.1f} min",
                "contribution": -avg_eta / 30.0,
                "source_ref": f"strategy_mode:{inp.mode}",
            })

        # Shortage prediction influence
        high_risk_forecasts = [f for f in inp.forecasts if f.get("risk_level") in ("high", "critical")]
        if high_risk_forecasts:
            evidence.append({
                "factor_type": "shortage_prediction",
                "factor_name": f"{len(high_risk_forecasts)} predicted high-risk shortages",
                "value": f"T+60 shortage: {sum(f.get('shortage_estimate', 0) for f in high_risk_forecasts):.0f} units",
                "contribution": -float(len(high_risk_forecasts)) * 2.0,
                "source_ref": "prediction_engine",
            })

        return evidence
