from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Exercise
from app.schemas.common import ExerciseOut


def to_exercise_out(ex: Exercise) -> ExerciseOut:
    return ExerciseOut(
        id=ex.id,
        slug=ex.slug,
        name=ex.name,
        category=ex.category,
        difficulty=ex.difficulty,
        mode=ex.mode,
        cv_supported=ex.cv_supported,
        orientation=ex.orientation,
        default_reps=ex.default_reps,
        default_seconds=ex.default_seconds,
        instructions=ex.instructions,
        muscle_groups=list(ex.muscle_groups or []),
        cv_config_version=ex.cv_config_version,
    )


def list_exercises(db: Session) -> list[ExerciseOut]:
    rows = db.scalars(select(Exercise).order_by(Exercise.cv_supported.desc(), Exercise.id)).all()
    return [to_exercise_out(e) for e in rows]
