import os, tempfile
os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/test.db"
os.environ["SECRET_KEY"] = "test-secret-key-for-unit-tests-only-0123456789"
import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def auth(c, email, role_first=False):
    c.post("/api/auth/register", json={"email": email, "name": "T", "password": "password123"})
    tok = c.post("/api/auth/login", json={"email": email, "password": "password123"}).json()["access_token"]
    return {"Authorization": f"Bearer {tok}"}


def test_full_flow(client):
    admin = auth(client, "admin@x.io")          # first user -> admin
    viewer = auth(client, "viewer@x.io")        # later users -> viewer
    assert client.get("/api/devices").status_code == 401
    assert client.post("/api/devices", headers=viewer, json={"name": "M", "type": "Pump"}).status_code == 403

    dev = client.post("/api/devices", headers=admin, json={"name": "Motor-001", "type": "Industrial Motor"}).json()
    assert len(dev["sensors"]) == 7
    assert client.post("/api/devices", headers=admin, json={"name": "Motor-001", "type": "Pump"}).status_code == 409

    vals = {"temperature": 95, "vibration": 12, "current": 12, "voltage": 230, "humidity": 50, "pressure": 2, "rpm": 1450}
    assert client.post("/api/readings", headers=admin, json={"device_id": dev["id"], "values": vals}).status_code == 201
    res = client.post("/api/diagnosis/run", headers=admin, json={"device_id": dev["id"]}).json()
    top = res["diagnoses"][0]
    assert top["fault"] == "Motor Overheating" and top["severity"] == "critical" and top["new"]
    assert client.get(f"/api/devices/{dev['id']}", headers=viewer).json()["health_score"] == 30

    again = client.post("/api/diagnosis/run", headers=admin, json={"device_id": dev["id"]}).json()
    assert not again["diagnoses"][0]["new"]    # open fault is not duplicated

    fid = top["id"]
    r = client.patch(f"/api/faults/{fid}", headers=viewer, json={"status": "resolved"})
    assert r.status_code == 403
    r = client.patch(f"/api/faults/{fid}", headers=admin, json={"status": "resolved", "resolution_notes": "Fan replaced"})
    assert r.json()["status"] == "resolved"
    assert len(client.get("/api/faults?severity=critical", headers=viewer).json()) == 1


def test_knowledge_base_crud(client):
    admin = auth(client, "admin@x.io")
    assert len(client.get("/api/knowledge-base", headers=admin).json()) == 7
    body = {"fault_name": "Cooling System Failure", "description": "Coolant flow lost", "causes": ["Pump fault"],
            "rule": {"mode": "all", "severity": "high", "actions": ["Check coolant"],
                     "conditions": [{"sensor": "temperature", "op": ">", "threshold": 80},
                                    {"sensor": "pressure", "op": "<", "threshold": 1.2}]}}
    kb = client.post("/api/knowledge-base", headers=admin, json=body).json()
    assert client.get("/api/knowledge-base?q=cooling", headers=admin).json()[0]["id"] == kb["id"]
    bad = {**body, "rule": {**body["rule"], "conditions": [{"sensor": "nope", "op": ">", "threshold": 1}]}}
    assert client.put(f"/api/knowledge-base/{kb['id']}", headers=admin, json=bad).status_code == 422
    assert client.delete(f"/api/knowledge-base/{kb['id']}", headers=admin).status_code == 204
