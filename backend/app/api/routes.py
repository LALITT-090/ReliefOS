import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.persistence.database import get_db
from app.domain.services.digital_twin_service import digital_twin_service
from app.persistence.scenario_seeder import load_scenario, SCENARIO_ID
from app.forecasting.prediction_engine import PredictionEngine, build_forecast_inputs_from_twin
from app.optimization.optimizer import OptimizationEngine, OptimizationInput, AmbulanceVar, DemandItem, SupplyItem
from app.explanation.explanation_service import explanation_service
from app.audit.audit_service import audit_service
from app.domain.models.database import (
    Scenario, Strategy, Allocation, StrategyStatus, AllocationStatus,
    AuditEventType, Decision, MedicineType, Zone, Hospital, Ambulance, ResourceSource
)
from app.api.schemas import (
    IncidentCreate, StrategyGenerateRequest, ChaosEventRequest,
    ApprovalRequest, StrategyModifyRequest, AllocationStatusUpdate
)

router = APIRouter()
prediction_engine = PredictionEngine()
optimization_engine = OptimizationEngine()

@router.post("/scenarios/{id}/load")
async def api_load_scenario(id: str, db: AsyncSession = Depends(get_db)):
    if id != SCENARIO_ID:
        id = SCENARIO_ID
    scenario = await load_scenario(db, id)
    return {"status": "success", "scenario_id": scenario.id, "state_version": scenario.state_version}

@router.get("/twin")
async def api_get_twin(db: AsyncSession = Depends(get_db)):
    twin = await digital_twin_service.get_twin_snapshot(db)
    if "error" in twin:
        raise HTTPException(status_code=404, detail=twin["error"])
    return twin

@router.get("/resources")
async def api_get_resources(db: AsyncSession = Depends(get_db)):
    twin = await digital_twin_service.get_twin_snapshot(db)
    if "error" in twin:
        raise HTTPException(status_code=404, detail=twin["error"])
    return {
        "ambulances": twin["ambulances"],
        "medicine_inventory": twin["medicine_inventory"],
        "hospitals": twin["hospitals"]
    }

@router.post("/incidents")
async def api_create_incident(incident: IncidentCreate, db: AsyncSession = Depends(get_db)):
    return {"status": "success", "message": "Incident received"}

@router.post("/incidents/parse")
async def api_parse_incident(text: str, db: AsyncSession = Depends(get_db)):
    return {"status": "success", "message": "Parsed (deterministic template)"}

@router.get("/predictions")
async def api_get_predictions(db: AsyncSession = Depends(get_db)):
    twin = await digital_twin_service.get_twin_snapshot(db)
    if "error" in twin:
        raise HTTPException(status_code=404, detail=twin["error"])
    
    inputs = build_forecast_inputs_from_twin(twin)
    forecasts = prediction_engine.predict_all(inputs, twin["state_version"])
    return {"forecasts": [f.__dict__ for f in forecasts]}

