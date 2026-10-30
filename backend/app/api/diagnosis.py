from dataclasses import asdict
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session
from app.api.deps import ANY_USER, ENGINEER, get_db
from app.diagnosis.engine import DiagnosisEngine, Rule
from app.models import Alert, Device, Diagnosis, DiagnosisEvidence, FaultRule, KnowledgeBase, Sensor, SensorReading, now
from app.schemas import DiagnosisRunIn, StatusIn

router = APIRouter(prefix="/api", tags=["diagnosis"])
HEALTH_PENALTY = {"normal": 0, "low": 10, "medium": 25, "high": 45, "critical": 70}
OPEN = ("detected", "investigating")


def build_engine(db: Session) -> tuple[DiagnosisEngine, dict[str, int]]:
    """Load enabled rules from the knowledge base; returns engine and fault_name -> kb_id."""
    rows = db.execute(select(FaultRule, KnowledgeBase).join(KnowledgeBase).where(FaultRule.enabled)).all()
    rules = [Rule.from_dict({"fault": kb.fault_name, "description": kb.description, "severity": r.severity,
                             "mode": r.mode, "conditions": r.conditions, "causes": kb.causes,
                             "actions": r.actions, "prevention": kb.prevention}) for r, kb in rows]
    return DiagnosisEngine(rules), {kb.fault_name: kb.id for _, kb in rows}


def latest_readings(db: Session, device: Device) -> dict[str, float]:
    out: dict[str, float] = {}
    for s in device.sensors:
        v = db.scalar(select(SensorReading.value).where(SensorReading.sensor_id == s.id)
                      .order_by(SensorReading.ts.desc(), SensorReading.id.desc()).limit(1))
        if v is not None:
            out[s.kind] = v
    return out


def run_and_store(db: Session, device: Device, readings: dict[str, float]) -> dict:
    """Run the engine, persist diagnoses/evidence/alerts, update device health. Reused by the simulator."""
    engine, kb_ids = build_engine(db)
    report = engine.diagnose(device.name, readings)
    result = asdict(report)
    for d, out in zip(report.diagnoses, result["diagnoses"]):
        existing = db.scalar(select(Diagnosis).where(Diagnosis.device_id == device.id,
                             Diagnosis.fault_name == d.fault, Diagnosis.status.in_(OPEN)))
        if existing:  # don't duplicate an already-open fault
            out["id"], out["new"] = existing.id, False
            continue
        rec = Diagnosis(device_id=device.id, kb_id=kb_ids.get(d.fault), fault_name=d.fault, severity=d.severity,
                        confidence=d.confidence, summary=d.what_happened, readings=readings, detected_at=d.detected_at,
                        evidence=[DiagnosisEvidence(sensor_kind=e.sensor, value=e.value, op=e.op,
                                  threshold=e.threshold, explanation=e.explanation) for e in d.evidence])
        db.add(rec); db.flush()
        if d.severity in ("high", "critical"):
            db.add(Alert(diagnosis_id=rec.id, device_id=device.id, level=d.severity,
                         message=f"{device.name}: {d.fault} ({d.severity}, {d.confidence}% confidence)"))
        out["id"], out["new"] = rec.id, True
    device.health_score = max(0, 100 - HEALTH_PENALTY[report.overall_severity])
    device.last_active = now()
    db.commit()
    return result


@router.post("/diagnosis/run")
def run(body: DiagnosisRunIn, db: Session = Depends(get_db), _=Depends(ENGINEER)):
    device = db.get(Device, body.device_id)
    if not device:
        raise HTTPException(404, "Device not found")
    readings = body.readings if body.readings is not None else latest_readings(db, device)
    if not readings:
        raise HTTPException(422, "No readings available for this device")
    return run_and_store(db, device, readings)


def _fault_out(f: Diagnosis) -> dict:
    return {"id": f.id, "device_id": f.device_id, "fault": f.fault_name, "severity": f.severity,
            "confidence": f.confidence, "status": f.status, "summary": f.summary, "readings": f.readings,
            "resolution_notes": f.resolution_notes, "detected_at": f.detected_at,
            "evidence": [{"sensor": e.sensor_kind, "value": e.value, "op": e.op, "threshold": e.threshold,
                          "explanation": e.explanation} for e in f.evidence]}


SEVERITY_RANK = {"low": 1, "medium": 2, "high": 3, "critical": 4}


def _utc(dt: datetime | None) -> datetime | None:
    return dt.astimezone(timezone.utc) if dt and dt.tzinfo else dt


def fault_query(device_id=None, severity=None, status=None, date_from=None, date_to=None, sort="newest"):
    """Shared filter/sort logic for the fault history API and the report exports."""
    q = select(Diagnosis)
    for col, val in ((Diagnosis.device_id, device_id), (Diagnosis.severity, severity), (Diagnosis.status, status)):
        if val is not None:
            q = q.where(col == val)
    if date_from:
        q = q.where(Diagnosis.detected_at >= _utc(date_from))
    if date_to:
        q = q.where(Diagnosis.detected_at <= _utc(date_to))
    if sort == "oldest":
        return q.order_by(Diagnosis.detected_at.asc(), Diagnosis.id.asc())
    if sort == "severity":
        rank = case(SEVERITY_RANK, value=Diagnosis.severity, else_=0)
        return q.order_by(rank.desc(), Diagnosis.detected_at.desc())
    return q.order_by(Diagnosis.detected_at.desc(), Diagnosis.id.desc())


@router.get("/faults")
def list_faults(response: Response, device_id: int | None = None, severity: str | None = None,
                status: str | None = None, date_from: datetime | None = None, date_to: datetime | None = None,
                sort: str = "newest", skip: int = 0, limit: int = 20,
                db: Session = Depends(get_db), _=Depends(ANY_USER)):
    q = fault_query(device_id, severity, status, date_from, date_to, sort)
    response.headers["X-Total-Count"] = str(db.scalar(select(func.count()).select_from(q.subquery())))
    return [_fault_out(f) for f in db.scalars(q.offset(max(skip, 0)).limit(min(max(limit, 1), 200)))]


@router.get("/faults/{fault_id}")
def fault_detail(fault_id: int, db: Session = Depends(get_db), _=Depends(ANY_USER)):
    f = db.get(Diagnosis, fault_id)
    if not f:
        raise HTTPException(404, "Fault record not found")
    return _fault_out(f)


@router.patch("/faults/{fault_id}")
def update_status(fault_id: int, body: StatusIn, db: Session = Depends(get_db), _=Depends(ENGINEER)):
    f = db.get(Diagnosis, fault_id)
    if not f:
        raise HTTPException(404, "Fault record not found")
    f.status, f.resolution_notes = body.status, body.resolution_notes
    db.commit()
    return _fault_out(f)
