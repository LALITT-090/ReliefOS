"""
ReliefOS Backend — SQLAlchemy Database Models
DATA-001..017 from TRD
"""
import uuid
import hashlib
import json
from datetime import datetime, timezone
from enum import Enum as PyEnum
from typing import Optional

from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, Text, ForeignKey,
    Enum, JSON, Index
)
from sqlalchemy.orm import relationship, DeclarativeBase
from sqlalchemy.ext.asyncio import AsyncAttrs


class Base(AsyncAttrs, DeclarativeBase):
    pass


def new_uuid() -> str:
    return str(uuid.uuid4())


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ─── Enums ────────────────────────────────────────────────────────────────────

class ScenarioStatus(str, PyEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    RESET = "reset"

class ZoneSeverity(str, PyEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class HospitalStatus(str, PyEnum):
    OPERATIONAL = "operational"
    OVERLOADED = "overloaded"
    OFFLINE = "offline"

class AmbulanceStatus(str, PyEnum):
    AVAILABLE = "available"
    ASSIGNED = "assigned"
    IN_TRANSIT = "in_transit"
    UNAVAILABLE = "unavailable"
    FAILED = "failed"

class RoadEdgeStatus(str, PyEnum):
    OPEN = "open"
    HIGH_RISK = "high_risk"
    BLOCKED = "blocked"

class ResourceType(str, PyEnum):
    AMBULANCE = "ambulance"
    ICU_BED = "icu_bed"
    MEDICINE = "medicine"

class DemandSeverity(str, PyEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class DemandUrgency(str, PyEnum):
    ROUTINE = "routine"
    URGENT = "urgent"
    IMMEDIATE = "immediate"

class DemandStatus(str, PyEnum):
    ACTIVE = "active"
    PARTIALLY_MET = "partially_met"
    MET = "met"

class StrategyMode(str, PyEnum):
    BASELINE_NEAREST = "baseline_nearest"
    SEVERITY_FIRST = "severity_first"
    BALANCED = "balanced"
    COVERAGE_FIRST = "coverage_first"

class StrategyStatus(str, PyEnum):
    GENERATED = "generated"
    APPROVED = "approved"
    REJECTED = "rejected"
    STALE = "stale"
    SUPERSEDED = "superseded"

class AllocationStatus(str, PyEnum):
    PROPOSED = "proposed"
    APPROVED = "approved"
    DISPATCHED = "dispatched"
    IN_TRANSIT = "in_transit"
    DELIVERED = "delivered"
    VERIFIED = "verified"
    SUPERSEDED = "superseded"
    CANCELLED = "cancelled"

class ChaosEventType(str, PyEnum):
    ROAD_BLOCK = "road_block"
    HOSPITAL_OVERLOAD = "hospital_overload"
    VEHICLE_FAILURE = "vehicle_failure"
    DEMAND_SPIKE = "demand_spike"
    MEDICINE_SHORTAGE = "medicine_shortage"
    NEW_INCIDENT_ZONE = "new_incident_zone"

class AuditEventType(str, PyEnum):
    SCENARIO_LOADED = "scenario_loaded"
    SCENARIO_RESET = "scenario_reset"
    INCIDENT_CREATED = "incident_created"
    STRATEGY_GENERATED = "strategy_generated"
    STRATEGY_APPROVED = "strategy_approved"
    STRATEGY_REJECTED = "strategy_rejected"
    STRATEGY_STALE = "strategy_stale"
    ALLOCATION_CREATED = "allocation_created"
    ALLOCATION_STATUS_CHANGED = "allocation_status_changed"
    ALLOCATION_SUPERSEDED = "allocation_superseded"
    CHAOS_EVENT_APPLIED = "chaos_event_applied"
    DEMAND_UPDATED = "demand_updated"
    HOSPITAL_CAPACITY_CHANGED = "hospital_capacity_changed"
    ROAD_STATUS_CHANGED = "road_status_changed"
    AMBULANCE_STATUS_CHANGED = "ambulance_status_changed"
    MEDICINE_INVENTORY_CHANGED = "medicine_inventory_changed"
    REALLOCATION_TRIGGERED = "reallocation_triggered"
    STATE_VERSION_INCREMENTED = "state_version_incremented"


# ─── DATA-001 Scenario ────────────────────────────────────────────────────────

class Scenario(Base):
    __tablename__ = "scenarios"

    id = Column(String, primary_key=True, default=new_uuid)
    name = Column(String, nullable=False)
    disaster_type = Column(String, nullable=False)  # e.g. "urban_flood"
    description = Column(Text, nullable=True)
    status = Column(Enum(ScenarioStatus), default=ScenarioStatus.INACTIVE)
    seed = Column(Integer, nullable=False, default=42)
    state_version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    zones = relationship("Zone", back_populates="scenario", cascade="all, delete-orphan")
    hospitals = relationship("Hospital", back_populates="scenario", cascade="all, delete-orphan")
    resource_sources = relationship("ResourceSource", back_populates="scenario", cascade="all, delete-orphan")
    ambulances = relationship("Ambulance", back_populates="scenario", cascade="all, delete-orphan")
    demands = relationship("Demand", back_populates="scenario", cascade="all, delete-orphan")
    incidents = relationship("Incident", back_populates="scenario", cascade="all, delete-orphan")
    strategies = relationship("Strategy", back_populates="scenario", cascade="all, delete-orphan")
    road_nodes = relationship("RoadNode", back_populates="scenario", cascade="all, delete-orphan")
    road_edges = relationship("RoadEdge", back_populates="scenario", cascade="all, delete-orphan")


# ─── DATA-002 Zone ────────────────────────────────────────────────────────────

class Zone(Base):
    __tablename__ = "zones"

    id = Column(String, primary_key=True, default=new_uuid)
    scenario_id = Column(String, ForeignKey("scenarios.id"), nullable=False)
    name = Column(String, nullable=False)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    severity = Column(Enum(ZoneSeverity), default=ZoneSeverity.MEDIUM)
    affected_population = Column(Integer, default=0)
    status = Column(String, default="active")
    road_node_id = Column(String, ForeignKey("road_nodes.id"), nullable=True)

    scenario = relationship("Scenario", back_populates="zones")
    demands = relationship("Demand", back_populates="zone")
    road_node = relationship("RoadNode", foreign_keys=[road_node_id])


# ─── DATA-003 Hospital ────────────────────────────────────────────────────────

class Hospital(Base):
    __tablename__ = "hospitals"

    id = Column(String, primary_key=True, default=new_uuid)
    scenario_id = Column(String, ForeignKey("scenarios.id"), nullable=False)
    name = Column(String, nullable=False)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    beds_total = Column(Integer, default=0)
    beds_available = Column(Integer, default=0)
    icu_total = Column(Integer, default=0)
    icu_available = Column(Integer, default=0)
    status = Column(Enum(HospitalStatus), default=HospitalStatus.OPERATIONAL)
    road_node_id = Column(String, ForeignKey("road_nodes.id"), nullable=True)

    scenario = relationship("Scenario", back_populates="hospitals")
    road_node = relationship("RoadNode", foreign_keys=[road_node_id])


# ─── DATA-004 ResourceSource ──────────────────────────────────────────────────

class ResourceSource(Base):
    __tablename__ = "resource_sources"

    id = Column(String, primary_key=True, default=new_uuid)
    scenario_id = Column(String, ForeignKey("scenarios.id"), nullable=False)
    type = Column(String, nullable=False)  # warehouse, station, etc.
    name = Column(String, nullable=False)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    status = Column(String, default="active")
    road_node_id = Column(String, ForeignKey("road_nodes.id"), nullable=True)

    scenario = relationship("Scenario", back_populates="resource_sources")
    medicine_inventory = relationship("MedicineInventory", back_populates="source", cascade="all, delete-orphan")
    road_node = relationship("RoadNode", foreign_keys=[road_node_id])


# ─── DATA-005 MedicineType ────────────────────────────────────────────────────

class MedicineType(Base):
    __tablename__ = "medicine_types"

    id = Column(String, primary_key=True, default=new_uuid)
    code = Column(String, unique=True, nullable=False)  # e.g. ANTIBIOTIC, ANALGESIC
    name = Column(String, nullable=False)
    unit = Column(String, default="units")
    description = Column(Text, nullable=True)

    inventory = relationship("MedicineInventory", back_populates="medicine_type")
    demands = relationship("Demand", back_populates="medicine_type")


# ─── DATA-006 MedicineInventory ───────────────────────────────────────────────

class MedicineInventory(Base):
    __tablename__ = "medicine_inventory"

    id = Column(String, primary_key=True, default=new_uuid)
    source_id = Column(String, ForeignKey("resource_sources.id"), nullable=False)
    medicine_type_id = Column(String, ForeignKey("medicine_types.id"), nullable=False)
    quantity_available = Column(Integer, default=0)
    reserve_quantity = Column(Integer, default=0)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    source = relationship("ResourceSource", back_populates="medicine_inventory")
    medicine_type = relationship("MedicineType", back_populates="inventory")


# ─── DATA-007 Ambulance ───────────────────────────────────────────────────────

class Ambulance(Base):
    __tablename__ = "ambulances"

    id = Column(String, primary_key=True, default=new_uuid)
    scenario_id = Column(String, ForeignKey("scenarios.id"), nullable=False)
    name = Column(String, nullable=False)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    capacity = Column(Integer, default=2)
    availability_status = Column(Enum(AmbulanceStatus), default=AmbulanceStatus.AVAILABLE)
    assigned_allocation_id = Column(String, nullable=True)
    road_node_id = Column(String, ForeignKey("road_nodes.id"), nullable=True)

    scenario = relationship("Scenario", back_populates="ambulances")
    road_node = relationship("RoadNode", foreign_keys=[road_node_id])


# ─── DATA-008 RoadNode ────────────────────────────────────────────────────────

class RoadNode(Base):
    __tablename__ = "road_nodes"

    id = Column(String, primary_key=True, default=new_uuid)
    scenario_id = Column(String, ForeignKey("scenarios.id"), nullable=False)
    name = Column(String, nullable=True)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)

    scenario = relationship("Scenario", back_populates="road_nodes")
    edges_from = relationship("RoadEdge", foreign_keys="RoadEdge.from_node_id", back_populates="from_node")
    edges_to = relationship("RoadEdge", foreign_keys="RoadEdge.to_node_id", back_populates="to_node")


# ─── DATA-009 RoadEdge ────────────────────────────────────────────────────────

class RoadEdge(Base):
    __tablename__ = "road_edges"

    id = Column(String, primary_key=True, default=new_uuid)
    scenario_id = Column(String, ForeignKey("scenarios.id"), nullable=False)
    from_node_id = Column(String, ForeignKey("road_nodes.id"), nullable=False)
    to_node_id = Column(String, ForeignKey("road_nodes.id"), nullable=False)
    name = Column(String, nullable=True)
    distance_km = Column(Float, nullable=False)
    base_travel_min = Column(Float, nullable=False)
    risk_score = Column(Float, default=0.0)  # 0.0 = safe, 1.0 = max risk
    status = Column(Enum(RoadEdgeStatus), default=RoadEdgeStatus.OPEN)

    scenario = relationship("Scenario", back_populates="road_edges")
    from_node = relationship("RoadNode", foreign_keys=[from_node_id], back_populates="edges_from")
    to_node = relationship("RoadNode", foreign_keys=[to_node_id], back_populates="edges_to")


# ─── DATA-010 Demand ──────────────────────────────────────────────────────────

class Demand(Base):
    __tablename__ = "demands"

    id = Column(String, primary_key=True, default=new_uuid)
    scenario_id = Column(String, ForeignKey("scenarios.id"), nullable=False)
    zone_id = Column(String, ForeignKey("zones.id"), nullable=False)
    resource_type = Column(Enum(ResourceType), nullable=False)
    medicine_type_id = Column(String, ForeignKey("medicine_types.id"), nullable=True)
    quantity = Column(Integer, nullable=False)
    severity = Column(Enum(DemandSeverity), default=DemandSeverity.MEDIUM)
    urgency = Column(Enum(DemandUrgency), default=DemandUrgency.URGENT)
    due_by_minutes = Column(Integer, nullable=True)  # minutes from scenario start
    confidence = Column(Float, default=0.8)
    status = Column(Enum(DemandStatus), default=DemandStatus.ACTIVE)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    scenario = relationship("Scenario", back_populates="demands")
    zone = relationship("Zone", back_populates="demands")
    medicine_type = relationship("MedicineType", back_populates="demands")


# ─── DATA-011 Incident ────────────────────────────────────────────────────────

class Incident(Base):
    __tablename__ = "incidents"

    id = Column(String, primary_key=True, default=new_uuid)
    scenario_id = Column(String, ForeignKey("scenarios.id"), nullable=False)
    type = Column(String, nullable=False)  # ChaosEventType or custom
    source = Column(String, default="simulation")  # operator | field_report | system | simulation
    severity = Column(String, default="medium")
    confidence = Column(Float, default=1.0)
    event_time = Column(DateTime(timezone=True), default=utcnow)
    received_time = Column(DateTime(timezone=True), default=utcnow)
    payload_json = Column(JSON, nullable=True)
    processed = Column(Boolean, default=False)

    scenario = relationship("Scenario", back_populates="incidents")


# ─── DATA-012 Forecast ────────────────────────────────────────────────────────

class Forecast(Base):
    __tablename__ = "forecasts"

    id = Column(String, primary_key=True, default=new_uuid)
    scenario_id = Column(String, ForeignKey("scenarios.id"), nullable=False)
    zone_id = Column(String, ForeignKey("zones.id"), nullable=True)
    resource_type = Column(Enum(ResourceType), nullable=False)
    medicine_type_id = Column(String, ForeignKey("medicine_types.id"), nullable=True)
    horizon_min = Column(Integer, nullable=False)  # 30, 60, or 120
    current_quantity = Column(Float, nullable=False, default=0)
    predicted_demand = Column(Float, nullable=False)
    projected_supply = Column(Float, nullable=False, default=0)
    shortage_estimate = Column(Float, nullable=False, default=0)
    lower_bound = Column(Float, nullable=True)
    upper_bound = Column(Float, nullable=True)
    confidence = Column(Float, default=0.7)
    risk_level = Column(String, default="medium")  # low, medium, high, critical
    drivers = Column(JSON, nullable=True)  # list of driver strings
    generated_at = Column(DateTime(timezone=True), default=utcnow)
    state_version = Column(Integer, nullable=False, default=1)

    medicine_type = relationship("MedicineType", foreign_keys=[medicine_type_id])


# ─── DATA-013 Strategy ────────────────────────────────────────────────────────

class Strategy(Base):
    __tablename__ = "strategies"

    id = Column(String, primary_key=True, default=new_uuid)
    scenario_id = Column(String, ForeignKey("scenarios.id"), nullable=False)
    state_version = Column(Integer, nullable=False)  # TR-020: version at generation time
    objective_mode = Column(Enum(StrategyMode), nullable=False)
    status = Column(Enum(StrategyStatus), default=StrategyStatus.GENERATED)
    score = Column(Float, nullable=True)
    coverage_pct = Column(Float, nullable=True)
    unmet_demand = Column(Integer, nullable=True)
    avg_eta_min = Column(Float, nullable=True)
    avg_risk = Column(Float, nullable=True)
    predicted_shortage_impact = Column(Float, nullable=True)
    is_feasible = Column(Boolean, default=True)
    infeasibility_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    scenario = relationship("Scenario", back_populates="strategies")
    allocations = relationship("Allocation", back_populates="strategy", cascade="all, delete-orphan")
    evidence = relationship("DecisionEvidence", back_populates="strategy", cascade="all, delete-orphan")
    decision = relationship("Decision", back_populates="strategy", uselist=False, cascade="all, delete-orphan")


# ─── DATA-014 Allocation ──────────────────────────────────────────────────────

class Allocation(Base):
    __tablename__ = "allocations"

    id = Column(String, primary_key=True, default=new_uuid)
    strategy_id = Column(String, ForeignKey("strategies.id"), nullable=False)
    scenario_id = Column(String, ForeignKey("scenarios.id"), nullable=False)
    resource_type = Column(Enum(ResourceType), nullable=False)
    source_id = Column(String, nullable=True)       # ResourceSource.id or Ambulance base
    destination_id = Column(String, nullable=True)  # Hospital.id or Zone.id
    destination_type = Column(String, nullable=True)  # "hospital" or "zone"
    quantity = Column(Integer, nullable=False, default=1)
    vehicle_id = Column(String, ForeignKey("ambulances.id"), nullable=True)  # for ambulance allocs
    medicine_type_id = Column(String, ForeignKey("medicine_types.id"), nullable=True)
    route_node_ids = Column(JSON, nullable=True)    # list of road node IDs
    route_distance_km = Column(Float, nullable=True)
    route_travel_min = Column(Float, nullable=True)
    route_risk = Column(Float, nullable=True)
    status = Column(Enum(AllocationStatus), default=AllocationStatus.PROPOSED)
    superseded_by_id = Column(String, ForeignKey("allocations.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    strategy = relationship("Strategy", back_populates="allocations")
    vehicle = relationship("Ambulance", foreign_keys=[vehicle_id])
    medicine_type = relationship("MedicineType", foreign_keys=[medicine_type_id])
    superseded_by = relationship("Allocation", foreign_keys=[superseded_by_id], remote_side="Allocation.id")
    passport = relationship(
        "ResourcePassport",
        back_populates="allocation",
        uselist=False,
        cascade="all, delete-orphan",
    )


class ResourcePassport(Base):
    __tablename__ = "resource_passports"

    allocation_id = Column(String, ForeignKey("allocations.id"), primary_key=True)
    scenario_id = Column(String, ForeignKey("scenarios.id"), nullable=False)
    state_version = Column(Integer, nullable=False)
    resource_reference_id = Column(String, nullable=False)
    route_snapshot = Column(JSON, nullable=False)
    incident_event_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    allocation = relationship("Allocation", back_populates="passport")


# ─── DATA-015 DecisionEvidence ────────────────────────────────────────────────

class DecisionEvidence(Base):
    __tablename__ = "decision_evidence"

    id = Column(String, primary_key=True, default=new_uuid)
    strategy_id = Column(String, ForeignKey("strategies.id"), nullable=False)
    factor_type = Column(String, nullable=False)  # demand, capacity, route, severity, shortage
    factor_name = Column(String, nullable=False)
    value = Column(String, nullable=True)
    contribution = Column(Float, nullable=True)  # positive = helps, negative = hurts
    source_ref = Column(String, nullable=True)   # entity ID reference

    strategy = relationship("Strategy", back_populates="evidence")


# ─── DATA-016 Decision ────────────────────────────────────────────────────────

class Decision(Base):
    __tablename__ = "decisions"

    id = Column(String, primary_key=True, default=new_uuid)
    strategy_id = Column(String, ForeignKey("strategies.id"), nullable=False)
    operator_action = Column(String, nullable=False)  # approved, rejected, modified
    operator_note = Column(Text, nullable=True)
    operator_id = Column(String, default="Emergency Command Operator")
    timestamp = Column(DateTime(timezone=True), default=utcnow)

    strategy = relationship("Strategy", back_populates="decision")


# ─── DATA-017 AuditEvent ──────────────────────────────────────────────────────

class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(String, primary_key=True, default=new_uuid)
    scenario_id = Column(String, ForeignKey("scenarios.id"), nullable=True)
    event_type = Column(Enum(AuditEventType), nullable=False)
    actor = Column(String, default="system")
    entity_type = Column(String, nullable=True)
    entity_id = Column(String, nullable=True)
    previous_hash = Column(String, nullable=False, default="0" * 64)
    event_hash = Column(String, nullable=False)
    payload_json = Column(JSON, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=utcnow)

    @staticmethod
    def compute_hash(payload: dict, previous_hash: str) -> str:
        """SHA256(canonical_payload + previous_hash) — TR-029"""
        canonical = json.dumps(payload, sort_keys=True, default=str)
        data = canonical + previous_hash
        return hashlib.sha256(data.encode()).hexdigest()