@router.post("/strategies/generate")
async def api_generate_strategies(req: StrategyGenerateRequest, db: AsyncSession = Depends(get_db)):
    twin = await digital_twin_service.get_twin_snapshot(db)
    if "error" in twin:
        raise HTTPException(status_code=404, detail=twin["error"])

    scenario_id = twin["scenario"]["id"]
    state_version = twin["state_version"]
    
    inputs = build_forecast_inputs_from_twin(twin)
    forecasts = [f.__dict__ for f in prediction_engine.predict_all(inputs, state_version)]
    
    amb_vars = [AmbulanceVar(
        id=a["id"], name=a["name"], road_node_id=a["road_node_id"], status=a["availability_status"]
    ) for a in twin["ambulances"]]
    
    demands = [DemandItem(
        id=d["id"], zone_id=d["zone_id"], zone_name=next((z["name"] for z in twin["zones"] if z["id"] == d["zone_id"]), ""),
        zone_road_node_id=next((z["road_node_id"] for z in twin["zones"] if z["id"] == d["zone_id"]), None),
        resource_type=d["resource_type"], medicine_type_id=d.get("medicine_type_id"), quantity=d["quantity"],
        severity=d["severity"], urgency=d["urgency"], 
        severity_weight=8.0 if d["severity"] == "critical" else 4.0 if d["severity"] == "high" else 2.0 if d["severity"] == "medium" else 1.0
    ) for d in twin["demands"] if d["status"] != "met"]
    
    medicine_supplies = [SupplyItem(
        id=m["source_id"], name=next((s["name"] for s in twin["resource_sources"] if s["id"] == m["source_id"]), ""),
        source_road_node_id=next((s["road_node_id"] for s in twin["resource_sources"] if s["id"] == m["source_id"]), None),
        destination_road_node_id=None, resource_type="medicine", medicine_type_id=m["medicine_type_id"],
        quantity_available=m["quantity_available"], reserve_quantity=m["reserve_quantity"],
        destination_id=None, destination_name=None
    ) for m in twin["medicine_inventory"]]

    icu_demands = [d for d in demands if d.resource_type == "icu_bed"]
    other_demands = [d for d in demands if d.resource_type != "icu_bed"]
    
    opt_input = OptimizationInput(
        scenario_id=scenario_id, state_version=state_version, mode=req.mode,
        ambulances=amb_vars, demands=other_demands, medicine_supplies=medicine_supplies,
        hospitals=twin["hospitals"], road_nodes=twin["road_nodes"], road_edges=twin["road_edges"],
        forecasts=forecasts, weights={}, icu_demands=icu_demands
    )
    
    res = optimization_engine.generate_strategy(opt_input)
    
    strategy = Strategy(
        id=str(uuid.uuid4()), scenario_id=scenario_id, state_version=state_version,
        objective_mode=req.mode, status=StrategyStatus.GENERATED,
        score=res.score, coverage_pct=res.coverage_pct, unmet_demand=res.unmet_demand,
        avg_eta_min=res.avg_eta_min, avg_risk=res.avg_risk, predicted_shortage_impact=res.predicted_shortage_impact,
        is_feasible=res.is_feasible, infeasibility_reason=res.infeasibility_reason
    )
    db.add(strategy)
    await db.flush()
    
    allocations_db = []
    for a in res.allocations:
        alloc = Allocation(
            id=str(uuid.uuid4()), strategy_id=strategy.id, scenario_id=scenario_id,
            resource_type=a.resource_type, source_id=a.source_id, destination_id=a.destination_id,
            destination_type=a.destination_type, quantity=a.quantity, vehicle_id=a.vehicle_id,
            medicine_type_id=a.medicine_type_id, route_node_ids=a.route_node_ids,
            route_distance_km=a.route_distance_km, route_travel_min=a.route_travel_min,
            route_risk=a.route_risk, status=AllocationStatus.PROPOSED
        )
        db.add(alloc)
        allocations_db.append(alloc)
    
    await db.flush()
    
    await audit_service.log_event(
        db, AuditEventType.STRATEGY_GENERATED, "system", "strategy", strategy.id,
        {"mode": req.mode, "score": res.score, "is_feasible": res.is_feasible}, scenario_id
    )
    
    return {"strategy_id": strategy.id, "result": res.__dict__}

@router.get("/strategies/{id}")
async def api_get_strategy(id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Strategy).where(Strategy.id == id))
    strategy = result.scalar_one_or_none()
    if not strategy:
        raise HTTPException(404, "Strategy not found")
        
    result_allocs = await db.execute(select(Allocation).where(Allocation.strategy_id == id))
    allocs = result_allocs.scalars().all()
    
    strategy_data = {
        "objective_mode": strategy.objective_mode, "coverage_pct": strategy.coverage_pct,
        "unmet_demand": strategy.unmet_demand, "avg_eta_min": strategy.avg_eta_min,
        "avg_risk": strategy.avg_risk, "predicted_shortage_impact": strategy.predicted_shortage_impact,
        "is_feasible": strategy.is_feasible, "infeasibility_reason": strategy.infeasibility_reason
    }
    
    allocs_data = [{
        "resource_type": a.resource_type, "destination_name": f"Dest-{a.destination_id}",
        "medicine_type_id": a.medicine_type_id, "vehicle_id": a.vehicle_id, "vehicle_name": f"Veh-{a.vehicle_id}",
        "route_travel_min": a.route_travel_min or 0.0, "route_distance_km": a.route_distance_km or 0.0,
        "route_node_ids": a.route_node_ids
    } for a in allocs]
    
    explanation = explanation_service.explain_strategy(strategy_data, allocs_data, [], strategy.state_version)
    
    return {
        "strategy": {
            "id": strategy.id, "mode": strategy.objective_mode, "score": strategy.score,
            "status": strategy.status, "state_version": strategy.state_version
        },
        "allocations": allocs,
        "explanation": explanation
    }

