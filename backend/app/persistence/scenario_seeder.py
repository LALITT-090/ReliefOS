"""
ReliefOS — Scenario Seeder
Loads deterministic scenario data into the database.
TASK-017: Scenario load/reset.
NFR-001: Every reset produces the same baseline.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.domain.models.database import (
    Scenario, Zone, Hospital, ResourceSource, MedicineType, MedicineInventory,
    Ambulance, RoadNode, RoadEdge, Demand, Strategy, Allocation, AuditEvent,
    ScenarioStatus, AuditEventType,
)
from app.persistence.seed_data import get_seed_data, SCENARIO_ID
from app.audit.audit_service import audit_service


async def load_scenario(db: AsyncSession, scenario_id: str = SCENARIO_ID) -> Scenario:
    """
    Load or reset a deterministic scenario.
    API-001: POST /api/v1/scenarios/{id}/load
    """
    seed = get_seed_data()

    # ── 1. Delete existing scenario data (for reset) ──────────────────────
    existing = await db.execute(
        select(Scenario).where(Scenario.id == scenario_id)
    )
    existing_scenario = existing.scalar_one_or_none()

    if existing_scenario:
        # Full reset: delete all dependent data
        await db.execute(delete(AuditEvent).where(AuditEvent.scenario_id == scenario_id))
        await db.execute(delete(Allocation).where(Allocation.scenario_id == scenario_id))
        await db.execute(delete(Strategy).where(Strategy.scenario_id == scenario_id))
        await db.execute(delete(Demand).where(Demand.scenario_id == scenario_id))
        await db.execute(delete(MedicineInventory).where(
            MedicineInventory.source_id.in_(
                select(ResourceSource.id).where(ResourceSource.scenario_id == scenario_id)
            )
        ))
        await db.execute(delete(Ambulance).where(Ambulance.scenario_id == scenario_id))
        await db.execute(delete(Hospital).where(Hospital.scenario_id == scenario_id))
        await db.execute(delete(Zone).where(Zone.scenario_id == scenario_id))
        await db.execute(delete(ResourceSource).where(ResourceSource.scenario_id == scenario_id))
        await db.execute(delete(RoadEdge).where(RoadEdge.scenario_id == scenario_id))
        await db.execute(delete(RoadNode).where(RoadNode.scenario_id == scenario_id))
        await db.execute(delete(Scenario).where(Scenario.id == scenario_id))
        await db.flush()

    # ── 2. Deactivate other scenarios ─────────────────────────────────────
    await db.execute(
        select(Scenario).where(Scenario.status == ScenarioStatus.ACTIVE)
    )
    # Update other active scenarios
    other_result = await db.execute(
        select(Scenario).where(
            Scenario.status == ScenarioStatus.ACTIVE,
            Scenario.id != scenario_id,
        )
    )
    for other in other_result.scalars().all():
        other.status = ScenarioStatus.INACTIVE

    # ── 3. Create medicine types (global, shared) ─────────────────────────
    for mt_data in seed["medicine_types"]:
        existing_mt = await db.execute(
            select(MedicineType).where(MedicineType.id == mt_data["id"])
        )
        if not existing_mt.scalar_one_or_none():
            db.add(MedicineType(**mt_data))

    await db.flush()

    # ── 4. Create scenario ────────────────────────────────────────────────
    scenario_data = seed["scenario"].copy()
    scenario_data["status"] = ScenarioStatus.ACTIVE
    scenario = Scenario(**scenario_data)
    db.add(scenario)
    await db.flush()

    # ── 5. Create road nodes ──────────────────────────────────────────────
    node_map = {}
    for node_data in seed["road_nodes"]:
        node = RoadNode(scenario_id=scenario_id, **node_data)
        db.add(node)
        node_map[node_data["id"]] = node
    await db.flush()

    # ── 6. Create road edges ──────────────────────────────────────────────
    for edge_data in seed["road_edges"]:
        from app.domain.models.database import RoadEdgeStatus
        data = edge_data.copy()
        if isinstance(data.get("status"), str):
            data["status"] = RoadEdgeStatus(data["status"])
        edge = RoadEdge(scenario_id=scenario_id, **data)
        db.add(edge)
    await db.flush()

    # ── 7. Create zones ───────────────────────────────────────────────────
    for zone_data in seed["zones"]:
        from app.domain.models.database import ZoneSeverity
        data = zone_data.copy()
        if isinstance(data.get("severity"), str):
            data["severity"] = ZoneSeverity(data["severity"])
        zone = Zone(scenario_id=scenario_id, **data)
        db.add(zone)
    await db.flush()

    # ── 8. Create hospitals ───────────────────────────────────────────────
    for hosp_data in seed["hospitals"]:
        hosp = Hospital(scenario_id=scenario_id, **hosp_data)
        db.add(hosp)
    await db.flush()

    # ── 9. Create resource sources ────────────────────────────────────────
    for src_data in seed["resource_sources"]:
        src = ResourceSource(scenario_id=scenario_id, **src_data)
        db.add(src)
    await db.flush()

    # ── 10. Create medicine inventory ─────────────────────────────────────
    for inv_data in seed["medicine_inventory"]:
        inv_id = inv_data.get("id") or str(uuid.uuid4())
        clean_inv = {k: v for k, v in inv_data.items() if k != "id"}
        inv = MedicineInventory(
            id=inv_id,
            **clean_inv,
            updated_at=datetime.now(timezone.utc),
        )
        db.add(inv)
    await db.flush()

    # ── 11. Create ambulances ─────────────────────────────────────────────
    for amb_data in seed["ambulances"]:
        from app.domain.models.database import AmbulanceStatus
        data = amb_data.copy()
        if isinstance(data.get("availability_status"), str):
            data["availability_status"] = AmbulanceStatus(data["availability_status"])
        amb = Ambulance(scenario_id=scenario_id, **data)
        db.add(amb)
    await db.flush()

    # ── 12. Create demands ────────────────────────────────────────────────
    for demand_data in seed["demands"]:
        from app.domain.models.database import DemandSeverity, DemandUrgency
        data = demand_data.copy()
        if isinstance(data.get("severity"), str):
            data["severity"] = DemandSeverity(data["severity"])
        if isinstance(data.get("urgency"), str):
            data["urgency"] = DemandUrgency(data["urgency"])
        demand_id = data.pop("id", None) or str(uuid.uuid4())
        demand = Demand(
            id=demand_id,
            scenario_id=scenario_id,
            status="active",
            confidence=0.9,
            **data,
        )
        db.add(demand)
    await db.flush()

    # ── 13. Create scenario loaded audit event ────────────────────────────
    await audit_service.log_event(
        db=db,
        event_type=AuditEventType.SCENARIO_LOADED,
        actor="system",
        entity_type="scenario",
        entity_id=scenario_id,
        payload={
            "scenario_name": scenario.name,
            "disaster_type": scenario.disaster_type,
            "state_version": scenario.state_version,
            "zones": len(seed["zones"]),
            "hospitals": len(seed["hospitals"]),
            "ambulances": len(seed["ambulances"]),
        },
        scenario_id=scenario_id,
    )

    return scenario


async def get_or_load_earthquake_scenario(db: AsyncSession) -> Scenario:
    """
    Alternate scenario: Earthquake.
    TASK-016: At least one alternate disaster configuration.
    """
    EQ_SCENARIO_ID = "00000000-0000-0000-0000-000000000002"
    existing = await db.execute(
        select(Scenario).where(Scenario.id == EQ_SCENARIO_ID)
    )
    if existing.scalar_one_or_none():
        return existing.scalar_one_or_none()

    # Create minimal earthquake scenario
    # Share medicine types with urban flood
    scenario = Scenario(
        id=EQ_SCENARIO_ID,
        name="Earthquake — District Response",
        disaster_type="earthquake",
        description="Simulated earthquake response scenario. Synthetic demo data.",
        status=ScenarioStatus.INACTIVE,
        seed=99,
        state_version=1,
    )
    db.add(scenario)
    await db.flush()

    await audit_service.log_event(
        db=db,
        event_type=AuditEventType.SCENARIO_LOADED,
        actor="system",
        entity_type="scenario",
        entity_id=EQ_SCENARIO_ID,
        payload={"scenario_name": scenario.name, "disaster_type": scenario.disaster_type},
        scenario_id=EQ_SCENARIO_ID,
    )

    return scenario
