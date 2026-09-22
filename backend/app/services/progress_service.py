from collections import defaultdict
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import SessionExercise, User, WorkoutSession
from app.schemas.progress import (
    FormPoint,
    FormTrend,
    ProgressSummaryOut,
    StreakSummary,
    ThisWeek,
    Totals,
    WeekPoint,
)
from app.services.user_service import ensure_stats
from app.utils.dates import (
    as_utc,
    iso_week_label,
    last_n_week_labels,
    local_date,
    local_today,
    week_bounds,
)

WEEKS = 8
FORM_TREND_DAYS = 30


def summary(db: Session, user: User) -> ProgressSummaryOut:
    stats = ensure_stats(db, user)
    today = local_today()
    labels = last_n_week_labels(WEEKS, today)
    range_start, _, _ = week_bounds(labels[0])
    this_start, this_end, this_label = week_bounds(labels[-1])

    sessions = db.scalars(
        select(WorkoutSession)
        .where(WorkoutSession.user_id == user.id, WorkoutSession.started_at >= range_start)
        .order_by(WorkoutSession.started_at)
    ).all()

    weekly_minutes: dict[str, int] = defaultdict(int)
    weekly_sessions: dict[str, int] = defaultdict(int)
    this_week_days: set = set()
    this_week_sessions = 0
    this_week_minutes = 0
    for s in sessions:
        started = as_utc(s.started_at)
        label = iso_week_label(local_date(started))
        weekly_minutes[label] += s.verified_seconds // 60
        weekly_sessions[label] += 1
        if this_start <= started < this_end:
            this_week_sessions += 1
            this_week_minutes += s.verified_seconds // 60
            this_week_days.add(local_date(started))

    trend_since = today - timedelta(days=FORM_TREND_DAYS)
    sx_rows = db.scalars(
        select(SessionExercise)
        .where(
            SessionExercise.user_id == user.id,
            SessionExercise.mode == "cv",
            SessionExercise.form_score.is_not(None),
        )
        .order_by(SessionExercise.created_at)
    ).all()
    by_ex: dict[str, FormTrend] = {}
    for sx in sx_rows:
        d = local_date(sx.created_at)
        if d < trend_since:
            continue
        slug = sx.exercise.slug
        if slug not in by_ex:
            by_ex[slug] = FormTrend(exercise_slug=slug, exercise_name=sx.exercise.name, points=[])
        by_ex[slug].points.append(FormPoint(date=d, form_score=round(float(sx.form_score), 1)))

    target_days = user.profile.days_per_week if user.profile else 4
    return ProgressSummaryOut(
        streak=StreakSummary(
            current=stats.current_streak,
            longest=stats.longest_streak,
            last_workout_date=stats.last_workout_date,
        ),
        this_week=ThisWeek(
            sessions=this_week_sessions,
            verified_minutes=this_week_minutes,
            days_done=len(this_week_days),
            target_days=target_days,
        ),
        weekly=[
            WeekPoint(week=w, verified_minutes=weekly_minutes[w], sessions=weekly_sessions[w])
            for w in labels
        ],
        form_trend=list(by_ex.values()),
        totals=Totals(
            sessions=stats.total_sessions, verified_minutes=stats.total_verified_seconds // 60
        ),
    )