@router.post("/strategies/{id}/approve")
async def api_approve_strategy(id: str, req: ApprovalRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Strategy).where(Strategy.id == id))
    strategy = result.scalar_one_or_none()
    if not strategy:
        raise HTTPException(404, "Strategy not found")
        
    scenario = await digital_twin_service.get_active_scenario(db)
    if not scenario:
        raise HTTPException(404, "No active scenario")
        
    if strategy.state_version != scenario.state_version:
        strategy.status = StrategyStatus.STALE
        await audit_service.log_event(db, AuditEventType.STRATEGY_STALE, req.operator_id, "strategy", strategy.id, {"old_version": strategy.state_version, "current_version": scenario.state_version}, scenario.id)
        raise HTTPException(409, "Stale strategy - state has materially changed")
        
    if strategy.status != StrategyStatus.GENERATED:
        raise HTTPException(400, f"Cannot approve strategy in status {strategy.status}")
        
    strategy.status = StrategyStatus.APPROVED
    
    decision = Decision(
        id=str(uuid.uuid4()), strategy_id=strategy.id, operator_action=req.operator_action or "approved",
        operator_note=req.operator_note, operator_id=req.operator_id
    )
    db.add(decision)
    
    # Mark older active allocations in this scenario as superseded
    older_allocs_result = await db.execute(
        select(Allocation).where(
            Allocation.scenario_id == scenario.id,
            Allocation.strategy_id != strategy.id,
            Allocation.status.in_([
                AllocationStatus.APPROVED,
                AllocationStatus.DISPATCHED,
                AllocationStatus.IN_TRANSIT,
            ])
        )
    )
    older_allocs = older_allocs_result.scalars().all()
    if older_allocs:
        old_ids = [a.id for a in older_allocs]
        await digital_twin_service.supersede_allocations(db, old_ids, strategy.id, actor=req.operator_id)
    
    # Approve new allocations
    result_allocs = await db.execute(select(Allocation).where(Allocation.strategy_id == id))
    allocs = result_allocs.scalars().all()
    
    for a in allocs:
        a.status = AllocationStatus.APPROVED
        
    await audit_service.log_event(db, AuditEventType.STRATEGY_APPROVED, req.operator_id, "strategy", strategy.id, {"allocations_count": len(allocs), "superseded_count": len(older_allocs)}, scenario.id)
    
    return {"status": "success", "message": "Strategy approved and allocations committed"}

@router.post("/strategies/{id}/reject")
async def api_reject_strategy(id: str, req: ApprovalRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Strategy).where(Strategy.id == id))
    strategy = result.scalar_one_or_none()
    if not strategy:
        raise HTTPException(404, "Strategy not found")
        
    scenario = await digital_twin_service.get_active_scenario(db)
    strategy.status = StrategyStatus.REJECTED
    
    decision = Decision(
        id=str(uuid.uuid4()), strategy_id=strategy.id, operator_action="rejected",
        operator_note=req.operator_note, operator_id=req.operator_id
    )
    db.add(decision)
    
    result_allocs = await db.execute(select(Allocation).where(Allocation.strategy_id == id))
    allocs = result_allocs.scalars().all()
    for a in allocs:
        a.status = AllocationStatus.CANCELLED
        
    await audit_service.log_event(db, AuditEventType.STRATEGY_REJECTED, req.operator_id, "strategy", strategy.id, {"status": "rejected", "note": req.operator_note}, scenario.id if scenario else None)
    return {"status": "success", "message": "Strategy rejected by operator"}

@router.post("/strategies/{id}/modify")
async def api_modify_strategy(id: str, req: StrategyModifyRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Strategy).where(Strategy.id == id))
    strategy = result.scalar_one_or_none()
    if not strategy:
        raise HTTPException(404, "Strategy not found")
        
    scenario = await digital_twin_service.get_active_scenario(db)
    if not scenario:
        raise HTTPException(404, "No active scenario")
        
    if strategy.state_version != scenario.state_version:
        strategy.status = StrategyStatus.STALE
        raise HTTPException(409, "Cannot modify stale strategy — scenario state has changed")
        
    if strategy.status not in (StrategyStatus.GENERATED, StrategyStatus.STALE):
        raise HTTPException(400, f"Cannot modify strategy in status {strategy.status}")

    # Record decision with operator note
    decision = Decision(
        id=str(uuid.uuid4()), strategy_id=strategy.id, operator_action="modified",
        operator_note=req.operator_note or "Operator modified allocation parameters",
        operator_id=req.operator_id
    )
    db.add(decision)
    
    # If allocation modifications provided, apply them to proposed allocations
    if req.allocation_modifications:
        for mod in req.allocation_modifications:
            alloc_id = mod.get("allocation_id")
            if alloc_id:
                alloc_res = await db.execute(select(Allocation).where(Allocation.id == alloc_id, Allocation.strategy_id == id))
                alloc = alloc_res.scalar_one_or_none()
                if alloc:
                    if "quantity" in mod:
                        alloc.quantity = mod["quantity"]
                    if "destination_id" in mod:
                        alloc.destination_id = mod["destination_id"]
                    if "vehicle_id" in mod:
                        alloc.vehicle_id = mod["vehicle_id"]
        await db.flush()

    await audit_service.log_event(
        db, AuditEventType.STRATEGY_GENERATED, req.operator_id, "strategy", strategy.id,
        {"action": "modified", "note": req.operator_note, "state_version": strategy.state_version},
        scenario.id
    )
    return {"status": "success", "message": "Strategy modifications recorded", "strategy_id": strategy.id}

