.PHONY: dev api web seed demo test lint build

api:            ## run the API on :8000 (SQLite by default)
	cd backend && uv run uvicorn app.main:app --reload --port 8000

web:            ## run the PWA dev server on :5173
	cd web && npm run dev

seed:           ## seed exercises + institutes
	cd backend && uv run python -m seeds.seed

demo:           ## seed a demo campus (login demo@fitsathi.app / demo12345)
	cd backend && uv run python -m scripts.demo_data

test:           ## backend + frontend tests
	cd backend && uv run pytest -q
	cd web && npm test

lint:
	cd backend && uv run ruff check . && uv run ruff format --check .
	cd web && npm run typecheck && npm run lint

build:          ## production web build (PWA)
	cd web && npm run build
