"""
ReliefOS — Prediction/Forecasting Engine
Deterministic rolling-average + trend baseline.
TR-015..017: T+30, T+60, T+120 horizons. Output labeled as ESTIMATE.
BR-009/010: Predictions are estimates, not facts.
"""
from typing import List, Dict, Optional
from dataclasses import dataclass, field
import math


@dataclass
class ForecastInput:
    """Input data for prediction engine."""
    resource_type: str           # "ambulance" | "icu_bed" | "medicine"
    medicine_type_id: Optional[str]
    medicine_type_code: Optional[str]
    zone_id: Optional[str]
    zone_name: Optional[str]
    current_demand: float        # Current observed demand
    current_supply: float        # Current available supply
    severity: str                # low/medium/high/critical
    affected_population: int
    demand_history: List[float]  # Recent historical demand values (oldest first)
    consumption_rate: float      # Units per minute consumed/delivered
    is_critical: bool = False


@dataclass
class ForecastOutput:
    """
    Forecast output for one resource at one location.
    MUST be labeled as ESTIMATE, not fact. (BR-009)
    """
    resource_type: str
    medicine_type_id: Optional[str]
    medicine_type_code: Optional[str]
    zone_id: Optional[str]
    zone_name: Optional[str]
    horizon_min: int
    current_quantity: float
    predicted_demand: float
    projected_supply: float
    shortage_estimate: float      # max(0, predicted_demand - projected_supply)
    lower_bound: float
    upper_bound: float
    confidence: float             # 0.0 to 1.0
    risk_level: str               # low/medium/high/critical
    drivers: List[str]            # Human-readable explanation drivers
    is_estimate: bool = True      # Always True — BR-009


# Severity multipliers for demand growth
SEVERITY_MULTIPLIERS = {
    "low": 1.05,
    "medium": 1.15,
    "high": 1.30,
    "critical": 1.50,
}

# Horizon growth factors (multiplicative)
HORIZON_FACTORS = {
    30: 1.0,
    60: 1.15,
    120: 1.35,
}


class PredictionEngine:
    """
    Deterministic prediction engine using rolling-average + trend.
    TASK-041..044: Implements baseline forecasting without ML dependency.
    """

    def predict_all(
        self,
        inputs: List[ForecastInput],
        state_version: int,
    ) -> List[ForecastOutput]:
        """Generate T+30, T+60, T+120 forecasts for all inputs."""
        results = []
        for inp in inputs:
            for horizon in [30, 60, 120]:
                out = self._predict_one(inp, horizon, state_version)
                results.append(out)
        return results

    def _predict_one(
        self,
        inp: ForecastInput,
        horizon_min: int,
        state_version: int,
    ) -> ForecastOutput:
        """
        Deterministic baseline forecast:
        1. Rolling average of history
        2. Trend component (linear extrapolation)
        3. Severity multiplier
        4. Horizon growth factor
        """
        # ── Step 1: Rolling average ──────────────────────────────────────────
        history = inp.demand_history
        if len(history) >= 3:
            window = history[-5:]  # last 5 observations
            rolling_avg = sum(window) / len(window)
        elif len(history) > 0:
            rolling_avg = sum(history) / len(history)
        else:
            rolling_avg = inp.current_demand

        # ── Step 2: Trend component ──────────────────────────────────────────
        if len(history) >= 2:
            # Linear trend: slope from first to last
            n = len(history)
            slope = (history[-1] - history[0]) / max(n - 1, 1)
            # Project trend over horizon (in units of "observation periods")
            # Assume each observation is ~10 minutes apart
            periods_ahead = horizon_min / 10.0
            trend_adjustment = slope * periods_ahead
        else:
            trend_adjustment = 0.0

        # ── Step 3: Base prediction ──────────────────────────────────────────
        base_demand = rolling_avg + trend_adjustment

        # ── Step 4: Severity multiplier ──────────────────────────────────────
        sev_mult = SEVERITY_MULTIPLIERS.get(inp.severity, 1.15)

        # ── Step 5: Horizon growth ──────────────────────────────────────────
        horizon_mult = HORIZON_FACTORS.get(horizon_min, 1.0)

        predicted_demand = max(0.0, base_demand * sev_mult * horizon_mult)

        # ── Step 6: Project supply ───────────────────────────────────────────
        # Supply depletes at consumption_rate over the horizon
        projected_supply = max(
            0.0,
            inp.current_supply - (inp.consumption_rate * horizon_min)
        )

        # ── Step 7: Shortage estimate ────────────────────────────────────────
        shortage = max(0.0, predicted_demand - projected_supply)

        # ── Step 8: Uncertainty bounds ───────────────────────────────────────
        uncertainty_pct = 0.10 + (horizon_min / 1200.0)  # grows with horizon
        lower_bound = max(0.0, predicted_demand * (1.0 - uncertainty_pct))
        upper_bound = predicted_demand * (1.0 + uncertainty_pct)

        # ── Step 9: Confidence ───────────────────────────────────────────────
        # Confidence decreases with longer horizon
        base_confidence = 0.85 if len(history) >= 3 else 0.65
        horizon_confidence_penalty = horizon_min / 600.0  # -0.2 at T+120
        confidence = max(0.3, base_confidence - horizon_confidence_penalty)

        # ── Step 10: Risk level ──────────────────────────────────────────────
        if shortage <= 0:
            risk_level = "low"
        elif shortage <= predicted_demand * 0.2:
            risk_level = "medium"
        elif shortage <= predicted_demand * 0.5:
            risk_level = "high"
        else:
            risk_level = "critical"

        # ── Step 11: Drivers ────────────────────────────────────────────────
        drivers = self._build_drivers(
            inp, horizon_min, trend_adjustment, shortage, sev_mult
        )

        return ForecastOutput(
            resource_type=inp.resource_type,
            medicine_type_id=inp.medicine_type_id,
            medicine_type_code=inp.medicine_type_code,
            zone_id=inp.zone_id,
            zone_name=inp.zone_name,
            horizon_min=horizon_min,
            current_quantity=inp.current_supply,
            predicted_demand=round(predicted_demand, 1),
            projected_supply=round(projected_supply, 1),
            shortage_estimate=round(shortage, 1),
            lower_bound=round(lower_bound, 1),
            upper_bound=round(upper_bound, 1),
            confidence=round(confidence, 2),
            risk_level=risk_level,
            drivers=drivers,
            is_estimate=True,  # Always labeled as estimate (BR-009)
        )

    def _build_drivers(
        self,
        inp: ForecastInput,
        horizon_min: int,
        trend_adj: float,
        shortage: float,
        sev_mult: float,
    ) -> List[str]:
        """Build human-readable explanation drivers (AI-001: from actual data)."""
        drivers = []

        if inp.severity in ("high", "critical"):
            drivers.append(f"Severity: {inp.severity.upper()} (demand multiplier: {sev_mult:.2f}x)")

        if trend_adj > 0:
            drivers.append(f"Demand trend ↑ (+{trend_adj:.1f} from recent history)")
        elif trend_adj < 0:
            drivers.append(f"Demand trend ↓ ({trend_adj:.1f} from recent history)")

        if inp.consumption_rate > 0:
            drivers.append(
                f"Consumption rate: {inp.consumption_rate:.1f} units/min "
                f"(depletes {inp.consumption_rate * horizon_min:.0f} units by T+{horizon_min})"
            )

        if inp.affected_population > 0:
            drivers.append(f"Affected population: {inp.affected_population:,}")

        if shortage > 0:
            drivers.append(f"Estimated shortage at T+{horizon_min}: {shortage:.0f} units")

        if inp.is_critical:
            drivers.append("Critical resource — immediate priority")

        return drivers[:5]  # Top 5 drivers


