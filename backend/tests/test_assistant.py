import os, tempfile
os.environ.setdefault("DATABASE_URL", f"sqlite:///{tempfile.mkdtemp()}/test.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-unit-tests-only-0123456789")
import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_assistant_explains_from_diagnosis_without_external_ai(client):
    client.post("/api/auth/register", json={"email": "admin@x.io", "name": "A", "password": "password123"})
    h = {"Authorization": "Bearer " + client.post("/api/auth/login", json={"email": "admin@x.io", "password": "password123"}).json()["access_token"]}
    dev = client.post("/api/devices", headers=h, json={"name": "Assist-Motor", "type": "Industrial Motor"}).json()
    assert client.post("/api/assistant/ask", json={"question": "hi there"}).status_code == 401
    r = client.post("/api/assistant/ask", headers=h, json={"question": "Why is Assist-Motor critical?"}).json()
    assert r["device"] == "Assist-Motor" and "no active faults" in r["answer"]
    client.post(f"/api/simulator/{dev['id']}/scenario/motor_overheating", headers=h)
    r = client.post("/api/assistant/ask", headers=h, json={"question": "Why is Assist-Motor critical? what should I do?"}).json()
    assert r["source"] == "rules" and "Motor Overheating" in r["answer"] and "temperature = 95" in r["answer"]
    assert "Recommended actions" in r["answer"] and "Possible causes" in r["answer"]
    assert client.post("/api/assistant/ask", headers=h, json={"question": "status?", "device_id": 9999}).status_code == 404
