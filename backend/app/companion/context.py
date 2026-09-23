"""Assemble what the coach is allowed to know about a user.

Everything here is read from the database on the server. The client may describe what is
happening right now in a workout, but that arrives under a separate `client_reported` key
and the prompt is told it is unverified — a browser must never be able to talk the coach
into believing a streak or a form score that did not happen.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import SessionExercise, User, WorkoutSession
from app.services import progress_service
from app.services.plan_service import get_or_generate_today
from app.utils.dates import local_date, local_today

RECENT_SESSIONS = 5
FLAG_WINDOW_DAYS = 30


def build_context(db: Session, user: User) -> dict:
    """A compact, factual snapshot of this user. Kept small: it goes into every prompt."""
    summary = progress_service.summary(db, user)
    profile = user.profile

    ctx: dict = {
        "name": user.name.split(" ")[0] if user.name else None,
        "profile": {
            "goal": profile.goal if profile else None,
            "level": profile.level if profile else None,
            "minutes_per_session": profile.minutes_per_session if profile else None,
            "days_per_week": profile.days_per_week if profile else None,
            "language": (profile.preferences or {}).get("language", "en") if profile else "en",
        },
        "streak": {
            "current_days": summary.streak.current,
            "longest_days": summary.streak.longest,
            "last_workout": summary.streak.last_workout_date.isoformat()
            if summary.streak.last_workout_date
            else None,
        },
        "this_week": {
            "sessions": summary.this_week.sessions,
            "verified_minutes": summary.this_week.verified_minutes,
            "days_done": summary.this_week.days_done,
            "target_days": summary.this_week.target_days,
        },
        "totals": {
            "sessions": summary.totals.sessions,
            "verified_minutes": summary.totals.verified_minutes,
        },
        "recent_sessions": _recent_sessions(db, user),
        "form_flags_30d": _flag_rollup(db, user),
        "today_plan": _today_plan(db, user),
    }
    return ctx


def _recent_sessions(db: Session, user: User) -> list[dict]:
    rows = db.scalars(
        select(WorkoutSession)
        .where(WorkoutSession.user_id == user.id)
        .order_by(WorkoutSession.started_at.desc())
        .limit(RECENT_SESSIONS)
    ).all()
    out = []
    for s in rows:
        out.append(
            {
                "date": local_date(s.started_at).isoformat(),
                "minutes": round(s.duration_seconds / 60),
                "reps": s.total_reps,
                "avg_form_score": round(s.avg_form_score, 1) if s.avg_form_score else None,
                "exercises": [x.exercise.slug for x in s.exercises],
            }
        )
    return out


def _flag_rollup(db: Session, user: User) -> dict[str, dict[str, int]]:
    """Which form faults this user actually has, per exercise, over the last 30 days.

    This is the difference between generic advice and advice about *them*.
    """
    since = local_today() - timedelta(days=FLAG_WINDOW_DAYS)
    rows = db.scalars(
        select(SessionExercise).where(
            SessionExercise.user_id == user.id, SessionExercise.mode == "cv"
        )
    ).all()
    agg: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for sx in rows:
        if local_date(sx.created_at) < since:
            continue
        for flag, count in (sx.form_flags or {}).items():
            agg[sx.exercise.slug][flag] += int(count)
    return {k: dict(v) for k, v in agg.items()}


def _today_plan(db: Session, user: User) -> list[dict]:
    try:
        plan = get_or_generate_today(db, user)
    except Exception:
        # No profile yet, or the recommender could not fit a plan. The coach just does
        # without today's plan rather than failing the whole request.
        return []
    return [
        {
            "exercise": i.exercise.slug,
            "sets": i.target_sets,
            "reps": i.target_reps,
            "seconds": i.target_seconds,
        }
        for i in plan.items
    ]
