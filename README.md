# FitSathi — AI form coach + campus fitness squads

**SIH 2026 · PS 26196 (AICTE MIC) · "Ideas that can boost fitness activities and assist in keeping fit"**

An offline-first PWA that turns a hostel room into a coached gym: the phone camera counts reps and corrects form **on-device** (video never leaves the phone), a rules engine adapts tomorrow's plan from what the camera saw, and camera-**verified** minutes feed squad and institute leaderboards nobody can fake.

Full design rationale, architecture and roadmap: [BLUEPRINT.md](BLUEPRINT.md).

## Run it in 3 minutes

Prereqs: Python 3.12 + [uv](https://docs.astral.sh/uv/), Node 22. No database setup needed (SQLite by default).

```bash
# 1. API (seeds exercises + institutes on first start)
cd backend && cp .env.example .env && uv sync --extra dev
uv run python -m scripts.demo_data      # optional: demo campus with 3 weeks of data
uv run uvicorn app.main:app --reload --port 8000
```

```bash
# 2. Web app
cd web && cp .env.example .env && npm install
npm run dev                             # http://localhost:5173
```

Open http://localhost:5173 in **Chrome** (camera needs a secure context — `localhost` counts).

- Demo login: `demo@fitsathi.app` / `demo12345` (squad invite code `DEMO42`)
- Campus dashboard: http://localhost:5173/campus/demo-institute
- API docs: http://localhost:8000/docs
- CV calibration tool: http://localhost:5173/dev/record

**On a phone:** run `npm run dev -- --host`, then open `http://<laptop-ip>:5173` — but phone browsers block the camera on plain `http://`. Either deploy to any HTTPS host (Vercel) or expose localhost with `npx localtunnel --port 5173` / ngrok for a quick test.

### Postgres instead of SQLite

Set `DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/fitsathi` in `backend/.env`, or just `docker compose up` (Postgres + API on :8000).

## What's in the box

| Path | What |
|---|---|
| `backend/` | FastAPI · SQLAlchemy 2.0 · JWT auth · `recommender/` (rules_v1, pure Python) · sessions with idempotent save, verified calc, streaks · squads · institute aggregates (k-anonymity ≥ 5) · 23 pytest tests |
| `web/` | React 19 + Vite PWA · `src/cv/` framework-free engine (MediaPipe Pose → One-Euro filter → hysteresis FSM / hold timer → form rules → feedback arbiter → TTS) · 5 declarative exercise definitions · offline session queue · Recharts progress + campus dashboard · Vitest CV tests |
| `docs/` | Demo script, how to add an exercise |
| `docker-compose.yml` | Postgres + API for local/offline demo |

## Camera-tracked exercises (MVP)

| Exercise | View | Counts | Corrects |
|---|---|---|---|
| Squat | side | knee angle FSM | depth ("Go lower"), chest up, tempo, knees out (front) |
| Jumping jack | front | feet spread FSM | jump wider, arms all the way up |
| Alternating lunge | side | min knee angle | depth, stay upright, tempo |
| Push-up | side (phone on floor) | elbow angle | depth, body line (hip sag), tempo |
| Plank | side | hold timer within body-line tolerance | hips up / hips down |

Adding an exercise = one file in `web/src/cv/exercises/` + one line in the registry. See [docs/cv-exercise-authoring.md](docs/cv-exercise-authoring.md).

## Tests

```bash
cd backend && uv run pytest -q          # 23 tests: auth, plans, sessions, streaks, squads, institutes, recommender
cd web && npm test                      # CV engine: synthetic sequences + recorded fixtures (tests/fixtures/*.json)
```

## Deploy

- Web → Vercel/Cloudflare Pages (static `web/dist`; set `VITE_API_URL`).
- API + Postgres → Railway (Dockerfile in `backend/`; set `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`).
- Android APK → `cd web && npm run build && npx cap add android && npx cap sync` (Capacitor; needs Android Studio).
