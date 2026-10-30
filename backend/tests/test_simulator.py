import os, random, tempfile, time
os.environ.setdefault("DATABASE_URL", f"sqlite:///{tempfile.mkdtemp()}/test.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-unit-tests-only-0123456789")
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.simulator.generator import SimState, generate

RANGES = {"temperature": (20, 70), "vibration": (0, 6), "current": (2, 9), "humidity": (30, 70)}


def test_normal_stays_in_range():
    rng, st = random.Random(1), SimState()
    for _ in range(200):
        for k, v in generate(RANGES, "normal", st, rng).items():
            assert RANGES[k][0] <= v <= RANGES[k][1]


def test_warning_approaches_but_stays_below_thresholds():
    rng, st = random.Random(2), SimState()
    for _ in range(30):
        v = generate(RANGES, "warning", st, rng)
    assert st.progress == 1.0 and 75 < v["temperature"] < 85 and 6.5 < v["vibration"] < 8 and v["current"] < 10


def test_injection_and_custom_overrides():
    st = SimState(overrides={"temperature": 99.0})
    for mode in ("fault_injection", "custom"):
        assert generate(RANGES, mode, st)["temperature"] == 99.0
    assert generate(RANGES, "normal", st)["temperature"] != 99.0


def test_unknown_mode_rejected():
    with pytest.raises(ValueError):
        generate(RANGES, "bogus", SimState())


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def login(c):
    c.post("/api/auth/register", json={"email": "admin@x.io", "name": "A", "password": "password123"})
    t = c.post("/api/auth/login", json={"email": "admin@x.io", "password": "password123"}).json()["access_token"]
    return {"Authorization": f"Bearer {t}"}


def test_demo_scenarios_produce_expected_diagnosis(client):
    h = login(client)
    dev = client.post("/api/devices", headers=h, json={"name": "Sim-Motor", "type": "Industrial Motor"}).json()
    expected = {"normal_motor": None, "motor_overheating": "Motor Overheating", "bearing_failure": "Bearing Failure",
                "overcurrent": "Overcurrent", "sensor_failure": "Sensor Failure"}
    for key, fault in expected.items():
        client.post(f"/api/simulator/{dev['id']}/reset", headers=h)
        # resolve open faults so each scenario is evaluated independently
        for f in client.get(f"/api/faults?device_id={dev['id']}&limit=200", headers=h).json():
            client.patch(f"/api/faults/{f['id']}", headers=h, json={"status": "resolved"})
        res = client.post(f"/api/simulator/{dev['id']}/scenario/{key}", headers=h).json()
        found = [d["fault"] for d in res["diagnosis"]["diagnoses"]]
        if fault is None:
            assert res["diagnosis"]["healthy"] and res["health_score"] == 100
        else:
            assert found[0] == fault, (key, found)
    assert client.post(f"/api/simulator/{dev['id']}/scenario/nope", headers=h).status_code == 404


def test_inject_validation_and_background_loop(client):
    h = login(client)
    dev = client.post("/api/devices", headers=h, json={"name": "Sim-Pump", "type": "Pump", "sim_interval_s": 1}).json()
    assert client.post(f"/api/simulator/{dev['id']}/inject", headers=h, json={"values": {"bogus": 1}}).status_code == 422
    client.post(f"/api/simulator/{dev['id']}/inject", headers=h, json={"values": {"temperature": 95, "current": 12, "vibration": 12}})
    assert client.post(f"/api/simulator/{dev['id']}/start", headers=h).json()["running"]
    time.sleep(1.6)
    assert client.post(f"/api/simulator/{dev['id']}/stop", headers=h).json()["running"] is False
    assert len(client.get(f"/api/readings/{dev['id']}?limit=500", headers=h).json()) >= 7
    faults = client.get(f"/api/faults?device_id={dev['id']}", headers=h).json()
    assert [f["fault"] for f in faults].count("Motor Overheating") == 1   # deduplicated across ticks
    assert client.get(f"/api/devices/{dev['id']}", headers=h).json()["status"] == "offline"
