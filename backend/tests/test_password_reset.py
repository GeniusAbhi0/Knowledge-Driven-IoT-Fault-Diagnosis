import logging, os, tempfile
os.environ.setdefault("DATABASE_URL", f"sqlite:///{tempfile.mkdtemp()}/test.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-unit-tests-only-0123456789")
import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def issued_token(caplog) -> str | None:
    """The reset link is logged for the operator (no SMTP bundled); pull the token out of it."""
    for r in caplog.records:
        if "PASSWORD RESET" in r.getMessage():
            return r.getMessage().split("token=")[1]
    return None


def login(c, email, pw):
    return c.post("/api/auth/login", json={"email": email, "password": pw})


def test_reset_flow_is_single_use_and_does_not_leak_accounts(client, caplog):
    client.post("/api/auth/register", json={"email": "r@x.io", "name": "R", "password": "oldpassword1"})
    with caplog.at_level(logging.INFO, logger="iot.auth"):
        unknown = client.post("/api/auth/forgot-password", json={"email": "nobody@x.io"})
        assert issued_token(caplog) is None                      # no link issued for unknown emails
        known = client.post("/api/auth/forgot-password", json={"email": "R@x.io"})
    assert known.status_code == unknown.status_code and known.json() == unknown.json()
    token = issued_token(caplog)
    assert token

    assert client.post("/api/auth/reset-password", json={"token": token, "new_password": "short"}).status_code == 422
    assert client.post("/api/auth/reset-password", json={"token": token, "new_password": "newpassword1"}).status_code == 200
    assert login(client, "r@x.io", "oldpassword1").status_code == 401
    assert login(client, "r@x.io", "newpassword1").status_code == 200
    assert client.post("/api/auth/reset-password", json={"token": token, "new_password": "another-pass1"}).status_code == 400


def test_token_types_are_not_interchangeable(client, caplog):
    client.post("/api/auth/register", json={"email": "t@x.io", "name": "T", "password": "password123"})
    with caplog.at_level(logging.INFO, logger="iot.auth"):
        client.post("/api/auth/forgot-password", json={"email": "t@x.io"})
    reset_token = issued_token(caplog)
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {reset_token}"}).status_code == 401
    access = login(client, "t@x.io", "password123").json()["access_token"]
    assert client.post("/api/auth/reset-password", json={"token": access, "new_password": "hacked-pass1"}).status_code == 400
    assert client.post("/api/auth/reset-password", json={"token": "x" * 40, "new_password": "hacked-pass1"}).status_code == 400
