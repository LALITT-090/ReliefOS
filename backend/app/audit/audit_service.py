"""
ReliefOS — Audit Service
Append-only audit with SHA256 hash chain.
TR-028..030, ARCH-009: Every state mutation creates an audit event.
"""
import json
import hashlib
import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.domain.models.database import AuditEvent, AuditEventType


class AuditService:
    """
    Append-only audit service with hash chaining.
    Event hash = SHA256(canonical_payload + previous_hash)
    Never removes or modifies events through normal UI.
    """

    async def log_event(
        self,
        db: AsyncSession,
        event_type: AuditEventType,
        actor: str,
        entity_type: Optional[str],
        entity_id: Optional[str],
        payload: dict,
        scenario_id: Optional[str] = None,
    ) -> AuditEvent:
        """
        Create an append-only audit event with hash chain.
        TR-029: SHA256(canonical_payload + previous_hash)
        """
        # Get the last event's hash for chain
        result = await db.execute(
            select(AuditEvent.event_hash)
            .where(AuditEvent.scenario_id == scenario_id if scenario_id else True)
            .order_by(AuditEvent.timestamp.desc(), AuditEvent.id.desc())
            .limit(1)
        )
        last_hash_row = result.first()
        previous_hash = last_hash_row[0] if last_hash_row else "0" * 64

        # Compute this event's hash
        event_id = str(uuid.uuid4())
        hashed_payload = {**payload, "audit_event_id": event_id}
        event_hash = AuditEvent.compute_hash(hashed_payload, previous_hash)

        audit_event = AuditEvent(
            id=event_id,
            scenario_id=scenario_id,
            event_type=event_type,
            actor=actor,
            entity_type=entity_type,
            entity_id=entity_id,
            previous_hash=previous_hash,
            event_hash=event_hash,
            payload_json=hashed_payload,
            timestamp=datetime.now(timezone.utc),
        )
        db.add(audit_event)
        await db.flush()
        return audit_event

    async def get_events(
        self,
        db: AsyncSession,
        scenario_id: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list:
        """Get audit events in chronological order."""
        query = select(AuditEvent).order_by(AuditEvent.timestamp.asc(), AuditEvent.id.asc())
        if scenario_id:
            query = query.where(AuditEvent.scenario_id == scenario_id)
        query = query.limit(limit).offset(offset)
        result = await db.execute(query)
        return result.scalars().all()

    async def verify_chain(
        self,
        db: AsyncSession,
        scenario_id: Optional[str] = None,
    ) -> dict:
        """
        Verify the hash chain integrity.
        Returns {valid: bool, errors: list, count: int}
        """
        events = await self.get_events(db, scenario_id=scenario_id, limit=10000)
        errors = []
        previous_hash = "0" * 64

        for i, event in enumerate(events):
            expected_hash = AuditEvent.compute_hash(
                event.payload_json or {}, previous_hash
            )
            if event.event_hash != expected_hash:
                errors.append(
                    f"Event {i} (id={event.id}): hash mismatch. "
                    f"Expected {expected_hash[:16]}..., got {event.event_hash[:16]}..."
                )
            if event.previous_hash != previous_hash:
                errors.append(
                    f"Event {i} (id={event.id}): previous_hash mismatch."
                )
            previous_hash = event.event_hash

        return {
            "valid": len(errors) == 0,
            "event_count": len(events),
            "errors": errors,
        }


# Singleton
audit_service = AuditService()
