import uuid
from datetime import date, datetime

from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import Goal, InstituteBrief, Level


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=80)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class ProfileIn(BaseModel):
    goal: Goal
    level: Level
    minutes_per_session: int = Field(ge=10, le=30)
    days_per_week: int = Field(ge=1, le=7)
    institute_id: int | None = None
    department: str | None = Field(default=None, max_length=80)
    hostel: str | None = Field(default=None, max_length=80)
    preferences: dict = Field(default_factory=dict)


class ProfileOut(BaseModel):
    goal: str
    level: str
    minutes_per_session: int
    days_per_week: int
    preferences: dict
    onboarding_completed_at: datetime | None


class StatsOut(BaseModel):
    current_streak: int
    longest_streak: int
    last_workout_date: date | None
    total_sessions: int
    total_verified_minutes: int


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    role: str
    institute: InstituteBrief | None
    department: str | None
    hostel: str | None
    profile: ProfileOut | None
    stats: StatsOut
    onboarding_completed: bool


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
