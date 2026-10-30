"""WebSocket endpoint. Clients authenticate with a first message {"token": "<jwt>"} (keeps tokens out of URLs/logs)."""
import asyncio
import jwt
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.encoders import jsonable_encoder
from app.core.security import decode_token
from app.database.session import SessionLocal
from app.models import User

router = APIRouter(tags=["realtime"])


class Hub:
    def __init__(self) -> None:
        self.clients: set[WebSocket] = set()

    async def broadcast(self, message: dict) -> None:
        payload = jsonable_encoder(message)
        for ws in list(self.clients):
            try:
                await ws.send_json(payload)
            except Exception:
                self.clients.discard(ws)


hub = Hub()


async def on_tick(event: dict) -> None:
    """Simulator listener: push readings, and a separate event for each newly detected fault."""
    await hub.broadcast({"type": "tick", "device_id": event["device_id"], "device": event["device"],
                         "readings": event["readings"], "health_score": event["health_score"],
                         "overall_severity": event["diagnosis"]["overall_severity"]})
    for d in event["diagnosis"]["diagnoses"]:
        if d.get("new"):
            await hub.broadcast({"type": "fault", "id": d["id"], "device_id": event["device_id"],
                                 "device": event["device"], "fault": d["fault"], "severity": d["severity"],
                                 "confidence": d["confidence"]})


def _authenticate(token: str) -> bool:
    try:
        uid = int(decode_token(token)["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return False
    with SessionLocal() as db:
        return db.get(User, uid) is not None


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    try:
        first = await asyncio.wait_for(ws.receive_json(), timeout=5)
        if not (isinstance(first, dict) and isinstance(first.get("token"), str) and _authenticate(first["token"])):
            await ws.close(code=1008)
            return
        hub.clients.add(ws)
        await ws.send_json({"type": "connected"})
        while True:
            await ws.receive_text()  # ignore client messages; keeps the connection open
    except (WebSocketDisconnect, asyncio.TimeoutError, ValueError):
        pass
    finally:
        hub.clients.discard(ws)
