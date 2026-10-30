from collections import Counter
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.api.deps import ANY_USER, get_db
from app.api.diagnosis import OPEN
from app.models import Device, Diagnosis, Sensor, SensorReading, now

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
def overview(db: Session = Depends(get_db), _=Depends(ANY_USER)):
    devices = list(db.scalars(select(Device).order_by(Device.id)))
    open_faults = list(db.scalars(select(Diagnosis).where(Diagnosis.status.in_(OPEN))))
    recent = db.execute(select(Diagnosis, Device.name).join(Device)
                        .order_by(Diagnosis.detected_at.desc(), Diagnosis.id.desc()).limit(10)).all()
    freq = db.execute(select(Diagnosis.fault_name, func.count()).group_by(Diagnosis.fault_name)
                      .order_by(func.count().desc()).limit(10)).all()
    since = now() - timedelta(days=7)
    days = Counter(d.detected_at.date().isoformat() for d in
                   db.scalars(select(Diagnosis).where(Diagnosis.detected_at >= since.replace(tzinfo=None))))
    return {
        "total_devices": len(devices),
        "online_devices": sum(d.status == "online" for d in devices),
        "offline_devices": sum(d.status != "online" for d in devices),
        "active_faults": len(open_faults),
        "critical_faults": sum(f.severity == "critical" for f in open_faults),
        "warning_faults": sum(f.severity != "critical" for f in open_faults),
        "system_health": round(sum(d.health_score for d in devices) / len(devices), 1) if devices else 100.0,
        "severity_distribution": dict(Counter(f.severity for f in open_faults)),
        "recent_diagnoses": [{"id": f.id, "device": name, "fault": f.fault_name, "severity": f.severity,
                              "confidence": f.confidence, "status": f.status, "detected_at": f.detected_at}
                             for f, name in recent],
        "fault_frequency": [{"fault": n, "count": c} for n, c in freq],
        "fault_trend": [{"date": k, "count": v} for k, v in sorted(days.items())],
        "device_health": [{"id": d.id, "name": d.name, "status": d.status, "health_score": d.health_score}
                          for d in devices],
    }


@router.get("/series/{device_id}")
def series(device_id: int, limit: int = 60, db: Session = Depends(get_db), _=Depends(ANY_USER)):
    """Latest readings per sensor kind (oldest first) for the history charts."""
    dev = db.get(Device, device_id)
    if not dev:
        raise HTTPException(404, "Device not found")
    out = {}
    for s in dev.sensors:
        rows = db.execute(select(SensorReading.ts, SensorReading.value).where(SensorReading.sensor_id == s.id)
                          .order_by(SensorReading.ts.desc(), SensorReading.id.desc())
                          .limit(min(max(limit, 1), 500))).all()
        out[s.kind] = {"unit": s.unit, "points": [{"ts": ts, "value": v} for ts, v in reversed(rows)]}
    return out
