# FitSathi — AI form coach + campus fitness squads

**Smart India Hackathon 2026 · Problem Statement 26196 (AICTE, MIC Student Innovation)**
*"Ideas that can boost fitness activities and assist in keeping fit"*

An **offline-first PWA** that turns a hostel room into a coached gym:

- 📷 **The camera counts your reps and corrects your form** — entirely **on-device**. Video frames never leave the phone; only reps, timings and scores reach the server.
- 🧠 **Tomorrow's plan adapts** to what the camera saw today, and tells you *why* in plain English ("+1 squats because your form has been consistent").
- 🏆 **Camera-verified minutes** drive squad and institute leaderboards that nobody can fake — you can't type "100 push-ups" into this app.
- 📊 A **campus dashboard** gives the institute a live Fit India participation report at ₹0 per student.

Design rationale, architecture decisions and roadmap: **[BLUEPRINT.md](BLUEPRINT.md)**.

---

## Table of contents

1. [What you need installed](#1-what-you-need-installed)
2. [Set up from this GitHub repo](#2-set-up-from-this-github-repo)
3. [Run it on your laptop](#3-run-it-on-your-laptop)
4. [Configuration reference](#4-configuration-reference)
5. [Using the app / demo walkthrough](#5-using-the-app--demo-walkthrough)
6. [Running it on a phone](#6-running-it-on-a-phone)
7. [Tests](#7-tests)
8. [Project layout](#8-project-layout)
9. [Troubleshooting](#9-troubleshooting)
10. [Deploying](#10-deploying)

---

## 1. What you need installed

| Tool | Version | Why | Install |
|---|---|---|---|
| **Python** | 3.12.x | Backend runtime (3.13 not yet pinned) | [python.org](https://www.python.org/downloads/) |
| **uv** | ≥ 0.4 | Python package/venv manager — replaces pip + venv | `pip install uv` or [docs](https://docs.astral.sh/uv/getting-started/installation/) |
| **Node.js** | ≥ 20.19 or ≥ 22 | Frontend build (Vite 8 requires this) | [nodejs.org](https://nodejs.org/) (LTS) |
| **Git** | any | Cloning | [git-scm.com](https://git-scm.com/) |
| **Google Chrome** | recent | The camera coach needs Chrome/Edge; Safari is untested | [chrome](https://www.google.com/chrome/) |

**No database installation is required.** The backend defaults to SQLite (a single file) so the project runs with zero setup. Postgres is supported and recommended for deployment — see [§4](#4-configuration-reference).

Optional: **Docker** (only if you prefer Postgres via `docker compose`), **Android Studio** (only if you want to build the APK).

Verify everything at once:

```bash
python --version && uv --version && node --version && git --version
```

---

## 2. Set up from this GitHub repo

### Step 1 — Clone

```bash
git clone https://github.com/VishalRaj720/FitnessTracker.git
```

```bash
cd FitnessTracker
```

> **Note on repo size (~30 MB):** the MediaPipe pose model and WASM runtime are committed to `web/public/` on purpose. Self-hosting them means the app works with **no internet at all** — which matters when the hackathon venue's Wi-Fi dies during your demo.

### Step 2 — Install backend dependencies

```bash
cd backend && cp .env.example .env && uv sync --extra dev
```

`uv sync` creates `backend/.venv` and installs from the lockfile. This takes ~30 seconds.

### Step 3 — Install frontend dependencies

```bash
cd ../web && cp .env.example .env && npm install
```

> On Windows PowerShell, use `copy .env.example .env` instead of `cp`.

### Step 4 — (Recommended) Load the demo campus

```bash
cd ../backend && uv run python -m scripts.demo_data
```

This creates 8 students at "Demo Institute of Technology", one squad, and ~3 weeks of realistic workout history — so Progress charts, leaderboards and the campus dashboard have something to show. Without it the app works fine, just empty.

**That's the whole setup.** No database to create, no migrations to run, no API keys to obtain.

---

## 3. Run it on your laptop

You need **two terminals**, both left running.

**Terminal 1 — the API:**

```bash
cd backend && uv run uvicorn app.main:app --reload --port 8000
```

On first start it creates `backend/fitsathi.db` and seeds 14 exercises + 26 institutes automatically. You should see `FitSathi API started`.

**Terminal 2 — the web app:**

```bash
cd web && npm run dev
```

Then open **http://localhost:5173 in Chrome**.

> ⚠️ **Use `localhost`, not your IP address.** Browsers only allow camera access on a "secure context" — HTTPS, or `localhost`. Opening `http://192.168.x.x:5173` will load the app but the camera will be blocked.

### What to click

| URL | What it is | Credentials |
|---|---|---|
| http://localhost:5173 | The student app | `demo@fitsathi.app` / `demo12345` |
| http://localhost:5173/campus/demo-institute | Institute dashboard (public, no login) | — |
| http://localhost:8000/docs | Interactive API documentation (Swagger) | — |
| http://localhost:5173/dev/record | CV calibration & fixture recorder (dev tool) | — |

Squad invite code for the demo squad: **`DEMO42`**

### Shortcut: the Makefile

If you have `make` (Git Bash on Windows includes it):

```bash
make api      # backend on :8000
make web      # frontend on :5173
make demo     # load demo campus data
make test     # run all tests
make build    # production PWA build
```

---

## 4. Configuration reference

### Backend — `backend/.env`

Copy `backend/.env.example` and edit. Every value has a working default, so an empty `.env` still runs.

| Variable | Default | What it does |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./fitsathi.db` | Database connection. For Postgres: `postgresql+psycopg://user:pass@localhost:5432/fitsathi` |
| `JWT_SECRET` | dev placeholder | Signing key for auth tokens. **Must be changed before deploying** — use 32+ random bytes |
| `JWT_EXPIRE_DAYS` | `7` | How long a login lasts |
| `CORS_ORIGINS` | `http://localhost:5173,…` | Comma-separated list of browser origins allowed to call the API. Add your deployed frontend URL here |
| `AUTO_SEED` | `true` | Seed exercises + institutes on startup. Set `false` in production after the first run |
| `ENVIRONMENT` | `development` | Label used in logs |
| `RATE_LIMIT_ENABLED` | `true` | Throttles `/auth/*` to 10 req/min. Set `false` only for load testing |

Generate a real secret:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

### Frontend — `web/.env`

| Variable | Default | What it does |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000` | Base URL of the API. **No trailing slash**, and no `/api/v1` — the client appends that |

Vite only exposes variables prefixed with `VITE_`, and they are **baked in at build time** — after changing this you must restart `npm run dev` or re-run `npm run build`.

### Switching to PostgreSQL

Either point `DATABASE_URL` at an existing Postgres instance, or let Docker provide one:

```bash
docker compose up -d db
```

then set in `backend/.env`:

```
DATABASE_URL=postgresql+psycopg://fitsathi:fitsathi@localhost:5432/fitsathi
```

Tables are created automatically on startup. To also run the API in Docker, use `docker compose up` (API on :8000, no local Python needed).

### In-app settings

Under **Profile → Settings** each user can toggle voice cues, Hindi cues, and camera mirroring. Under **Profile → Edit** they can change goal, level, session length, days/week and institute — all of which feed the plan generator.

---

## 5. Using the app / demo walkthrough

1. **Log in** as `demo@fitsathi.app` / `demo12345` (or register — onboarding takes 3 steps).
2. On **Home**, tap **"Why this plan?"** — the recommender explains every decision it made.
3. Tap **Start workout** → choose **Camera coach** → **Start workout**.
4. The warm-up is a timer. Tap **Next exercise** to reach the squat.
5. **Stand side-on to the laptop, about 2 m back**, full body in frame. The three checks turn green, then a 3-2-1 countdown starts.
6. Do squats. The counter ticks on real reps. **Deliberately do a shallow one** — it is *not counted* and the coach says "Go lower". Lean forward → "Chest up".
7. **Finish workout** → summary with reps, form score, verified minutes, streak, and an RPE picker.
8. Check **Progress**, **Squad** (verified-minutes leaderboard) and the **campus dashboard**.

No camera, bad lighting, or testing on a machine without a webcam? Pick **Manual** mode (or the **"Use manual mode"** button) — you tap to count. Manual minutes deliberately **never** count as verified.

The full 8-minute judging script, including fallbacks for things that break live, is in **[docs/demo-script.md](docs/demo-script.md)**.

### Camera-tracked exercises

| Exercise | Camera angle | Counting signal | Form corrections |
|---|---|---|---|
| Squat | side | knee angle | Go lower · Chest up · Slow down · Knees out |
| Jumping jack | front | feet spread | Jump wider · Arms all the way up |
| Alternating lunge | side | front knee angle | Lower your back knee · Stay upright |
| Push-up | side, phone on floor | elbow angle | Go lower · Keep your body straight |
| Plank | side, phone on floor | body-line hold timer | Hips up · Lower your hips |

Nine more exercises run in timer/manual mode. Adding a new camera-tracked exercise is **one file** — see [docs/cv-exercise-authoring.md](docs/cv-exercise-authoring.md).

---

## 6. Running it on a phone

Phone browsers refuse camera access over plain `http://`, so `http://<laptop-ip>:5173` will not work for the coach. Three options:

**A. Quick tunnel (easiest for testing)**

```bash
npx localtunnel --port 5173
```

Open the `https://…` URL it prints, on your phone. You must also expose the API (`npx localtunnel --port 8000`) and set that URL as `VITE_API_URL`.

**B. Deploy it** — see [§10](#10-deploying). This is the reliable option for demo day.

**C. Build the Android APK** (needs Android Studio):

```bash
cd web && npm run build && npx cap add android && npx cap sync && npx cap open android
```

Config lives in `web/capacitor.config.ts`; add the `CAMERA` permission to `AndroidManifest.xml`.

Once loaded over HTTPS, tap your browser's **"Add to Home Screen"** — the app installs as a PWA, caches the pose model, and works **fully offline**. Workouts done offline are queued in IndexedDB and sync automatically when connectivity returns.

---

## 7. Tests

```bash
cd backend && uv run pytest -q
```

23 tests: auth, onboarding, plan generation and idempotency, session saving/idempotency, verified-minutes calculation, streak edge cases, squads, leaderboard week boundaries, institute aggregates with k-anonymity, and the recommender rules.

```bash
cd web && npm test
```

CV engine tests: rep counting on synthetic joint-angle trajectories (clean reps, shallow reps, jitter, impossibly fast reps, occlusion), plank hold tolerance, plus any recorded landmark fixtures in `web/tests/fixtures/`.

Lint and typecheck:

```bash
cd web && npm run typecheck && npm run lint
```

### Recording CV test fixtures

Open http://localhost:5173/dev/record in Chrome, pick an exercise, hit **Record**, do N reps, **Stop**, **Download JSON** (enter your true rep count). Drop the file into `web/tests/fixtures/` and `npm test` will assert that exact count forever after. This is how you calibrate thresholds against real bodies.

---

## 8. Project layout

```
FitnessTracker/
├── backend/                  FastAPI + SQLAlchemy 2.0 + JWT
│   ├── app/
│   │   ├── api/v1/           HTTP routes (thin — parse, call a service, return)
│   │   ├── services/         business logic; the only layer touching the DB
│   │   ├── recommender/      rules_v1 plan generator (pure Python, no ORM imports)
│   │   ├── models/           SQLAlchemy tables      schemas/  Pydantic DTOs
│   │   └── core/             config, database, security, logging, errors
│   ├── seeds/                exercise catalog (JSON) + institute list (CSV)
│   ├── scripts/demo_data.py  generates the demo campus
│   └── tests/
├── web/                      React 19 + Vite + TypeScript PWA
│   ├── public/models/        MediaPipe pose models (self-hosted)
│   ├── public/wasm/          MediaPipe WASM runtime (self-hosted)
│   └── src/
│       ├── cv/               ⭐ the CV engine — zero React imports
│       │   ├── pose/         MediaPipe wrapper       filters/   One-Euro + visibility gate
│       │   ├── geometry/     angles, orientation     engine/    FSM, hold timer, rules, cues
│       │   └── exercises/    one declarative file per exercise
│       ├── features/         one folder per feature (auth, home, workout, squad, …)
│       ├── components/       UI kit + app shell      lib/       api client, formatting
│       └── types/api.ts      wire DTOs mirroring the backend schemas
├── docs/                     demo script, CV authoring guide
├── BLUEPRINT.md              full product + architecture design document
└── docker-compose.yml        Postgres + API (optional)
```

**Architecture in one line:** the browser does all the computer vision (MediaPipe → smoothing → a hysteresis state machine → form rules → spoken cues); the server only stores derived numbers and decides what you should do tomorrow.

---

## 9. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| **"Camera permission denied"** | Allow camera in Chrome's address-bar icon. Verify you are on `localhost`, not an IP. Chrome → Settings → Privacy → Site settings → Camera to reset. |
| Camera works but **no skeleton appears** | The pose model failed to load. Check the browser console; confirm `web/public/models/*.task` exist (they ship with the repo). |
| **Counter doesn't move** | Check the three green setup indicators. Most common cause: not fully in frame, or wrong angle (squat/lunge/push-up need **side-on**, jumping jacks need **front-on**). |
| **Counting is inaccurate for you** | Thresholds ship un-calibrated. Record fixtures at `/dev/record` and tune the numbers in `web/src/cv/exercises/<name>.ts`. See [docs/cv-exercise-authoring.md](docs/cv-exercise-authoring.md). |
| **Network error / nothing loads** | Terminal 1 (backend) isn't running, or `VITE_API_URL` is wrong. Test with `curl http://localhost:8000/health`. |
| **CORS error in console** | Add your frontend origin to `CORS_ORIGINS` in `backend/.env` and restart the API. |
| **Port 8000 or 5173 already in use** | `uvicorn … --port 8001` / `npm run dev -- --port 5174`, and update `VITE_API_URL` if you moved the API. |
| **`uv: command not found`** | `pip install uv`, then reopen your terminal. |
| **Node/Vite crashes on start** | Node too old. `node --version` must be ≥ 20.19 or ≥ 22. |
| **Want a clean slate** | Stop the API, `rm backend/fitsathi.db`, restart, then `uv run python -m scripts.demo_data`. |
| **No voice cues** | Windows/Linux may lack an `en-IN` voice; it falls back to any English voice. Toggle in Profile → Settings. |

---

## 10. Deploying

| Piece | Where | How |
|---|---|---|
| Web app | Vercel / Cloudflare Pages / Netlify | Static build. Root `web`, build `npm run build`, output `dist`. Set `VITE_API_URL` to the deployed API URL |
| API + database | Railway / Render / Fly.io | `backend/Dockerfile` is ready. Set `DATABASE_URL` (Postgres), `JWT_SECRET`, `CORS_ORIGINS` (your frontend URL), `AUTO_SEED=true` for the first deploy |
| Android APK | Built locally | Capacitor — see [§6](#6-running-it-on-a-phone) |

**Deployment checklist:** generate a real `JWT_SECRET` · switch `DATABASE_URL` to Postgres · put the frontend origin in `CORS_ORIGINS` · set `ENVIRONMENT=production` · set `AUTO_SEED=false` after the first successful boot.

CI (lint, typecheck, tests, build on every push) is configured in `.github/workflows/`.

---

## Privacy

Pose detection runs **entirely in the browser on the user's own device**. No image or video frame is ever transmitted or stored — the API receives only rep counts, durations, form scores and flags. The campus dashboard shows aggregates only, and hides any department with fewer than 5 active students (k-anonymity).

---

Built for SIH 2026 · PS 26196 · AICTE MIC Student Innovation
