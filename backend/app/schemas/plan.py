import uuid
from datetime import date

from pydantic import BaseModel

from app.schemas.common import ExerciseOut


class PlanItemOut(BaseModel):
    id: uuid.UUID
    position: int
    exercise: ExerciseOut
    target_sets: int
    target_reps: int
    target_seconds: int
    rest_seconds: int
    focus_cue: str | None


class PlanOut(BaseModel):
    id: uuid.UUID
    plan_date: date
    status: str
    generated_by: str
    estimated_minutes: int
    items: list[PlanItemOut]
    rationale: list[dict]
