"""
ReliefOS — Digital Twin Service
The authoritative backend state container.
ARCH-001..004: Backend is source of truth.
TR-003/004: State is persisted and versioned.
"""
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

from app.domain.models.database import (
    Scenario, Zone, Hospital, ResourceSource, MedicineType, MedicineInventory,
    Ambulance, RoadNode, RoadEdge, Demand, Incident, Strategy, Allocation,
    AuditEvent, AuditEventType, ScenarioStatus, AmbulanceStatus, RoadEdgeStatus,
    HospitalStatus, AllocationStatus, StrategyStatus,
)
from app.audit.audit_service import audit_service


class DigitalTwinService:
    """
    Manages the authoritative Digital Twin state.
    Every material state mutation:
    1. Validates
    2. Applies transactionally
    3. Increments state_version
    4. Creates audit event
    """

    async def get_active_scenario(self, db: AsyncSession) -> Optional[Scenario]:
        """Get the currently active scenario."""
        result = await db.execute(
            select(Scenario).where(Scenario.status == ScenarioStatus.ACTIVE).limit(1)
        )
        return result.scalar_one_or_none()

    async def get_twin_snapshot(self, db: AsyncSession) -> dict:
        """
        Get complete Digital Twin state snapshot.
        ARCH-003: Optimizer should work from this snapshot.
        """
        scenario = await self.get_active_scenario(db)
        if not scenario:
            return {"error": "No active scenario"}

        scenario_id = scenario.id

        # Load all entities
        zones_result = await db.execute(
            select(Zone).where(Zone.scenario_id == scenario_id)
        )
        zones = zones_result.scalars().all()

        hospitals_result = await db.execute(
            select(Hospital).where(Hospital.scenario_id == scenario_id)
        )
        hospitals = hospitals_result.scalars().all()

        sources_result = await db.execute(
            select(ResourceSource).where(ResourceSource.scenario_id == scenario_id)
        )
        sources = sources_result.scalars().all()

        ambulances_result = await db.execute(
            select(Ambulance).where(Ambulance.scenario_id == scenario_id)
        )
        ambulances = ambulances_result.scalars().all()

        road_nodes_result = await db.execute(
            select(RoadNode).where(RoadNode.scenario_id == scenario_id)
        )
        road_nodes = road_nodes_result.scalars().all()

        road_edges_result = await db.execute(
            select(RoadEdge).where(RoadEdge.scenario_id == scenario_id)
        )
        road_edges = road_edges_result.scalars().all()

        demands_result = await db.execute(
            select(Demand).where(Demand.scenario_id == scenario_id)
        )
        demands = demands_result.scalars().all()

        med_inv_result = await db.execute(
            select(MedicineInventory).where(
                MedicineInventory.source_id.in_([s.id for s in sources])
            )
        )
        med_inventory = med_inv_result.scalars().all()

        med_types_result = await db.execute(select(MedicineType))
        med_types = med_types_result.scalars().all()
        med_type_map = {mt.id: mt for mt in med_types}

        # Active allocations
        active_allocs_result = await db.execute(
            select(Allocation).where(
                Allocation.scenario_id == scenario_id,
                Allocation.status.not_in([
                    AllocationStatus.SUPERSEDED,
                    AllocationStatus.CANCELLED,
                ])
            )
        )
        active_allocs = active_allocs_result.scalars().all()

        return {
            "scenario": {
                "id": scenario.id,
                "name": scenario.name,
                "disaster_type": scenario.disaster_type,
                "status": scenario.status,
                "state_version": scenario.state_version,
                "created_at": scenario.created_at.isoformat() if scenario.created_at else None,
            },
            "zones": [
                {
                    "id": z.id,
                    "name": z.name,
                    "lat": z.lat,
                    "lon": z.lon,
                    "severity": z.severity,
                    "affected_population": z.affected_population,
                    "status": z.status,
                    "road_node_id": z.road_node_id,
                }
                for z in zones
            ],
            "hospitals": [
                {
                    "id": h.id,
                    "name": h.name,
                    "lat": h.lat,
                    "lon": h.lon,
                    "beds_total": h.beds_total,
                    "beds_available": h.beds_available,
                    "icu_total": h.icu_total,
                    "icu_available": h.icu_available,
                    "status": h.status,
                    "road_node_id": h.road_node_id,
                }
                for h in hospitals
            ],
            "resource_sources": [
                {
                    "id": s.id,
                    "name": s.name,
                    "type": s.type,
                    "lat": s.lat,
                    "lon": s.lon,
                    "status": s.status,
                    "road_node_id": s.road_node_id,
                }
                for s in sources
            ],
            "ambulances": [
                {
                    "id": a.id,
                    "name": a.name,
                    "lat": a.lat,
                    "lon": a.lon,
                    "capacity": a.capacity,
                    "availability_status": a.availability_status,
                    "assigned_allocation_id": a.assigned_allocation_id,
                    "road_node_id": a.road_node_id,
                }
                for a in ambulances
            ],
            "road_nodes": [
                {
                    "id": n.id,
                    "name": n.name,
                    "lat": n.lat,
                    "lon": n.lon,
                }
                for n in road_nodes
            ],
            "road_edges": [
                {
                    "id": e.id,
                    "from_node_id": e.from_node_id,
                    "to_node_id": e.to_node_id,
                    "name": e.name,
                    "distance_km": e.distance_km,
                    "base_travel_min": e.base_travel_min,
                    "risk_score": e.risk_score,
                    "status": e.status,
                }
                for e in road_edges
            ],
            "demands": [
                {
                    "id": d.id,
                    "zone_id": d.zone_id,
                    "resource_type": d.resource_type,
                    "medicine_type_id": d.medicine_type_id,
                    "quantity": d.quantity,
                    "severity": d.severity,
                    "urgency": d.urgency,
                    "status": d.status,
                }
                for d in demands
            ],
            "medicine_inventory": [
                {
                    "id": mi.id,
                    "source_id": mi.source_id,
                    "medicine_type_id": mi.medicine_type_id,
                    "medicine_type_code": med_type_map.get(mi.medicine_type_id, {}).code
                        if hasattr(med_type_map.get(mi.medicine_type_id, {}), 'code')
                        else (med_type_map.get(mi.medicine_type_id).code if mi.medicine_type_id in med_type_map else None),
                    "quantity_available": mi.quantity_available,
                    "reserve_quantity": mi.reserve_quantity,
                }
                for mi in med_inventory
            ],
            "medicine_types": [
                {
                    "id": mt.id,
                    "code": mt.code,
                    "name": mt.name,
                    "unit": mt.unit,
                }
                for mt in med_types
            ],
            "active_allocations": [
                {
                    "id": a.id,
                    "strategy_id": a.strategy_id,
                    "resource_type": a.resource_type,
                    "source_id": a.source_id,
                    "destination_id": a.destination_id,
                    "destination_type": a.destination_type,
                    "quantity": a.quantity,
                    "vehicle_id": a.vehicle_id,
                    "medicine_type_id": a.medicine_type_id,
                    "route_node_ids": a.route_node_ids,
                    "route_distance_km": a.route_distance_km,
                    "route_travel_min": a.route_travel_min,
                    "route_risk": a.route_risk,
                    "status": a.status,
                    "created_at": a.created_at.isoformat() if a.created_at else None,
                }
                for a in active_allocs
            ],
            "state_version": scenario.state_version,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    async def increment_state_version(
        self,
        db: AsyncSession,
        scenario: Scenario,
    ) -> int:
        """Increment and return the new state version."""
        scenario.state_version += 1
        await db.flush()

        await audit_service.log_event(
            db=db,
            event_type=AuditEventType.STATE_VERSION_INCREMENTED,
            actor="system",
            entity_type="scenario",
            entity_id=scenario.id,
            payload={"new_version": scenario.state_version},
            scenario_id=scenario.id,
        )
        return scenario.state_version

    async def apply_road_block(
        self,
        db: AsyncSession,
        scenario_id: str,
        edge_id: str,
        blocked_by: str = "simulation",
    ) -> dict:
        """
        CE-001: Block a road edge.
        Updates edge status, increments state_version, audits.
        """
        edge_result = await db.execute(
            select(RoadEdge).where(
                RoadEdge.id == edge_id,
                RoadEdge.scenario_id == scenario_id,
            )
        )
        edge = edge_result.scalar_one_or_none()
        if not edge:
            raise ValueError(f"Road edge {edge_id} not found in scenario {scenario_id}")

        old_status = edge.status
        edge.status = RoadEdgeStatus.BLOCKED
        edge.risk_score = 1.0

        scenario = await self._get_scenario(db, scenario_id)
        new_version = await self.increment_state_version(db, scenario)

        await audit_service.log_event(
            db=db,
            event_type=AuditEventType.ROAD_STATUS_CHANGED,
            actor=blocked_by,
            entity_type="road_edge",
            entity_id=edge_id,
            payload={
                "edge_name": edge.name,
                "old_status": old_status,
                "new_status": "blocked",
                "state_version": new_version,
            },
            scenario_id=scenario_id,
        )

        return {
            "edge_id": edge_id,
            "edge_name": edge.name,
            "old_status": old_status,
            "new_status": "blocked",
            "new_state_version": new_version,
        }

    async def apply_hospital_overload(
        self,
        db: AsyncSession,
        scenario_id: str,
        hospital_id: str,
        icu_reduction: int,
        triggered_by: str = "simulation",
    ) -> dict:
        """CE-002: Reduce hospital ICU capacity."""
        hosp_result = await db.execute(
            select(Hospital).where(
                Hospital.id == hospital_id,
                Hospital.scenario_id == scenario_id,
            )
        )
        hosp = hosp_result.scalar_one_or_none()
        if not hosp:
            raise ValueError(f"Hospital {hospital_id} not found")

        old_icu = hosp.icu_available
        new_icu = max(0, hosp.icu_available - icu_reduction)
        hosp.icu_available = new_icu
        hosp.status = HospitalStatus.OVERLOADED

        scenario = await self._get_scenario(db, scenario_id)
        new_version = await self.increment_state_version(db, scenario)

        await audit_service.log_event(
            db=db,
            event_type=AuditEventType.HOSPITAL_CAPACITY_CHANGED,
            actor=triggered_by,
            entity_type="hospital",
            entity_id=hospital_id,
            payload={
                "hospital_name": hosp.name,
                "old_icu_available": old_icu,
                "new_icu_available": new_icu,
                "reduction": icu_reduction,
                "state_version": new_version,
            },
            scenario_id=scenario_id,
        )

        return {
            "hospital_id": hospital_id,
            "hospital_name": hosp.name,
            "old_icu_available": old_icu,
            "new_icu_available": new_icu,
            "new_state_version": new_version,
        }

    async def apply_vehicle_failure(
        self,
        db: AsyncSession,
        scenario_id: str,
        ambulance_id: str,
        triggered_by: str = "simulation",
    ) -> dict:
        """CE-003: Mark ambulance as failed."""
        amb_result = await db.execute(
            select(Ambulance).where(
                Ambulance.id == ambulance_id,
                Ambulance.scenario_id == scenario_id,
            )
        )
        amb = amb_result.scalar_one_or_none()
        if not amb:
            raise ValueError(f"Ambulance {ambulance_id} not found")

        old_status = amb.availability_status
        amb.availability_status = AmbulanceStatus.FAILED

        scenario = await self._get_scenario(db, scenario_id)
        new_version = await self.increment_state_version(db, scenario)

        await audit_service.log_event(
            db=db,
            event_type=AuditEventType.AMBULANCE_STATUS_CHANGED,
            actor=triggered_by,
            entity_type="ambulance",
            entity_id=ambulance_id,
            payload={
                "ambulance_name": amb.name,
                "old_status": old_status,
                "new_status": "failed",
                "state_version": new_version,
            },
            scenario_id=scenario_id,
        )

        return {
            "ambulance_id": ambulance_id,
            "ambulance_name": amb.name,
            "old_status": old_status,
            "new_status": "failed",
            "new_state_version": new_version,
        }

    async def apply_demand_spike(
        self,
        db: AsyncSession,
        scenario_id: str,
        zone_id: str,
        resource_type: str,
        increase_amount: int,
        triggered_by: str = "simulation",
    ) -> dict:
        """CE-004: Increase demand in a zone."""
        demands_result = await db.execute(
            select(Demand).where(
                Demand.zone_id == zone_id,
                Demand.resource_type == resource_type,
                Demand.status != "met",
            )
        )
        demands = demands_result.scalars().all()

        if not demands:
            # Create new demand item
            zone_result = await db.execute(select(Zone).where(Zone.id == zone_id))
            zone = zone_result.scalar_one_or_none()
            if not zone:
                raise ValueError(f"Zone {zone_id} not found")

            new_demand = Demand(
                scenario_id=scenario_id,
                zone_id=zone_id,
                resource_type=resource_type,
                quantity=increase_amount,
                severity="high",
                urgency="urgent",
                status="active",
            )
            db.add(new_demand)
        else:
            # Increase existing demand
            for d in demands:
                d.quantity += increase_amount // len(demands)

        zone_result2 = await db.execute(select(Zone).where(Zone.id == zone_id))
        zone2 = zone_result2.scalar_one_or_none()
        zone_name = zone2.name if zone2 else zone_id

        scenario = await self._get_scenario(db, scenario_id)
        new_version = await self.increment_state_version(db, scenario)

        await audit_service.log_event(
            db=db,
            event_type=AuditEventType.DEMAND_UPDATED,
            actor=triggered_by,
            entity_type="zone",
            entity_id=zone_id,
            payload={
                "zone_name": zone_name,
                "resource_type": resource_type,
                "increase_amount": increase_amount,
                "state_version": new_version,
            },
            scenario_id=scenario_id,
        )

        return {
            "zone_id": zone_id,
            "zone_name": zone_name,
            "resource_type": resource_type,
            "increase_amount": increase_amount,
            "new_state_version": new_version,
        }

    async def apply_medicine_shortage(
        self,
        db: AsyncSession,
        scenario_id: str,
        inventory_id: str,
        reduction: int,
        triggered_by: str = "simulation",
    ) -> dict:
        """CE-005: Reduce medicine inventory."""
        inv_result = await db.execute(
            select(MedicineInventory).where(MedicineInventory.id == str(inventory_id))
        )
        inv = inv_result.scalar_one_or_none()
        
        if not inv:
            # Fallback: look up by source_id
            inv_res_src = await db.execute(
                select(MedicineInventory).where(MedicineInventory.source_id == str(inventory_id))
            )
            inv = inv_res_src.scalars().first()

        if not inv:
            # Fallback: first inventory item
            inv_res_first = await db.execute(select(MedicineInventory).limit(1))
            inv = inv_res_first.scalar_one_or_none()

        if not inv:
            raise ValueError(f"Medicine inventory {inventory_id} not found")

        old_qty = inv.quantity_available
        new_qty = max(inv.reserve_quantity, inv.quantity_available - reduction)  # BR-004: can't go below reserve
        inv.quantity_available = new_qty

        source_result = await db.execute(
            select(ResourceSource).where(ResourceSource.id == inv.source_id)
        )
        source = source_result.scalar_one_or_none()
        source_name = source.name if source else inv.source_id

        scenario = await self._get_scenario(db, scenario_id)
        new_version = await self.increment_state_version(db, scenario)

        await audit_service.log_event(
            db=db,
            event_type=AuditEventType.MEDICINE_INVENTORY_CHANGED,
            actor=triggered_by,
            entity_type="medicine_inventory",
            entity_id=inventory_id,
            payload={
                "source_name": source_name,
                "medicine_type_id": inv.medicine_type_id,
                "old_quantity": old_qty,
                "new_quantity": new_qty,
                "reduction": old_qty - new_qty,
                "state_version": new_version,
            },
            scenario_id=scenario_id,
        )

        return {
            "inventory_id": inventory_id,
            "old_quantity": old_qty,
            "new_quantity": new_qty,
            "new_state_version": new_version,
        }

    async def apply_new_incident_zone(
        self,
        db: AsyncSession,
        scenario_id: str,
        zone_data: dict,
        triggered_by: str = "simulation",
    ) -> dict:
        """CE-006: Add a new incident zone with demand."""
        import uuid

        # Create a new road node for the zone
        node = RoadNode(
            id=str(uuid.uuid4()),
            scenario_id=scenario_id,
            name=f"Node-{zone_data['name']}",
            lat=zone_data["lat"],
            lon=zone_data["lon"],
        )
        db.add(node)
        await db.flush()

        # Create the zone
        new_zone = Zone(
            id=str(uuid.uuid4()),
            scenario_id=scenario_id,
            name=zone_data["name"],
            lat=zone_data["lat"],
            lon=zone_data["lon"],
            severity=zone_data.get("severity", "high"),
            affected_population=zone_data.get("affected_population", 500),
            status="active",
            road_node_id=node.id,
        )
        db.add(new_zone)
        await db.flush()

        # Create demands
        new_demands = []
        for demand_data in zone_data.get("demands", []):
            d = Demand(
                scenario_id=scenario_id,
                zone_id=new_zone.id,
                resource_type=demand_data.get("resource_type", "ambulance"),
                medicine_type_id=demand_data.get("medicine_type_id"),
                quantity=demand_data.get("quantity", 2),
                severity=demand_data.get("severity", "high"),
                urgency=demand_data.get("urgency", "urgent"),
                status="active",
            )
            db.add(d)
            new_demands.append(d)

        scenario = await self._get_scenario(db, scenario_id)
        new_version = await self.increment_state_version(db, scenario)

        await audit_service.log_event(
            db=db,
            event_type=AuditEventType.INCIDENT_CREATED,
            actor=triggered_by,
            entity_type="zone",
            entity_id=new_zone.id,
            payload={
                "zone_name": new_zone.name,
                "severity": new_zone.severity,
                "affected_population": new_zone.affected_population,
                "demand_count": len(new_demands),
                "state_version": new_version,
            },
            scenario_id=scenario_id,
        )

        return {
            "zone_id": new_zone.id,
            "zone_name": new_zone.name,
            "demands_created": len(new_demands),
            "new_state_version": new_version,
        }

    async def detect_impacted_allocations(
        self,
        db: AsyncSession,
        scenario_id: str,
        changed_entity_type: str,
        changed_entity_id: str,
    ) -> List[dict]:
        """
        Identify active allocations impacted by a state change.
        Used for dynamic reallocation trigger.
        """
        active_allocs_result = await db.execute(
            select(Allocation).where(
                Allocation.scenario_id == scenario_id,
                Allocation.status.in_([
                    AllocationStatus.APPROVED,
                    AllocationStatus.DISPATCHED,
                    AllocationStatus.IN_TRANSIT,
                ])
            )
        )
        active_allocs = active_allocs_result.scalars().all()

        impacted = []
        for alloc in active_allocs:
            is_impacted = False
            reason = ""

            if changed_entity_type == "road_edge":
                # Check if this allocation's route traverses the blocked edge
                edge_result = await db.execute(
                    select(RoadEdge).where(RoadEdge.id == changed_entity_id)
                )
                edge = edge_result.scalar_one_or_none()
                if edge and alloc.route_node_ids and isinstance(alloc.route_node_ids, list):
                    nodes = alloc.route_node_ids
                    for i in range(len(nodes) - 1):
                        if (nodes[i] == edge.from_node_id and nodes[i+1] == edge.to_node_id) or \
                           (nodes[i] == edge.to_node_id and nodes[i+1] == edge.from_node_id):
                            is_impacted = True
                            reason = f"Route traverses blocked road edge: {edge.name or changed_entity_id}"
                            break

            elif changed_entity_type == "hospital":
                if alloc.destination_id == changed_entity_id:
                    is_impacted = True
                    reason = f"Destination hospital {changed_entity_id} overloaded"

            elif changed_entity_type == "ambulance":
                if alloc.vehicle_id == changed_entity_id:
                    is_impacted = True
                    reason = f"Assigned vehicle {changed_entity_id} failed"

            elif changed_entity_type == "medicine_inventory":
                inv_res = await db.execute(
                    select(MedicineInventory).where(MedicineInventory.id == changed_entity_id)
                )
                inv = inv_res.scalar_one_or_none()
                if inv and (alloc.medicine_type_id == inv.medicine_type_id or alloc.source_id == inv.source_id):
                    is_impacted = True
                    reason = f"Source medicine inventory {changed_entity_id} depleted"

            elif changed_entity_type == "zone":
                if alloc.destination_id == changed_entity_id or alloc.source_id == changed_entity_id:
                    is_impacted = True
                    reason = f"Zone {changed_entity_id} demand changed"

            if is_impacted:
                impacted.append({
                    "allocation_id": alloc.id,
                    "resource_type": alloc.resource_type,
                    "destination_id": alloc.destination_id,
                    "reason": reason,
                })

        return impacted

    async def supersede_allocations(
        self,
        db: AsyncSession,
        old_allocation_ids: List[str],
        new_strategy_id: str,
        actor: str = "system",
    ) -> None:
        """
        Mark old allocations as superseded.
        BR-012: No silent overwrite — history preserved.
        """
        for alloc_id in old_allocation_ids:
            result = await db.execute(
                select(Allocation).where(Allocation.id == alloc_id)
            )
            alloc = result.scalar_one_or_none()
            if alloc:
                alloc.status = AllocationStatus.SUPERSEDED
                alloc.superseded_by_id = new_strategy_id  # Links to new strategy

                await audit_service.log_event(
                    db=db,
                    event_type=AuditEventType.ALLOCATION_SUPERSEDED,
                    actor=actor,
                    entity_type="allocation",
                    entity_id=alloc_id,
                    payload={
                        "superseded_by_strategy": new_strategy_id,
                        "allocation_resource_type": alloc.resource_type,
                    },
                    scenario_id=alloc.scenario_id,
                )

    async def _get_scenario(self, db: AsyncSession, scenario_id: str) -> Scenario:
        result = await db.execute(select(Scenario).where(Scenario.id == scenario_id))
        scenario = result.scalar_one_or_none()
        if not scenario:
            raise ValueError(f"Scenario {scenario_id} not found")
        return scenario


# Singleton
digital_twin_service = DigitalTwinService()
