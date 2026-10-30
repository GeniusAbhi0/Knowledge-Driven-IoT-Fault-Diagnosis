# Architecture (Phase 1)

User -> React+TS (Vite, Tailwind, Recharts) -> FastAPI (REST /api/*, WebSocket /ws)
     -> Diagnosis Engine (pure Python) <- Knowledge Base (fault_rules in DB)
     -> SQLAlchemy/Alembic -> SQLite (dev) / PostgreSQL (prod)

Simulator (asyncio task per running device) -> sensor_readings -> Diagnosis Engine
 -> diagnoses + diagnosis_evidence + alerts -> WebSocket broadcast -> Dashboard

## Tables
users(id, email, password_hash, role[admin|engineer|viewer], created_at)
devices(id, name, type, location, status, health_score, last_active, sim_mode, sim_interval_s)
sensors(id, device_id FK, kind, unit, min_normal, max_normal)
sensor_readings(id, device_id FK, sensor_id FK, value, ts)  -- index (device_id, ts)
knowledge_base(id, fault_name UNIQUE, description, symptoms, causes, prevention)
fault_rules(id, kb_id FK, mode[all|any], severity, conditions JSON, actions JSON, enabled)
diagnoses(id, device_id FK, kb_id FK, severity, confidence, status, summary, resolution_notes, detected_at)
diagnosis_evidence(id, diagnosis_id FK, sensor_kind, value, op, threshold, explanation)
(recommended actions live as JSON on fault_rules.actions; there is no separate recommendations table)
alerts(id, diagnosis_id FK, device_id FK, level, message, read, created_at)

## API groups
/api/auth /devices /sensors /readings /diagnosis /faults /knowledge-base /alerts /reports /dashboard

## Roadmap
All phases implemented; see README.
