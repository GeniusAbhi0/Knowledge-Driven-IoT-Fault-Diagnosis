import os, tempfile
os.environ.setdefault("DATABASE_URL", f"sqlite:///{tempfile.mkdtemp()}/test.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-unit-tests-only-0123456789")
import pytest
from starlette.websockets import WebSocketDisconnect
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def token(c, email="admin@x.io"):
    c.post("/api/auth/register", json={"email": email, "name": "A", "password": "password123"})
    return c.post("/api/auth/login", json={"email": email, "password": "password123"}).json()["access_token"]


@pytest.fixture(scope="module")
def setup(client):
    h = {"Authorization": f"Bearer {token(client)}"}
    dev = client.post("/api/devices", headers=h, json={"name": "Live-Motor", "type": "Industrial Motor"}).json()
    return h, dev


def test_websocket_requires_token_and_streams_events(client, setup):
    h, dev = setup
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/ws") as ws:
            ws.send_json({"token": "garbage"})
            ws.receive_json()
    with client.websocket_connect("/ws") as ws:
        ws.send_json({"token": h["Authorization"].split()[1]})
        assert ws.receive_json()["type"] == "connected"
        client.post(f"/api/simulator/{dev['id']}/scenario/motor_overheating", headers=h)
        msgs = [ws.receive_json(), ws.receive_json()]
        assert msgs[0]["type"] == "tick" and msgs[0]["readings"]["temperature"] == 95
        assert msgs[1]["type"] == "fault" and msgs[1]["fault"] == "Motor Overheating" and msgs[1]["severity"] == "critical"


def test_dashboard_alerts_and_series(client, setup):
    h, dev = setup
    d = client.get("/api/dashboard", headers=h).json()
    assert d["total_devices"] >= 1 and d["critical_faults"] >= 1 and d["system_health"] < 100
    assert "Motor Overheating" in [x["fault"] for x in d["recent_diagnoses"]] and d["fault_frequency"][0]["count"] >= 1
    s = client.get(f"/api/dashboard/series/{dev['id']}", headers=h).json()
    assert set(s) >= {"temperature", "vibration", "current"} and s["temperature"]["points"][-1]["value"] == 95
    r = client.get("/api/alerts?unread=true", headers=h)
    assert int(r.headers["X-Total-Count"]) >= 1
    assert client.patch(f"/api/alerts/{r.json()[0]['id']}/read", headers=h).json()["is_read"]
    assert client.post("/api/alerts/read-all", headers=h).status_code == 200
    assert client.get("/api/alerts?unread=true", headers=h).json() == []


def test_history_filters_pagination_and_sort(client, setup):
    h, dev = setup
    r = client.get(f"/api/faults?device_id={dev['id']}&severity=critical&sort=severity&limit=1", headers=h)
    assert len(r.json()) == 1 and int(r.headers["X-Total-Count"]) >= 1
    assert client.get("/api/faults?date_from=2999-01-01T00:00:00Z", headers=h).json() == []
    assert len(client.get("/api/faults?date_from=2000-01-01T00:00:00Z", headers=h).json()) >= 1


def test_reports(client, setup):
    h, dev = setup
    csv_r = client.get("/api/reports/faults.csv", headers=h)
    assert csv_r.headers["content-type"].startswith("text/csv") and "Motor Overheating" in csv_r.text
    pdf = client.get("/api/reports/faults.pdf", headers=h)
    assert pdf.content.startswith(b"%PDF")
    fid = client.get("/api/faults", headers=h).json()[0]["id"]
    one = client.get(f"/api/reports/diagnosis/{fid}.pdf", headers=h)
    assert one.status_code == 200 and one.content.startswith(b"%PDF")
    assert client.get("/api/reports/diagnosis/99999.pdf", headers=h).status_code == 404
    assert client.get("/api/reports/faults.csv").status_code == 401


def test_user_management(client, setup):
    h, _ = setup
    vh = {"Authorization": f"Bearer {token(client, 'v2@x.io')}"}
    assert client.get("/api/users", headers=vh).status_code == 403
    users = client.get("/api/users", headers=h).json()
    vid = next(u["id"] for u in users if u["email"] == "v2@x.io")
    assert client.patch(f"/api/users/{vid}/role", headers=h, json={"role": "engineer"}).json()["role"] == "engineer"
    me = next(u["id"] for u in users if u["email"] == "admin@x.io")
    assert client.patch(f"/api/users/{me}/role", headers=h, json={"role": "viewer"}).status_code == 400
