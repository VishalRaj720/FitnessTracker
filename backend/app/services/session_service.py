"""Session persistence: idempotent save, verified calculation, streak + totals."""

import uuid
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.models import Exercise, SessionExercise, User, WorkoutPlan, WorkoutSession
from app.schemas.session import (
    SessionCreateOut,
    SessionExerciseIn,
    SessionExerciseOut,
    SessionIn,
    SessionListOut,
    SessionOut,
    StreakOut,
)
from app.services.exercise_service import to_exercise_out
from app.services.user_service import ensure_stats
from app.utils.dates import as_utc, local_date

VERIFIED_MIN_VISIBILITY = 0.6
VERIFIED_MIN_COMPLETION = 0.6
VERIFIED_SESSION_SHARE = 0.5
MAX_REPS_PER_SECOND = 3.0


def is_exercise_verified(ex: SessionExerciseIn) -> bool:
    if ex.mode != "cv":
        return False
    if ex.mean_visibility is None or ex.mean_visibility < VERIFIED_MIN_VISIBILITY:
        return False
    if ex.duration_seconds > 0 and ex.reps_completed / ex.duration_seconds > MAX_REPS_PER_SECOND:
        return False
    if ex.target_reps > 0:
        return ex.reps_completed >= VERIFIED_MIN_COMPLETION * ex.target_reps
    if ex.target_seconds > 0:
        return ex.seconds_held >= VERIFIED_MIN_COMPLETION * ex.target_seconds
    return ex.reps_completed > 0 or ex.seconds_held > 0


def to_session_out(s: WorkoutSession) -> SessionOut:
    return SessionOut(
        id=s.id,
        plan_id=s.plan_id,
        started_at=as_utc(s.started_at),
        ended_at=as_utc(s.ended_at),
        duration_seconds=s.duration_seconds,
        mode=s.mode,
        total_reps=s.total_reps,
        avg_form_score=s.avg_form_score,
        verified_seconds=s.verified_seconds,
        verified=s.verified,
        rpe=s.rpe,
        exercises=[
            SessionExerciseOut(
                id=x.id,
                exercise=to_exercise_out(x.exercise),
                position=x.position,
                mode=x.mode,
                sets_completed=x.sets_completed,
                reps_completed=x.reps_completed,
                seconds_held=x.seconds_held,
                target_reps=x.target_reps,
                target_seconds=x.target_seconds,
                duration_seconds=x.duration_seconds,
                form_score=x.form_score,
                verified=x.verified,
                form_flags=dict(x.form_flags or {}),
            )
            for x in s.exercises
        ],
    )


