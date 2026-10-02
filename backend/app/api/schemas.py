from pydantic import BaseModel, field_validator
from typing import List, Dict, Optional, Any, Literal

VALID_STRATEGY_MODES = {"balanced", "severity_first", "coverage_first", "baseline_nearest"}

class IncidentCreate(BaseModel):
    type: str
    source: str = "simulation"
    severity: str = "medium"
    payload: Dict[str, Any]

class StrategyGenerateRequest(BaseModel):
    mode: str = "balanced"

    @field_validator("mode")
    @classmethod
    def validate_mode(cls, v: str) -> str:
        if v not in VALID_STRATEGY_MODES:
            raise ValueError(
                f"Invalid mode '{v}'. Must be one of: {sorted(VALID_STRATEGY_MODES)}"
            )
        return v

class ChaosEventRequest(BaseModel):
    event_type: str
    payload: Dict[str, Any]

class ApprovalRequest(BaseModel):
    operator_action: str = "approved"
    operator_note: Optional[str] = None
    operator_id: str = "Emergency Command Operator"

class StrategyModifyRequest(BaseModel):
    operator_id: str = "Emergency Command Operator"
    operator_note: Optional[str] = None
    allocation_modifications: Optional[List[Dict[str, Any]]] = None

class AllocationStatusUpdate(BaseModel):
    status: str



