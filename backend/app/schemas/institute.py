from pydantic import BaseModel

from app.schemas.common import InstituteBrief


class InstituteWeekKpis(BaseModel):
    active_students: int
    verified_sessions: int
    verified_minutes: int
    avg_form_score: float | None


class InstituteTrendPoint(BaseModel):
    week: str
    active_students: int
    verified_minutes: int


class DepartmentRow(BaseModel):
    department: str
    active_students: int
    verified_minutes: int


class TopSquadRow(BaseModel):
    name: str
    members: int
    verified_minutes: int


class InstituteStatsOut(BaseModel):
    institute: InstituteBrief
    week: str
    this_week: InstituteWeekKpis
    trend: list[InstituteTrendPoint]
    by_department: list[DepartmentRow]
    top_squads: list[TopSquadRow]
    total_students: int
    k_anonymity_threshold: int