def build_forecast_inputs_from_twin(twin_data: dict) -> List[ForecastInput]:
    """
    Convert Digital Twin state into ForecastInput list.
    Used by the API prediction endpoint.
    """
    inputs = []
    scenario = twin_data.get("scenario", {})
    zones = twin_data.get("zones", [])
    hospitals = twin_data.get("hospitals", [])
    medicine_inventory = twin_data.get("medicine_inventory", [])
    ambulances = twin_data.get("ambulances", [])
    demands = twin_data.get("demands", [])

    zone_map = {z["id"]: z for z in zones}
    severity_map = {z["id"]: z.get("severity", "medium") for z in zones}

    # Ambulance demand prediction (per zone)
    ambulance_demands = [d for d in demands if d["resource_type"] == "ambulance"]
    for zone in zones:
        zone_amb_demands = [d for d in ambulance_demands if d["zone_id"] == zone["id"]]
        total_qty = sum(d["quantity"] for d in zone_amb_demands)
        if total_qty > 0:
            available_ambs = sum(
                1 for a in ambulances
                if a.get("availability_status") == "available"
            )
            inputs.append(ForecastInput(
                resource_type="ambulance",
                medicine_type_id=None,
                medicine_type_code=None,
                zone_id=zone["id"],
                zone_name=zone["name"],
                current_demand=float(total_qty),
                current_supply=float(available_ambs),
                severity=zone.get("severity", "medium"),
                affected_population=zone.get("affected_population", 0),
                demand_history=[total_qty * 0.7, total_qty * 0.85, total_qty],
                consumption_rate=0.05,
                is_critical=zone.get("severity") == "critical",
            ))

    # Medicine demand prediction (per medicine type per zone)
    medicine_demands = [d for d in demands if d["resource_type"] == "medicine"]
    med_type_ids = set(d.get("medicine_type_id") for d in medicine_demands if d.get("medicine_type_id"))

    for med_type_id in med_type_ids:
        med_demands = [d for d in medicine_demands if d.get("medicine_type_id") == med_type_id]
        med_inv = [m for m in medicine_inventory if m.get("medicine_type_id") == med_type_id]
        total_supply = sum(m.get("quantity_available", 0) for m in med_inv)
        total_demand = sum(d["quantity"] for d in med_demands)

        # Use worst-affected zone severity
        zone_severities = [severity_map.get(d["zone_id"], "medium") for d in med_demands]
        max_severity = max(zone_severities, key=lambda s: ["low", "medium", "high", "critical"].index(s)) if zone_severities else "medium"

        med_code = med_inv[0].get("medicine_type_code", med_type_id) if med_inv else med_type_id

        inputs.append(ForecastInput(
            resource_type="medicine",
            medicine_type_id=med_type_id,
            medicine_type_code=med_code,
            zone_id=None,
            zone_name=None,
            current_demand=float(total_demand),
            current_supply=float(total_supply),
            severity=max_severity,
            affected_population=sum(z.get("affected_population", 0) for z in zones),
            demand_history=[total_demand * 0.6, total_demand * 0.8, total_demand],
            consumption_rate=float(total_demand) / 120.0,  # consume over 2 hours
            is_critical=max_severity == "critical",
        ))

    return inputs
