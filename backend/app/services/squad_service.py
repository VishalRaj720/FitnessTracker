import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.models import Squad, SquadMember, User, WorkoutSession
from app.schemas.squad import LeaderboardOut, LeaderboardRow, SquadOut
from app.services.user_service import institute_brief
from app.utils.codes import invite_code
from app.utils.dates import week_bounds


def to_squad_out(squad: Squad) -> SquadOut:
    return SquadOut(
        id=squad.id,
        name=squad.name,
        invite_code=squad.invite_code,
        member_count=len(squad.members),
        institute=institute_brief(squad.institute),
    )


def _membership(db: Session, user: User) -> SquadMember | None:
    return db.scalar(select(SquadMember).where(SquadMember.user_id == user.id))


def my_squad(db: Session, user: User) -> SquadOut | None:
    m = _membership(db, user)
    return to_squad_out(m.squad) if m else None


def create_squad(db: Session, user: User, name: str) -> SquadOut:
    if _membership(db, user):
        raise AppError("already_in_squad", "Leave your current squad first", 409)
    code = invite_code()
    while db.scalar(select(Squad.id).where(Squad.invite_code == code)):
        code = invite_code()
    squad = Squad(
        name=name.strip(), invite_code=code, institute_id=user.institute_id, created_by=user.id
    )
    squad.members.append(SquadMember(user_id=user.id))
    db.add(squad)
    db.commit()
    db.refresh(squad)
    return to_squad_out(squad)


def join_squad(db: Session, user: User, code: str) -> SquadOut:
    squad = db.scalar(select(Squad).where(Squad.invite_code == code.strip().upper()))
    if squad is None:
        raise AppError("invalid_invite", "No squad with that invite code", 404)
    m = _membership(db, user)
    if m:
        if m.squad_id == squad.id:
            return to_squad_out(squad)
        raise AppError("already_in_squad", "Leave your current squad first", 409)
    if len(squad.members) >= 12:
        raise AppError("squad_full", "This squad is full (12 members)", 409)
    squad.members.append(SquadMember(user_id=user.id))
    db.commit()
    db.refresh(squad)
    return to_squad_out(squad)


def leave_squad(db: Session, user: User) -> None:
    m = _membership(db, user)
    if m is None:
        return
    squad = m.squad
    db.delete(m)
    db.flush()
    if not db.scalar(select(SquadMember.user_id).where(SquadMember.squad_id == squad.id)):
        db.delete(squad)
    db.commit()


def leaderboard(db: Session, user: User, squad_id: uuid.UUID, week: str | None) -> LeaderboardOut:
    squad = db.get(Squad, squad_id)
    if squad is None:
        raise AppError("not_found", "Squad not found", 404)
    member_ids = {m.user_id for m in squad.members}
    if user.id not in member_ids:
        raise AppError("forbidden", "You are not a member of this squad", 403)

    try:
        start, end, label = week_bounds(week)
    except (ValueError, AttributeError) as e:
        raise AppError("bad_week", "Week must look like 2026-W39", 422) from e

    sessions = db.scalars(
        select(WorkoutSession).where(
            WorkoutSession.user_id.in_(member_ids),
            WorkoutSession.started_at >= start,
            WorkoutSession.started_at < end,
        )
    ).all()

    agg: dict[uuid.UUID, dict] = {
        m.user_id: {"name": m.user.name, "seconds": 0, "sessions": 0, "form": [], "verified": 0}
        for m in squad.members
    }
    for s in sessions:
        a = agg[s.user_id]
        a["sessions"] += 1
        a["seconds"] += s.verified_seconds
        if s.avg_form_score is not None:
            a["form"].append(s.avg_form_score)

    ordered = sorted(
        agg.items(), key=lambda kv: (-kv[1]["seconds"], -kv[1]["sessions"], kv[1]["name"])
    )
    rows = [
        LeaderboardRow(
            rank=i + 1,
            user_id=uid,
            name=a["name"],
            verified_minutes=a["seconds"] // 60,
            sessions=a["sessions"],
            avg_form=round(sum(a["form"]) / len(a["form"]), 1) if a["form"] else None,
            is_me=(uid == user.id),
        )
        for i, (uid, a) in enumerate(ordered)
    ]
    return LeaderboardOut(squad=to_squad_out(squad), week=label, rows=rows)
