import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class StatusOut(BaseModel):
    enabled: bool
    provider: str


class RepKinematicsIn(BaseModel):
    """One completed repetition, as joint angles over time.

    Note what is absent: no image, no video, no landmark coordinates. Only angles and
    timings derived on the device ever leave it.
    """

    index: int = 0
    series: dict[str, list[float]] = Field(default_factory=dict)
    descent_ms: int = 0
    bottom_ms: int = 0
    ascent_ms: int = 0
    total_ms: int = 0


class CueIn(BaseModel):
    exercise_slug: str
    set_number: int = 1
    rep_count: int = 0
    mode: Literal["reps", "hold"] = "reps"
    reps: list[RepKinematicsIn] = Field(default_factory=list, max_length=5)
    glossary: dict[str, str] = Field(default_factory=dict)
    reference: dict = Field(default_factory=dict)
    notes: str = ""
    already_said: list[str] = Field(default_factory=list, max_length=6)
    recent_violations: dict[str, int] = Field(default_factory=dict)


class CueOut(BaseModel):
    observation: str | None = None
    cue: str | None = None
    urgency: int = 0


class SuggestedAction(BaseModel):
    kind: Literal["start_workout", "open_exercise", "open_tutorial", "open_progress"]
    label: str
    slug: str | None = None


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    client_reported: dict | None = None


class ChatOut(BaseModel):
    reply: str
    in_scope: bool = True
    suggested_actions: list[SuggestedAction] = Field(default_factory=list)


class MessageOut(BaseModel):
    id: uuid.UUID
    role: Literal["user", "coach"]
    content: str
    created_at: datetime


class ThreadOut(BaseModel):
    messages: list[MessageOut]


class DebriefOut(BaseModel):
    text: str | None
