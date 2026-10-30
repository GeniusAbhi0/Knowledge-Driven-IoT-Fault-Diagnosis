"""Runs one asyncio task per simulated device; each tick stores readings and runs the diagnosis engine."""
from __future__ import annotations
import asyncio, logging
from typing import Awaitable, Callable
from app.api.devices import store_readings
from app.api.diagnosis import run_and_store
from app.database.session import SessionLocal
from app.models import Device
from app.simulator.generator import SimState, generate

log = logging.getLogger("iot.simulator")
Listener = Callable[[dict], Awaitable[None]]


class SimulatorManager:
    def __init__(self) -> None:
        self.state: dict[int, SimState] = {}
        self.tasks: dict[int, asyncio.Task] = {}
        self.listeners: list[Listener] = []  # Phase 6 registers the WebSocket broadcaster here

    def get_state(self, device_id: int) -> SimState:
        return self.state.setdefault(device_id, SimState())

    def tick(self, device_id: int) -> dict:
        """One synchronous simulation step. Raises LookupError if the device no longer exists."""
        with SessionLocal() as db:
            dev = db.get(Device, device_id)
            if dev is None:
                raise LookupError(device_id)
            ranges = {s.kind: (s.min_normal, s.max_normal) for s in dev.sensors}
            values = generate(ranges, dev.sim_mode, self.get_state(device_id))
            store_readings(db, dev, values)
            result = run_and_store(db, dev, values)
            return {"device_id": dev.id, "device": dev.name, "mode": dev.sim_mode, "readings": values,
                    "health_score": dev.health_score, "diagnosis": result}

    async def tick_async(self, device_id: int) -> dict:
        """Tick off the event loop, then notify listeners (e.g. the WebSocket hub)."""
        event = await asyncio.to_thread(self.tick, device_id)
        for cb in self.listeners:
            try:
                await cb(event)
            except Exception:
                log.exception("Simulator listener failed")
        return event

    async def _loop(self, device_id: int) -> None:
        while True:
            try:
                await self.tick_async(device_id)
            except LookupError:
                break
            except Exception:
                log.exception("Simulator tick failed for device %s", device_id)
            await asyncio.sleep(self.get_state(device_id).interval_s)
        self.tasks.pop(device_id, None)

    def is_running(self, device_id: int) -> bool:
        t = self.tasks.get(device_id)
        return bool(t and not t.done())

    def start(self, device_id: int) -> None:
        if not self.is_running(device_id):
            self.tasks[device_id] = asyncio.get_running_loop().create_task(self._loop(device_id))

    async def stop(self, device_id: int) -> None:
        task = self.tasks.pop(device_id, None)
        if task:
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)

    async def shutdown(self) -> None:
        for device_id in list(self.tasks):
            await self.stop(device_id)
