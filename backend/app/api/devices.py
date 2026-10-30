from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.api.deps import ADMIN, ANY_USER, ENGINEER, get_db
from app.models import Device, Sensor, SensorReading, now
from app.schemas import DeviceIn, ReadingIn

router = APIRouter(prefix="/api", tags=["devices"])
# kind, unit, normal min, normal max
DEFAULT_SENSORS = [("temperature", "°C", 20, 70), ("humidity", "%", 30, 70), ("pressure", "bar", 1.5, 3.0),
                   ("vibration", "mm/s", 0, 6), ("voltage", "V", 215, 245), ("current", "A", 2, 9),
                   ("rpm", "rpm", 1000, 1600)]


def _out(d: Device) -> dict:
    return {"id": d.id, "name": d.name, "type": d.type, "location": d.location, "status": d.status,
            "health_score": d.health_score, "sim_mode": d.sim_mode, "sim_interval_s": d.sim_interval_s,
            "last_active": d.last_active, "sensors": [
                {"id": s.id, "kind": s.kind, "unit": s.unit, "min_normal": s.min_normal, "max_normal": s.max_normal}
                for s in d.sensors]}


def _get(db: Session, device_id: int) -> Device:
    d = db.get(Device, device_id)
    if not d:
        raise HTTPException(404, "Device not found")
    return d


@router.get("/devices")
def list_devices(db: Session = Depends(get_db), _=Depends(ANY_USER)):
    return [_out(d) for d in db.scalars(select(Device).order_by(Device.id))]


@router.post("/devices", status_code=201)
def create_device(body: DeviceIn, db: Session = Depends(get_db), _=Depends(ADMIN)):
    dev = Device(**body.model_dump())
    dev.sensors = [Sensor(kind=k, unit=u, min_normal=lo, max_normal=hi) for k, u, lo, hi in DEFAULT_SENSORS]
    db.add(dev)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "A device with that name already exists")
    return _out(dev)


@router.get("/devices/{device_id}")
def get_device(device_id: int, db: Session = Depends(get_db), _=Depends(ANY_USER)):
    return _out(_get(db, device_id))


@router.put("/devices/{device_id}")
def update_device(device_id: int, body: DeviceIn, db: Session = Depends(get_db), _=Depends(ADMIN)):
    dev = _get(db, device_id)
    for k, v in body.model_dump().items():
        setattr(dev, k, v)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "A device with that name already exists")
    return _out(dev)


@router.delete("/devices/{device_id}", status_code=204)
def delete_device(device_id: int, db: Session = Depends(get_db), _=Depends(ADMIN)):
    db.delete(_get(db, device_id)); db.commit()


def store_readings(db: Session, dev: Device, values: dict[str, float]) -> None:
    """Persist one reading per sensor kind and mark the device online."""
    by_kind = {s.kind: s for s in dev.sensors}
    unknown = [k for k in values if k not in by_kind]
    if unknown:
        raise HTTPException(422, f"Unknown sensor kinds: {', '.join(unknown)}")
    ts = now()
    db.add_all(SensorReading(device_id=dev.id, sensor_id=by_kind[k].id, value=v, ts=ts) for k, v in values.items())
    dev.last_active, dev.status = ts, "online"
    db.commit()


@router.post("/readings", status_code=201)
def ingest(body: ReadingIn, db: Session = Depends(get_db), _=Depends(ENGINEER)):
    dev = _get(db, body.device_id)
    store_readings(db, dev, body.values)
    return {"device_id": dev.id, "stored": len(body.values)}


@router.get("/readings/{device_id}")
def history(device_id: int, limit: int = 100, db: Session = Depends(get_db), _=Depends(ANY_USER)):
    _get(db, device_id)
    rows = db.execute(select(SensorReading, Sensor.kind).join(Sensor, Sensor.id == SensorReading.sensor_id)
                      .where(SensorReading.device_id == device_id)
                      .order_by(SensorReading.ts.desc(), SensorReading.id.desc()).limit(min(max(limit, 1), 1000))).all()
    return [{"kind": k, "value": r.value, "ts": r.ts} for r, k in rows]
