import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from app.api import auth, devices, diagnosis, knowledge_base, simulator as simulator_api, \
    ws as ws_api, dashboard, alerts, reports, users, assistant
from app.core import config
from app.database.session import Base, SessionLocal, engine
from app.diagnosis.default_rules import DEFAULT_RULES
from app.models import FaultRule, KnowledgeBase

logging.basicConfig(level=logging.INFO, format="%(levelname)s:     %(name)s: %(message)s")  # makes INFO logs (e.g. reset links) visible
log = logging.getLogger("iot")


def seed_knowledge_base() -> None:
    with SessionLocal() as db:
        if db.scalar(select(func.count(KnowledgeBase.id))):
            return
        for r in DEFAULT_RULES:
            kb = KnowledgeBase(fault_name=r["fault"], description=r["description"], causes=r["causes"],
                               prevention=r["prevention"], symptoms=[f'{c["sensor"]} {c["op"]} {c["threshold"]}' for c in r["conditions"]])
            kb.rules.append(FaultRule(mode=r["mode"], severity=r["severity"], conditions=r["conditions"], actions=r["actions"]))
            db.add(kb)
        db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    if config.AUTO_CREATE_TABLES:
        Base.metadata.create_all(engine)  # dev/tests; production runs `alembic upgrade head` instead
    seed_knowledge_base()
    if ws_api.on_tick not in simulator_api.manager.listeners:
        simulator_api.manager.listeners.append(ws_api.on_tick)
    yield
    await simulator_api.manager.shutdown()


app = FastAPI(title="Knowledge-Driven IoT Fault Diagnosis Assistant", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])
for module in (auth, devices, diagnosis, knowledge_base, simulator_api, ws_api, dashboard, alerts, reports, users, assistant):
    app.include_router(module.router)


@app.exception_handler(SQLAlchemyError)
async def db_error(_: Request, exc: SQLAlchemyError):
    log.exception("Database error")
    return JSONResponse({"detail": "A database error occurred"}, status_code=500)


@app.exception_handler(Exception)
async def unhandled(_: Request, exc: Exception):
    log.exception("Unhandled error")
    return JSONResponse({"detail": "Internal server error"}, status_code=500)


@app.get("/api/health")
def health():
    return {"status": "ok"}
