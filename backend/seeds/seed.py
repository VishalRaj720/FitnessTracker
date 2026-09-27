"""Idempotent seeding of the exercise catalog, institute list and food catalog.

Run: uv run python -m seeds.seed   (also runs automatically on app start when AUTO_SEED=true)
"""

import csv
import json
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Exercise, Food, Institute

HERE = Path(__file__).parent


def seed_exercises(db: Session) -> int:
    data = json.loads((HERE / "exercises.json").read_text(encoding="utf-8"))
    existing = {e.slug: e for e in db.scalars(select(Exercise)).all()}
    added = 0
    for row in data:
        ex = existing.get(row["slug"])
        if ex is None:
            db.add(Exercise(**row))
            added += 1
        else:
            for k, v in row.items():
                setattr(ex, k, v)
    db.commit()
    return added


def seed_institutes(db: Session) -> int:
    existing = {i.slug for i in db.scalars(select(Institute)).all()}
    added = 0
    with (HERE / "institutes.csv").open(encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            if row["slug"] in existing:
                continue
            db.add(
                Institute(name=row["name"], slug=row["slug"], city=row["city"], state=row["state"])
            )
            added += 1
    db.commit()
    return added


def seed_foods(db: Session) -> int:
    """Upsert the food catalog by slug, like exercises: edits to foods.json reach old DBs."""
    data = json.loads((HERE / "foods.json").read_text(encoding="utf-8"))
    existing = {f.slug: f for f in db.scalars(select(Food)).all()}
    added = 0
    for row in data:
        food = existing.get(row["slug"])
        if food is None:
            db.add(Food(**row))
            added += 1
        else:
            for k, v in row.items():
                setattr(food, k, v)
    db.commit()
    return added


def seed_all(db: Session) -> dict[str, int]:
    return {
        "exercises": seed_exercises(db),
        "institutes": seed_institutes(db),
        "foods": seed_foods(db),
    }


if __name__ == "__main__":
    from app.core.database import Base, SessionLocal, engine

    Base.metadata.create_all(engine)
    with SessionLocal() as session:
        print(seed_all(session))
