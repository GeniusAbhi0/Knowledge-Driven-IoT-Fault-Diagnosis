# Knowledge-Driven IoT Fault Diagnosis Assistant

A full-stack, software-only platform that receives (simulated) IoT sensor data, evaluates it against a **knowledge base of IF/THEN rules**, and produces **explainable fault diagnoses** with severity, confidence, evidence, causes and corrective actions. No physical hardware is needed.

## Problem statement
Operators of industrial equipment face streams of sensor values and must decide quickly whether something is wrong, why, and what to do. Black-box alerts are hard to trust. This project shows every reading, threshold and rule behind each diagnosis.

## Features
- Real-time dashboard (WebSocket): device counts, active/critical/warning faults, system health, sensor charts, fault trends
- Virtual device simulator: Normal, Warning drift, Random, Custom and Fault-injection modes; 5 demo scenarios; manual sliders
- Rule-based engine (backend only): AND/OR conditions, weighted thresholds, severity, confidence, ranked multi-fault results
- Explainable diagnosis cards: what happened, evidence vs threshold, causes, ordered actions, prevention
- Fault history with search/filter/sort/pagination/date range, status workflow (detected, investigating, resolved, ignored) and resolution notes
- Knowledge base and rule management (admin), alerts, CSV/PDF reports (summary and per-diagnosis)
- JWT auth, bcrypt hashing, roles (admin/engineer/viewer), password reset
- Optional assistant: rule-based by default, LLM-enhanced when `AI_API_KEY` is set

## Architecture
```
User -> React frontend -> FastAPI backend -> Diagnosis engine -> Knowledge base -> Database
Virtual IoT simulator -> Sensor data -> Diagnosis engine -> Fault detection -> Recommendations -> Dashboard (WebSocket)
```
Stack: React 18 + TypeScript + Vite + Tailwind + Recharts + Framer Motion; FastAPI + SQLAlchemy 2 + Alembic + Pydantic; SQLite (dev) / PostgreSQL (Docker).

Layout: `backend/app/{api,models,diagnosis,simulator,core,database,websocket}`, `backend/tests`, `backend/migrations`, `frontend/src/{pages,components,contexts,hooks,services,types,utils}`, `docs/`.

## Database schema
`users`, `devices`, `sensors`, `sensor_readings`, `knowledge_base`, `fault_rules`, `diagnoses`, `diagnosis_evidence`, `alerts` with foreign keys, cascade deletes and indexes on `(device_id, ts)` and `(sensor_id, ts)`. Recommended actions are stored as JSON on `fault_rules`. See `docs/ARCHITECTURE.md`.

## Diagnosis methodology
Each rule has a mode (`all` = AND, `any` = OR), weighted conditions (`sensor op threshold`) and a severity. A rule fires when its mode is satisfied.
`confidence = 100 * (0.7 * weighted_coverage + 0.3 * mean_margin)`, where coverage is the matched weight fraction and margin is how far each matched reading is past its threshold (saturating at 25%). Results are ranked by severity, then confidence. Evidence sentences are generated from the actual values, so the explanation cannot drift from the decision.

## Installation
Backend (Python 3.11+):
```bash
cd backend && pip install -r requirements.txt
# optional: create backend/.env with SECRET_KEY=<long random string>, then add: --env-file .env
uvicorn app.main:app --reload          # http://localhost:8000/docs
```
Frontend (Node 20+):
```bash
cd frontend && npm install && npm run dev   # http://localhost:5173 (proxies /api and /ws to :8000)
```
**First account to register becomes the admin.** Create a device, open it, and press a demo scenario.

Docker: `cp .env.example .env`, set `POSTGRES_PASSWORD` and `SECRET_KEY`, then `docker compose up --build` and open http://localhost:8080. Containers run `alembic upgrade head` on start.

## Environment variables
| Variable | Purpose |
|---|---|
| `DATABASE_URL` | default `sqlite:///./iot.db` |
| `SECRET_KEY` | JWT signing key (random per start if unset) |
| `ACCESS_TOKEN_MINUTES`, `RESET_TOKEN_MINUTES` | token lifetimes |
| `CORS_ORIGINS` | comma-separated allowed origins |
| `AUTO_CREATE_TABLES` | `true` for dev/tests; `false` when using Alembic |
| `AI_API_KEY`, `AI_MODEL` | optional LLM assistant |
| `POSTGRES_PASSWORD` | Docker Compose database password |

## Tests
```bash
cd backend && pytest          # engine, API, simulator, WebSocket, reports, reset, assistant
cd frontend && npm test       # forms, validators, diagnosis card, rule editor
```

## API (all under `/api`, interactive docs at `/docs`)
`auth` (register, login, me, forgot/reset-password) | `devices` | `readings` | `simulator` (start/stop/mode/inject/reset/scenario/tick) | `diagnosis/run` | `faults` | `knowledge-base` | `alerts` | `reports` (faults.csv, faults.pdf, diagnosis/{id}.pdf) | `dashboard` | `users` | `assistant/ask` | WebSocket `/ws` (first message `{"token": "<jwt>"}`).

## Demo scenarios
| Scenario | Values | Result |
|---|---|---|
| Normal motor | none | System healthy |
| Motor overheating | temp 95, current 12, vibration 12 | Critical Motor Overheating |
| Bearing failure | vibration 14, temp 75 | Bearing Failure |
| Overcurrent | current 18, temp 80 | Overcurrent |
| Sensor failure | temp 180, humidity 130 | Sensor Failure |

The overheating rule needs temperature, current and vibration together, so the scenario sets all three. Overlapping rules can raise several faults at once; they are ranked.

## Screenshots
_Placeholders: `docs/screenshots/dashboard.png`, `device-detail.png`, `diagnosis.png`, `knowledge-base.png`._

## Known limitations
- Password-reset links are written to the server log (no SMTP bundled).
- No login rate limiting; the JWT is kept in `localStorage`, so a production deployment should add rate limiting and consider httpOnly cookies.
- Simulator loops live in memory and stop when the server restarts.
- Docker files are provided but were not run in the authoring environment.

## Future improvements
Per-rule enable toggles in the UI, multiple rules per fault, trend/anomaly detection, SMTP delivery, code-splitting the frontend bundle, end-to-end browser tests.
