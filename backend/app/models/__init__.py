from datetime import datetime, timezone
from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.session import Base


def now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="viewer")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Device(Base):
    __tablename__ = "devices"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    type: Mapped[str] = mapped_column(String(50))
    location: Mapped[str] = mapped_column(String(120), default="")
    status: Mapped[str] = mapped_column(String(20), default="online")
    health_score: Mapped[float] = mapped_column(Float, default=100.0)
    sim_mode: Mapped[str] = mapped_column(String(20), default="normal")
    sim_interval_s: Mapped[int] = mapped_column(Integer, default=5)
    last_active: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    sensors: Mapped[list["Sensor"]] = relationship(cascade="all, delete-orphan", back_populates="device")


class Sensor(Base):
    __tablename__ = "sensors"
    id: Mapped[int] = mapped_column(primary_key=True)
    device_id: Mapped[int] = mapped_column(ForeignKey("devices.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(30))
    unit: Mapped[str] = mapped_column(String(10))
    min_normal: Mapped[float] = mapped_column(Float)
    max_normal: Mapped[float] = mapped_column(Float)
    device: Mapped[Device] = relationship(back_populates="sensors")


class SensorReading(Base):
    __tablename__ = "sensor_readings"
    id: Mapped[int] = mapped_column(primary_key=True)
    device_id: Mapped[int] = mapped_column(ForeignKey("devices.id", ondelete="CASCADE"))
    sensor_id: Mapped[int] = mapped_column(ForeignKey("sensors.id", ondelete="CASCADE"))
    value: Mapped[float] = mapped_column(Float)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (Index("ix_reading_device_ts", "device_id", "ts"), Index("ix_reading_sensor_ts", "sensor_id", "ts"))


class KnowledgeBase(Base):
    __tablename__ = "knowledge_base"
    id: Mapped[int] = mapped_column(primary_key=True)
    fault_name: Mapped[str] = mapped_column(String(120), unique=True)
    description: Mapped[str] = mapped_column(Text, default="")
    symptoms: Mapped[list] = mapped_column(JSON, default=list)
    causes: Mapped[list] = mapped_column(JSON, default=list)
    prevention: Mapped[list] = mapped_column(JSON, default=list)
    rules: Mapped[list["FaultRule"]] = relationship(cascade="all, delete-orphan", back_populates="kb")


class FaultRule(Base):
    __tablename__ = "fault_rules"
    id: Mapped[int] = mapped_column(primary_key=True)
    kb_id: Mapped[int] = mapped_column(ForeignKey("knowledge_base.id", ondelete="CASCADE"), index=True)
    mode: Mapped[str] = mapped_column(String(5), default="all")
    severity: Mapped[str] = mapped_column(String(10))
    conditions: Mapped[list] = mapped_column(JSON)
    actions: Mapped[list] = mapped_column(JSON, default=list)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    kb: Mapped[KnowledgeBase] = relationship(back_populates="rules")


class Diagnosis(Base):
    __tablename__ = "diagnoses"
    id: Mapped[int] = mapped_column(primary_key=True)
    device_id: Mapped[int] = mapped_column(ForeignKey("devices.id", ondelete="CASCADE"), index=True)
    kb_id: Mapped[int | None] = mapped_column(ForeignKey("knowledge_base.id", ondelete="SET NULL"), nullable=True)
    fault_name: Mapped[str] = mapped_column(String(120))
    severity: Mapped[str] = mapped_column(String(10), index=True)
    confidence: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="detected", index=True)
    summary: Mapped[str] = mapped_column(Text)
    readings: Mapped[dict] = mapped_column(JSON, default=dict)
    resolution_notes: Mapped[str] = mapped_column(Text, default="")
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)
    evidence: Mapped[list["DiagnosisEvidence"]] = relationship(cascade="all, delete-orphan")


class DiagnosisEvidence(Base):
    __tablename__ = "diagnosis_evidence"
    id: Mapped[int] = mapped_column(primary_key=True)
    diagnosis_id: Mapped[int] = mapped_column(ForeignKey("diagnoses.id", ondelete="CASCADE"), index=True)
    sensor_kind: Mapped[str] = mapped_column(String(30))
    value: Mapped[float] = mapped_column(Float)
    op: Mapped[str] = mapped_column(String(3))
    threshold: Mapped[float] = mapped_column(Float)
    explanation: Mapped[str] = mapped_column(Text)


class Alert(Base):
    __tablename__ = "alerts"
    id: Mapped[int] = mapped_column(primary_key=True)
    diagnosis_id: Mapped[int] = mapped_column(ForeignKey("diagnoses.id", ondelete="CASCADE"))
    device_id: Mapped[int] = mapped_column(ForeignKey("devices.id", ondelete="CASCADE"), index=True)
    level: Mapped[str] = mapped_column(String(10))
    message: Mapped[str] = mapped_column(Text)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
