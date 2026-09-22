from datetime import date

from pydantic import BaseModel


class StreakSummary(BaseModel):
    current: int
    longest: int
    last_workout_date: date | None


class ThisWeek(BaseModel):
    sessions: int
    verified_minutes: int
    days_done: int
    target_days: int


class WeekPoint(BaseModel):
    week: str
    verified_minutes: int
    sessions: int


class FormPoint(BaseModel):
    date: date
    form_score: float


class FormTrend(BaseModel):
    exercise_slug: str
    exercise_name: str
    points: list[FormPoint]


class Totals(BaseModel):
    sessions: int
    verified_minutes: int


class ProgressSummaryOut(BaseModel):
    streak: StreakSummary
    this_week: ThisWeek
    weekly: list[WeekPoint]
    form_trend: list[FormTrend]
    totals: Totals