@router.post("/chaos/events")
async def api_chaos_event(req: ChaosEventRequest, db: AsyncSession = Depends(get_db)):
    scenario = await digital_twin_service.get_active_scenario(db)
    if not scenario:
        raise HTTPException(404, "No active scenario")
        
    try:
        res = None
        impacted = []
        if req.event_type == "road_block":
            edge_id = req.payload.get("edge_id")
            if not edge_id:
                raise HTTPException(400, "Missing required parameter 'edge_id'")
            res = await digital_twin_service.apply_road_block(db, scenario.id, edge_id)
            impacted = await digital_twin_service.detect_impacted_allocations(db, scenario.id, "road_edge", edge_id)
            
        elif req.event_type == "hospital_overload":
            hospital_id = req.payload.get("hospital_id")
            reduction = req.payload.get("icu_reduction", 5)
            if not hospital_id:
                raise HTTPException(400, "Missing required parameter 'hospital_id'")
            res = await digital_twin_service.apply_hospital_overload(db, scenario.id, hospital_id, reduction)
            impacted = await digital_twin_service.detect_impacted_allocations(db, scenario.id, "hospital", hospital_id)
            
        elif req.event_type == "vehicle_failure":
            ambulance_id = req.payload.get("ambulance_id")
            if not ambulance_id:
                raise HTTPException(400, "Missing required parameter 'ambulance_id'")
            res = await digital_twin_service.apply_vehicle_failure(db, scenario.id, ambulance_id)
            impacted = await digital_twin_service.detect_impacted_allocations(db, scenario.id, "ambulance", ambulance_id)
            
        elif req.event_type == "demand_spike":
            zone_id = req.payload.get("zone_id")
            resource_type = req.payload.get("resource_type", "icu_bed")
            increase_amount = req.payload.get("increase_amount", 5)
            if not zone_id:
                raise HTTPException(400, "Missing required parameter 'zone_id'")
            res = await digital_twin_service.apply_demand_spike(db, scenario.id, zone_id, resource_type, increase_amount)
            impacted = await digital_twin_service.detect_impacted_allocations(db, scenario.id, "zone", zone_id)
            
        elif req.event_type == "medicine_shortage":
            inv_id = req.payload.get("inventory_id")
            if not inv_id:
                key = req.payload.get("inventory_key")
                if key:
                    inv_id = key[0] if isinstance(key, (list, tuple)) else str(key)
            if not inv_id:
                raise HTTPException(400, "Missing required parameter 'inventory_id' or 'inventory_key'")
            reduction = req.payload.get("reduction", 20)
            res = await digital_twin_service.apply_medicine_shortage(db, scenario.id, inv_id, reduction)
            matched_inv_id = res.get("inventory_id", inv_id) if isinstance(res, dict) else inv_id
            impacted = await digital_twin_service.detect_impacted_allocations(db, scenario.id, "medicine_inventory", matched_inv_id)
            
        elif req.event_type == "new_incident_zone":
            zone_data = req.payload
            if not zone_data.get("name") or not zone_data.get("lat") or not zone_data.get("lon"):
                raise HTTPException(400, "Missing required zone parameters ('name', 'lat', 'lon')")
            res = await digital_twin_service.apply_new_incident_zone(db, scenario.id, zone_data)
            impacted = []
        else:
            raise HTTPException(400, f"Unknown chaos event type: {req.event_type}")

        await audit_service.log_event(
            db, AuditEventType.CHAOS_EVENT_APPLIED, "simulation", "scenario", scenario.id,
            {"event_type": req.event_type, "payload": req.payload, "impacted_count": len(impacted)},
            scenario.id
        )
        return {"status": "success", "result": res, "impacted_allocations": impacted}
    except ValueError as ve:
        raise HTTPException(400, str(ve))
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(500, f"Error executing chaos event: {str(e)}")

