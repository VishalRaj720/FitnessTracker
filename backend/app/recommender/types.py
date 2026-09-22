"""Plain data types for the recommender. This package must never import SQLAlchemy or FastAPI."""

from dataclasses import dataclass, field
from datetime import date


@dataclass(frozen=True)
class ExerciseInfo:
    id: int
    slug: str
    name: str
    category: str  # legs|push|core|cardio|mobility
    difficulty: int  # 1..3
    mode: str  # reps|hold
    cv_supported: bool
    default_reps: int
    default_seconds: int


@dataclass(frozen=True)
class ProfileInput:
    goal: str  # general|fat_loss|strength|consistency
    level: str  # beginner|intermediate|advanced
    minutes_per_session: int
    days_per_week: int


@dataclass(frozen=True)
class SessionSummary:
    day: date
    completed_ratio: float  # 0..1 (achieved / target across exercises)
    avg_form: float | None
    rpe: int | None
    exercise_forms: dict[str, float] = field(default_factory=dict)  # slug -> form score
    exercise_slugs: tuple[str, ...] = ()


@dataclass(frozen=True)
class HistoryInput:
    sessions: tuple[SessionSummary, ...]  # newest first, last 14 days


@dataclass
class PlanItemOutput:
    exercise_id: int
    slug: str
    position: int
    target_sets: int
    target_reps: int
    target_seconds: int
    rest_seconds: int
    focus_cue: str | None = None


@dataclass
class PlanOutput:
    items: list[PlanItemOutput]
    estimated_minutes: int
    rationale: list[dict]
    generated_by: str = "rules_v1"
