from app.diagnosis.default_rules import DEFAULT_RULES
from app.diagnosis.engine import DiagnosisEngine, Rule

engine = DiagnosisEngine([Rule.from_dict(r) for r in DEFAULT_RULES])
NORMAL = dict(temperature=45, humidity=50, vibration=2.5, pressure=2.0, current=5, voltage=230, rpm=1450)


def test_normal_is_healthy():
    r = engine.diagnose("Motor-001", NORMAL)
    assert r.healthy and r.overall_severity == "normal"


def test_motor_overheating_critical():
    r = engine.diagnose("Motor-001", {**NORMAL, "temperature": 95, "vibration": 12, "current": 12})
    top = r.diagnoses[0]
    assert top.fault == "Motor Overheating" and top.severity == "critical"
    assert top.confidence >= 70 and len(top.evidence) == 3


def test_bearing_failure_without_overheating():
    r = engine.diagnose("Motor-001", {**NORMAL, "temperature": 75, "vibration": 14})
    assert [d.fault for d in r.diagnoses] == ["Bearing Failure"]


def test_overcurrent():
    r = engine.diagnose("Motor-001", {**NORMAL, "temperature": 80, "current": 18})
    assert r.diagnoses[0].fault == "Overcurrent"


def test_sensor_failure_or_rule():
    r = engine.diagnose("Motor-001", {**NORMAL, "humidity": 130})
    assert "Sensor Failure" in [d.fault for d in r.diagnoses]


def test_spec_example_ranks_by_severity():
    r = engine.diagnose("M", dict(temperature=92, humidity=82, vibration=14.5, pressure=2.1, current=12.8))
    faults = [d.fault for d in r.diagnoses]
    assert faults[0] == "Motor Overheating" and "High Humidity" in faults