@router.get("/allocations")
async def api_get_allocations(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Allocation).order_by(Allocation.created_at.desc()))
    allocs = result.scalars().all()
    
    # Enrich with human-readable names
    med_types = (await db.execute(select(MedicineType))).scalars().all()
    med_map = {m.id: m for m in med_types}
    
    zones = (await db.execute(select(Zone))).scalars().all()
    zone_map = {z.id: z.name for z in zones}
    
    hospitals = (await db.execute(select(Hospital))).scalars().all()
    hosp_map = {h.id: h.name for h in hospitals}
    
    ambulances = (await db.execute(select(Ambulance))).scalars().all()
    amb_map = {a.id: a.name for a in ambulances}
    
    sources = (await db.execute(select(ResourceSource))).scalars().all()
    src_map = {s.id: s.name for s in sources}
    
    enriched = []
    for a in allocs:
        med = med_map.get(a.medicine_type_id)
        dest_name = zone_map.get(a.destination_id) or hosp_map.get(a.destination_id) or a.destination_id
        src_name = src_map.get(a.source_id) or a.source_id
        veh_name = amb_map.get(a.vehicle_id) or a.vehicle_id
        
        enriched.append({
            "id": a.id,
            "strategy_id": a.strategy_id,
            "scenario_id": a.scenario_id,
            "resource_type": a.resource_type,
            "quantity": a.quantity,
            "source_id": a.source_id,
            "source_name": src_name,
            "destination_id": a.destination_id,
            "destination_name": dest_name,
            "destination_type": a.destination_type,
            "vehicle_id": a.vehicle_id,
            "vehicle_name": veh_name,
            "medicine_type_id": a.medicine_type_id,
            "medicine_type_code": med.code if med else None,
            "medicine_type_name": med.name if med else None,
            "route_node_ids": a.route_node_ids,
            "route_distance_km": a.route_distance_km,
            "route_travel_min": a.route_travel_min,
            "route_risk": a.route_risk,
            "status": a.status,
            "superseded_by_id": a.superseded_by_id,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "updated_at": a.updated_at.isoformat() if a.updated_at else None,
        })
        
    return {"allocations": enriched}

@router.patch("/allocations/{id}/status")
async def api_update_allocation_status(id: str, req: AllocationStatusUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Allocation).where(Allocation.id == id))
    alloc = result.scalar_one_or_none()
    if not alloc:
        raise HTTPException(404, "Allocation not found")
        
    old_status = alloc.status
    try:
        new_status_enum = AllocationStatus(req.status.lower())
    except ValueError:
        raise HTTPException(400, f"Invalid allocation status: {req.status}")
        
    # Validate transition
    valid_transitions = {
        AllocationStatus.PROPOSED: [AllocationStatus.APPROVED, AllocationStatus.CANCELLED],
        AllocationStatus.APPROVED: [AllocationStatus.DISPATCHED, AllocationStatus.IN_TRANSIT, AllocationStatus.CANCELLED, AllocationStatus.SUPERSEDED],
        AllocationStatus.DISPATCHED: [AllocationStatus.IN_TRANSIT, AllocationStatus.CANCELLED, AllocationStatus.SUPERSEDED],
        AllocationStatus.IN_TRANSIT: [AllocationStatus.DELIVERED, AllocationStatus.CANCELLED, AllocationStatus.SUPERSEDED],
        AllocationStatus.DELIVERED: [AllocationStatus.VERIFIED, AllocationStatus.SUPERSEDED],
        AllocationStatus.VERIFIED: [AllocationStatus.SUPERSEDED],
        AllocationStatus.SUPERSEDED: [],
        AllocationStatus.CANCELLED: [],
    }
    
    if new_status_enum not in valid_transitions.get(old_status, []):
        raise HTTPException(400, f"Invalid lifecycle transition from {old_status} to {new_status_enum}")
        
    alloc.status = new_status_enum
    await audit_service.log_event(
        db, AuditEventType.ALLOCATION_STATUS_CHANGED, "operator", "allocation", alloc.id,
        {"old_status": old_status, "new_status": req.status}, alloc.scenario_id
    )
    return {"status": "success", "allocation_id": alloc.id, "new_status": alloc.status}

@router.get("/audit")
async def api_get_audit(db: AsyncSession = Depends(get_db)):
    events = await audit_service.get_events(db)
    return {"events": events}

@router.get("/audit/verify")
async def api_verify_audit(db: AsyncSession = Depends(get_db)):
    verification = await audit_service.verify_chain(db)
    return verification

@router.get("/health")
async def api_health():
    return {"status": "ok", "version": "1.0"}