def create_session(db: Session, user: User, data: SessionIn) -> SessionCreateOut:
    existing = db.scalar(
        select(WorkoutSession).where(WorkoutSession.client_session_id == data.client_session_id)
    )
    if existing is not None:
        if existing.user_id != user.id:
            raise AppError("forbidden", "Session belongs to another user", 403)
        stats = ensure_stats(db, user)
        return SessionCreateOut(
            **to_session_out(existing).model_dump(),
            streak=StreakOut(
                current=stats.current_streak, longest=stats.longest_streak, changed=False
            ),
            plan_status=_plan_status(db, existing.plan_id),
            duplicate=True,
        )

    exercise_ids = {e.exercise_id for e in data.exercises}
    known = {e.id: e for e in db.scalars(select(Exercise).where(Exercise.id.in_(exercise_ids)))}
    missing = exercise_ids - set(known)
    if missing:
        raise AppError("exercise_not_found", f"Unknown exercise ids: {sorted(missing)}", 422)

    duration = int((data.ended_at - data.started_at).total_seconds())
    total_reps = 0
    verified_seconds = 0
    weighted_form = 0.0
    weight_total = 0.0
    rows: list[SessionExercise] = []
    for ex in data.exercises:
        verified = is_exercise_verified(ex)
        total_reps += ex.reps_completed
        if verified:
            verified_seconds += ex.duration_seconds
        if ex.form_score is not None and ex.mode == "cv":
            w = float(ex.reps_completed or ex.seconds_held or 1)
            weighted_form += ex.form_score * w
            weight_total += w
        rows.append(
            SessionExercise(
                user_id=user.id,
                exercise_id=ex.exercise_id,
                plan_item_id=ex.plan_item_id,
                position=ex.position,
                mode=ex.mode,
                sets_completed=ex.sets_completed,
                reps_completed=ex.reps_completed,
                seconds_held=ex.seconds_held,
                target_reps=ex.target_reps,
                target_seconds=ex.target_seconds,
                duration_seconds=ex.duration_seconds,
                form_score=ex.form_score,
                mean_visibility=ex.mean_visibility,
                verified=verified,
                form_flags=ex.form_flags,
                rep_events=ex.rep_events[:500],
            )
        )

    verified_seconds = min(verified_seconds, duration)
    session = WorkoutSession(
        user_id=user.id,
        plan_id=None,
        client_session_id=data.client_session_id,
        started_at=data.started_at,
        ended_at=data.ended_at,
        duration_seconds=duration,
        mode=data.mode,
        total_reps=total_reps,
        avg_form_score=round(weighted_form / weight_total, 1) if weight_total else None,
        verified_seconds=verified_seconds,
        verified=duration > 0 and verified_seconds >= VERIFIED_SESSION_SHARE * duration,
        device_info=data.device_info,
    )
    session.exercises = rows

    plan_status: str | None = None
    if data.plan_id is not None:
        plan = db.get(WorkoutPlan, data.plan_id)
        if plan is not None and plan.user_id == user.id:
            session.plan_id = plan.id
            plan.status = "completed"
            plan_status = plan.status

    db.add(session)

    stats = ensure_stats(db, user)
    before = stats.current_streak
    _apply_streak(stats, local_date(data.started_at))
    stats.total_sessions += 1
    stats.total_verified_seconds += verified_seconds

    db.commit()
    db.refresh(session)
    return SessionCreateOut(
        **to_session_out(session).model_dump(),
        streak=StreakOut(
            current=stats.current_streak,
            longest=stats.longest_streak,
            changed=stats.current_streak != before,
        ),
        plan_status=plan_status,
    )


def _apply_streak(stats, session_day) -> None:
    last = stats.last_workout_date
    if last is None or session_day > last + timedelta(days=1):
        stats.current_streak = 1
    elif session_day == last + timedelta(days=1):
        stats.current_streak += 1
    elif session_day == last:
        pass  # same day, streak unchanged
    else:
        return  # out-of-order (offline sync of an older session): totals only
    stats.last_workout_date = session_day
    stats.longest_streak = max(stats.longest_streak, stats.current_streak)


def _plan_status(db: Session, plan_id: uuid.UUID | None) -> str | None:
    if plan_id is None:
        return None
    plan = db.get(WorkoutPlan, plan_id)
    return plan.status if plan else None


def set_rpe(db: Session, user: User, session_id: uuid.UUID, rpe: int) -> SessionOut:
    s = db.get(WorkoutSession, session_id)
    if s is None or s.user_id != user.id:
        raise AppError("not_found", "Session not found", 404)
    s.rpe = rpe
    db.commit()
    db.refresh(s)
    return to_session_out(s)


def get_session(db: Session, user: User, session_id: uuid.UUID) -> SessionOut:
    s = db.get(WorkoutSession, session_id)
    if s is None or s.user_id != user.id:
        raise AppError("not_found", "Session not found", 404)
    return to_session_out(s)


def list_sessions(db: Session, user: User, limit: int, cursor: str | None) -> SessionListOut:
    q = select(WorkoutSession).where(WorkoutSession.user_id == user.id)
    if cursor:
        try:
            cursor_id = uuid.UUID(cursor)
        except ValueError as e:
            raise AppError("bad_cursor", "Invalid cursor", 422) from e
        anchor = db.get(WorkoutSession, cursor_id)
        if anchor is not None:
            q = q.where(WorkoutSession.started_at < anchor.started_at)
    rows = db.scalars(q.order_by(WorkoutSession.started_at.desc()).limit(limit + 1)).all()
    next_cursor = str(rows[limit - 1].id) if len(rows) > limit else None
    return SessionListOut(items=[to_session_out(s) for s in rows[:limit]], next_cursor=next_cursor)
