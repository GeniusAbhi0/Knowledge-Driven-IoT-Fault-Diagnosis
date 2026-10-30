from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import ANY_USER, ENGINEER, get_db
from app.models import Device
from app.schemas import InjectIn, SimModeIn
from app.simulator.generator import SCENARIOS, SimState
from app.simulator.manager import SimulatorManager

router = APIRouter(prefix="/api/simulator", tags=["simulator"])
manager = SimulatorManager()


def _device(db: Session, device_id: int) -> Device:
    dev = db.get(Device, device_id)
    if not dev:
        raise HTTPException(404, "Device not found")
    return dev


def _check_kinds(dev: Device, values: dict[str, float]) -> None:
    unknown = set(values) - {s.kind for s in dev.sensors}
    if unknown:
        raise HTTPException(422, f"Unknown sensor kinds: {', '.join(sorted(unknown))}")


def _status(dev: Device) -> dict:
    st = manager.get_state(dev.id)
    return {"device_id": dev.id, "running": manager.is_running(dev.id), "mode": dev.sim_mode,
            "interval_s": st.interval_s, "overrides": st.overrides}


@router.get("/scenarios")
def scenarios(_=Depends(ANY_USER)):
    return [{"key": k, **v} for k, v in SCENARIOS.items()]


@router.get("/{device_id}")
def status(device_id: int, db: Session = Depends(get_db), _=Depends(ANY_USER)):
    return _status(_device(db, device_id))


@router.post("/{device_id}/start")
async def start(device_id: int, db: Session = Depends(get_db), _=Depends(ENGINEER)):
    dev = _device(db, device_id)
    manager.get_state(dev.id).interval_s = dev.sim_interval_s
    dev.status = "online"; db.commit()
    manager.start(dev.id)
    return _status(dev)


@router.post("/{device_id}/stop")
async def stop(device_id: int, db: Session = Depends(get_db), _=Depends(ENGINEER)):
    dev = _device(db, device_id)
    await manager.stop(dev.id)
    dev.status = "offline"; db.commit()
    return _status(dev)


@router.put("/{device_id}/mode")
def set_mode(device_id: int, body: SimModeIn, db: Session = Depends(get_db), _=Depends(ENGINEER)):
    dev = _device(db, device_id)
    st = manager.get_state(dev.id)
    if body.values is not None:
        _check_kinds(dev, body.values)
        st.overrides = dict(body.values)
    elif body.mode != "fault_injection":
        st.overrides = {}
    st.progress = 0.0
    if body.interval_s:
        st.interval_s = dev.sim_interval_s = body.interval_s
    dev.sim_mode = body.mode
    db.commit()
    return _status(dev)


@router.post("/{device_id}/inject")
def inject(device_id: int, body: InjectIn, db: Session = Depends(get_db), _=Depends(ENGINEER)):
    """Force abnormal sensor values; they persist on every tick until reset."""
    dev = _device(db, device_id)
    _check_kinds(dev, body.values)
    manager.get_state(dev.id).overrides.update(body.values)
    dev.sim_mode = "fault_injection"; db.commit()
    return _status(dev)


@router.post("/{device_id}/reset")
def reset(device_id: int, db: Session = Depends(get_db), _=Depends(ENGINEER)):
    dev = _device(db, device_id)
    interval = manager.get_state(dev.id).interval_s
    manager.state[dev.id] = SimState(interval_s=interval)
    dev.sim_mode = "normal"; db.commit()
    return _status(dev)


@router.post("/{device_id}/scenario/{key}")
async def apply_scenario(device_id: int, key: str, db: Session = Depends(get_db), _=Depends(ENGINEER)):
    """Apply a demo scenario and run one tick immediately so the result is visible at once."""
    scenario = SCENARIOS.get(key)
    if not scenario:
        raise HTTPException(404, "Unknown scenario")
    dev = _device(db, device_id)
    manager.get_state(dev.id).overrides = dict(scenario["values"])
    manager.get_state(dev.id).progress = 0.0
    dev.sim_mode = "fault_injection"; db.commit()
    return await manager.tick_async(dev.id)


@router.post("/{device_id}/tick")
async def tick(device_id: int, db: Session = Depends(get_db), _=Depends(ENGINEER)):
    _device(db, device_id)
    return await manager.tick_async(device_id)
