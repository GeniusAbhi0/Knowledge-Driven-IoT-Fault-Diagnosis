"""Pure sensor-value generation (no DB / asyncio) so it is easy to test."""
from __future__ import annotations
import random
from dataclasses import dataclass, field

MODES = ("normal", "warning", "fault_injection", "random", "custom")
# In warning mode readings drift toward (but stay just under) the default rule thresholds.
WARNING_TARGETS = {"temperature": 82.0, "vibration": 7.5, "current": 9.8, "humidity": 78.0}
WARNING_STEP = 0.1

SCENARIOS: dict[str, dict] = {
    "normal_motor": {"label": "Normal Motor", "values": {}, "expected": "System healthy"},
    "motor_overheating": {"label": "Motor Overheating", "values": {"temperature": 95, "current": 12, "vibration": 12},
                          "expected": "Critical Motor Overheating"},
    "bearing_failure": {"label": "Bearing Failure", "values": {"vibration": 14, "temperature": 75},
                        "expected": "Possible Bearing Failure"},
    "overcurrent": {"label": "Overcurrent", "values": {"current": 18, "temperature": 80},
                    "expected": "Motor Overload / Overcurrent"},
    "sensor_failure": {"label": "Sensor Failure", "values": {"temperature": 180, "humidity": 130},
                       "expected": "Possible Sensor Malfunction"},
}


@dataclass
class SimState:
    progress: float = 0.0                       # warning-mode drift, 0..1
    overrides: dict[str, float] = field(default_factory=dict)
    interval_s: int = 5


def generate(ranges: dict[str, tuple[float, float]], mode: str, state: SimState,
             rng: random.Random | None = None) -> dict[str, float]:
    """ranges: sensor kind -> (min_normal, max_normal). Returns one value per sensor kind."""
    if mode not in MODES:
        raise ValueError(f"Unknown simulation mode: {mode}")
    rng = rng or random.Random()
    values: dict[str, float] = {}
    if mode == "warning":
        state.progress = min(1.0, state.progress + WARNING_STEP)
    for kind, (lo, hi) in ranges.items():
        mid, span = (lo + hi) / 2, hi - lo
        v = min(hi, max(lo, rng.gauss(mid, span * 0.05)))
        if mode == "warning" and kind in WARNING_TARGETS:
            v += state.progress * (WARNING_TARGETS[kind] - v)
        elif mode == "random":
            v = max(0.0, rng.gauss(mid, span * 0.35))
        values[kind] = v
    if mode in ("fault_injection", "custom"):
        values.update({k: v for k, v in state.overrides.items() if k in values})
    return {k: round(v, 2) for k, v in values.items()}
