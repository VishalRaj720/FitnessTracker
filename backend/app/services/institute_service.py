from collections import defaultdict

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.models import Institute, Squad, SquadMember, User, WorkoutSession
from app.schemas.common import InstituteBrief
from app.schemas.institute import (
    DepartmentRow,
    InstituteStatsOut,
    InstituteTrendPoint,
    InstituteWeekKpis,
    TopSquadRow,
)
from app.services.user_service import institute_brief
from app.utils.dates import as_utc, iso_week_label, last_n_week_labels, local_date, week_bounds

K_ANONYMITY = 5


def search(db: Session, q: str | None, limit: int = 20) -> list[InstituteBrief]:
    stmt = select(Institute).order_by(Institute.name).limit(limit)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(func.lower(Institute.name).like(like.lower()))
    return [institute_brief(i) for i in db.scalars(stmt).all()]  # type: ignore[misc]


def stats(db: Session, slug: str, weeks: int = 8) -> InstituteStatsOut:
    inst = db.scalar(select(Institute).where(Institute.slug == slug))
    if inst is None:
        raise AppError("not_found", "Institute not found", 404)

    users = db.scalars(select(User).where(User.institute_id == inst.id)).all()
    user_ids = {u.id for u in users}
    dept_of = {u.id: (u.department or "Unspecified") for u in users}

    labels = last_n_week_labels(weeks)
    range_start, _, _ = week_bounds(labels[0])
    this_start, this_end, this_label = week_bounds(labels[-1])

    sessions = (
        db.scalars(
            select(WorkoutSession).where(
                WorkoutSession.user_id.in_(user_ids),
                WorkoutSession.started_at >= range_start,
                WorkoutSession.verified.is_(True),
            )
        ).all()
        if user_ids
        else []
    )

    week_users: dict[str, set] = defaultdict(set)
    week_minutes: dict[str, int] = defaultdict(int)
    tw_users: set = set()
    tw_sessions = 0
    tw_minutes = 0
    tw_forms: list[float] = []
    dept_users: dict[str, set] = defaultdict(set)
    dept_minutes: dict[str, int] = defaultdict(int)

    for s in sessions:
        started = as_utc(s.started_at)
        label = iso_week_label(local_date(started))
        week_users[label].add(s.user_id)
        week_minutes[label] += s.verified_seconds // 60
        if this_start <= started < this_end:
            tw_users.add(s.user_id)
            tw_sessions += 1
            tw_minutes += s.verified_seconds // 60
            if s.avg_form_score is not None:
                tw_forms.append(s.avg_form_score)
            d = dept_of.get(s.user_id, "Unspecified")
            dept_users[d].add(s.user_id)
            dept_minutes[d] += s.verified_seconds // 60

    by_department = [
        DepartmentRow(department=d, active_students=len(u), verified_minutes=dept_minutes[d])
        for d, u in dept_users.items()
        if len(u) >= K_ANONYMITY
    ]
    by_department.sort(key=lambda r: -r.verified_minutes)

    squads = db.scalars(select(Squad).where(Squad.institute_id == inst.id)).all()
    top_squads: list[TopSquadRow] = []
    if squads:
        member_map: dict = defaultdict(set)
        for m in db.scalars(
            select(SquadMember).where(SquadMember.squad_id.in_([s.id for s in squads]))
        ).all():
            member_map[m.squad_id].add(m.user_id)
        minutes_by_user: dict = defaultdict(int)
        for s in sessions:
            if this_start <= as_utc(s.started_at) < this_end:
                minutes_by_user[s.user_id] += s.verified_seconds // 60
        for sq in squads:
            members = member_map.get(sq.id, set())
            top_squads.append(
                TopSquadRow(
                    name=sq.name,
                    members=len(members),
                    verified_minutes=sum(minutes_by_user[u] for u in members),
                )
            )
        top_squads.sort(key=lambda r: -r.verified_minutes)
        top_squads = top_squads[:5]

    return InstituteStatsOut(
        institute=institute_brief(inst),  # type: ignore[arg-type]
        week=this_label,
        this_week=InstituteWeekKpis(
            active_students=len(tw_users),
            verified_sessions=tw_sessions,
            verified_minutes=tw_minutes,
            avg_form_score=round(sum(tw_forms) / len(tw_forms), 1) if tw_forms else None,
        ),
        trend=[
            InstituteTrendPoint(
                week=w, active_students=len(week_users[w]), verified_minutes=week_minutes[w]
            )
            for w in labels
        ],
        by_department=by_department,
        top_squads=top_squads,
        total_students=len(users),
        k_anonymity_threshold=K_ANONYMITY,
    )
