from typing import Literal

from pydantic import BaseModel

Goal = Literal["general", "fat_loss", "strength", "consistency"]
Level = Literal["beginner", "intermediate", "advanced"]
SessionMode = Literal["cv", "manual", "mixed"]
ExerciseMode = Literal["cv", "manual"]


class InstituteBrief(BaseModel):
    id: int
    name: str
    slug: str
    city: str | None = None
    state: str | None = None


class ExerciseOut(BaseModel):
    id: int
    slug: str
    name: str
    category: str
    difficulty: int
    mode: str
    cv_supported: bool
    orientation: str
    default_reps: int
    default_seconds: int
    instructions: str
    muscle_groups: list[str]
    cv_config_version: int
