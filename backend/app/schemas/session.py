import uuid
from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import ExerciseMode, ExerciseOut, SessionMode


class SessionExerciseIn(BaseModel):
    exercise_id: int
    plan_item_id: uuid.UUID | None = None
    position: int = Field(ge=0, le=50)
    mode: ExerciseMode
    sets_completed: int = Field(ge=0, le=20)
    reps_completed: int = Field(default=0, ge=0, le=500)
    seconds_held: int = Field(default=0, ge=0, le=3600)
    target_reps: int = Field(default=0, ge=0, le=500)
    target_seconds: int = Field(default=0, ge=0, le=3600)
    duration_seconds: int = Field(ge=0, le=3600)
    form_score: float | None = Field(default=None, ge=0, le=100)
    mean_visibility: float | None = Field(default=None, ge=0, le=1)
    form_flags: dict[str, int] = Field(default_factory=dict)
    rep_events: list[list[float]] = Field(default_factory=list, max_length=500)


class SessionIn(BaseModel):
    client_session_id: uuid.UUID
    plan_id: uuid.UUID | None = None
    mode: SessionMode
    started_at: datetime
    ended_at: datetime
    device_info: dict = Field(default_factory=dict)
    exercises: list[SessionExerciseIn] = Field(min_length=1, max_length=30)

    @model_validator(mode="after")
    def _check_times(self):
        if self.ended_at <= self.started_at:
            raise ValueError("ended_at must be after started_at")
        if (self.ended_at - self.started_at).total_seconds() > 3 * 3600:
            raise ValueError("session longer than 3 hours")
        return self


class SessionRpeIn(BaseModel):
    rpe: int = Field(ge=1, le=5)


class SessionExerciseOut(BaseModel):
    id: uuid.UUID
    exercise: ExerciseOut
    position: int
    mode: str
    sets_completed: int
    reps_completed: int
    seconds_held: int
    target_reps: int
    target_seconds: int
    duration_seconds: int
    form_score: float | None
    verified: bool
    form_flags: dict[str, int]


class SessionOut(BaseModel):
    id: uuid.UUID
    plan_id: uuid.UUID | None
    started_at: datetime
    ended_at: datetime
    duration_seconds: int
    mode: str
    total_reps: int
    avg_form_score: float | None
    verified_seconds: int
    verified: bool
    rpe: int | None
    exercises: list[SessionExerciseOut]


class StreakOut(BaseModel):
    current: int
    longest: int
    changed: bool


class SessionCreateOut(SessionOut):
    streak: StreakOut
    plan_status: str | None
    duplicate: bool = False


class SessionListOut(BaseModel):
    items: list[SessionOut]
    next_cursor: str | None
