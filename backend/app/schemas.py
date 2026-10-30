from typing import Literal
from pydantic import BaseModel, Field

Severity = Literal["low", "medium", "high", "critical"]
DeviceType = Literal["Industrial Motor", "HVAC System", "Pump", "Generator", "Smart Machine", "Cooling System"]


class RegisterIn(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=8, max_length=128)


class LoginIn(BaseModel):
    email: str
    password: str


class DeviceIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    type: DeviceType
    location: str = ""
    sim_interval_s: int = Field(default=5, ge=1, le=3600)


class ConditionIn(BaseModel):
    sensor: Literal["temperature", "humidity", "pressure", "vibration", "voltage", "current", "rpm"]
    op: Literal[">", ">=", "<", "<="]
    threshold: float
    weight: float = Field(default=1.0, gt=0)


class RuleIn(BaseModel):
    mode: Literal["all", "any"] = "all"
    severity: Severity
    conditions: list[ConditionIn] = Field(min_length=1)
    actions: list[str] = []


class KnowledgeIn(BaseModel):
    fault_name: str = Field(min_length=1, max_length=120)
    description: str = ""
    symptoms: list[str] = []
    causes: list[str] = []
    prevention: list[str] = []
    rule: RuleIn


class ReadingIn(BaseModel):
    device_id: int
    values: dict[str, float] = Field(min_length=1)


class DiagnosisRunIn(BaseModel):
    device_id: int
    readings: dict[str, float] | None = None  # omit to use the latest stored readings


class StatusIn(BaseModel):
    status: Literal["detected", "investigating", "resolved", "ignored"]
    resolution_notes: str = ""


class SimModeIn(BaseModel):
    mode: Literal["normal", "warning", "fault_injection", "random", "custom"]
    interval_s: int | None = Field(default=None, ge=1, le=3600)
    values: dict[str, float] | None = None  # used by custom mode


class InjectIn(BaseModel):
    values: dict[str, float] = Field(min_length=1)


class ForgotIn(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class ResetIn(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class AskIn(BaseModel):
    question: str = Field(min_length=2, max_length=500)
    device_id: int | None = None
