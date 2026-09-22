import secrets
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.models import Exercise, PlanItem, User, WorkoutPlan, WorkoutSession
from app.recommender import (
    ExerciseInfo,
    HistoryInput,
    ProfileInput,
    SessionSummary,
    generate,
)
from app.schemas.plan import PlanItemOut, PlanOut
from app.services.exercise_service import to_exercise_out
from app.utils.dates import local_date, local_today


def to_plan_out(plan: WorkoutPlan) -> PlanOut:
    return PlanOut(
        id=plan.id,
        plan_date=plan.plan_date,
        status=plan.status,
        generated_by=plan.generated_by,
        estimated_minutes=plan.estimated_minutes,
        rationale=list(plan.rationale or []),
        items=[
            PlanItemOut(
                id=i.id,
                position=i.position,
                exercise=to_exercise_out(i.exercise),
                target_sets=i.target_sets,
                target_reps=i.target_reps,
                target_seconds=i.target_seconds,
                rest_seconds=i.rest_seconds,
                focus_cue=i.focus_cue,
            )
            for i in plan.items
        ],
    )


def _require_profile(user: User) -> ProfileInput:
    p = user.profile
    if p is None or p.onboarding_completed_at is None:
        raise AppError("onboarding_required", "Complete onboarding to get a plan", 409)
    return ProfileInput(
        goal=p.goal,
        level=p.level,
        minutes_per_session=p.minutes_per_session,
        days_per_week=p.days_per_week,
    )


def build_history(db: Session, user: User, today: date, days: int = 14) -> HistoryInput:
    since = today - timedelta(days=days)
    sessions = db.scalars(
        select(WorkoutSession)
        .where(WorkoutSession.user_id == user.id)
        .order_by(WorkoutSession.started_at.desc())
        .limit(60)
    ).all()
    summaries: list[SessionSummary] = []
    for s in sessions:
        d = local_date(s.started_at)
        if d < since:
            continue
        ratios: list[float] = []
        forms: dict[str, float] = {}
        slugs: list[str] = []
        for sx in s.exercises:
            slug = sx.exercise.slug
            slugs.append(slug)
            if sx.target_reps:
                ratios.append(min(1.0, sx.reps_completed / sx.target_reps))
            elif sx.target_seconds:
                ratios.append(min(1.0, sx.seconds_held / sx.target_seconds))
            if sx.form_score is not None and sx.mode == "cv":
                forms[slug] = float(sx.form_score)
        summaries.append(
            SessionSummary(
                day=d,
                completed_ratio=sum(ratios) / len(ratios) if ratios else 1.0,
                avg_form=s.avg_form_score,
                rpe=s.rpe,
                exercise_forms=forms,
                exercise_slugs=tuple(slugs),
            )
        )
    return HistoryInput(sessions=tuple(summaries))


def _catalog(db: Session) -> list[ExerciseInfo]:
    rows = db.scalars(select(Exercise)).all()
    return [
        ExerciseInfo(
            id=e.id,
            slug=e.slug,
            name=e.name,
            category=e.category,
            difficulty=e.difficulty,
            mode=e.mode,
            cv_supported=e.cv_supported,
            default_reps=e.default_reps,
            default_seconds=e.default_seconds,
        )
        for e in rows
    ]


def _generate_and_store(db: Session, user: User, today: date, seed: str) -> WorkoutPlan:
    profile = _require_profile(user)
    history = build_history(db, user, today)
    out = generate(profile, history, _catalog(db), today, seed=seed)
    plan = WorkoutPlan(
        user_id=user.id,
        plan_date=today,
        status="pending",
        generated_by=out.generated_by,
        rationale=out.rationale,
        estimated_minutes=out.estimated_minutes,
    )
    for it in out.items:
        plan.items.append(
            PlanItem(
                exercise_id=it.exercise_id,
                position=it.position,
                target_sets=it.target_sets,
                target_reps=it.target_reps,
                target_seconds=it.target_seconds,
                rest_seconds=it.rest_seconds,
                focus_cue=it.focus_cue,
            )
        )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


def get_or_generate_today(db: Session, user: User) -> PlanOut:
    today = local_today()
    plan = db.scalar(
        select(WorkoutPlan).where(WorkoutPlan.user_id == user.id, WorkoutPlan.plan_date == today)
    )
    if plan is None:
        plan = _generate_and_store(db, user, today, seed=f"{user.id}:{today.isoformat()}")
    return to_plan_out(plan)


def regenerate_today(db: Session, user: User) -> PlanOut:
    today = local_today()
    plan = db.scalar(
        select(WorkoutPlan).where(WorkoutPlan.user_id == user.id, WorkoutPlan.plan_date == today)
    )
    if plan is not None:
        if plan.status == "completed":
            raise AppError("plan_completed", "Today's plan is already completed", 409)
        db.delete(plan)
        db.commit()
    plan = _generate_and_store(
        db, user, today, seed=f"{user.id}:{today.isoformat()}:{secrets.token_hex(4)}"
    )
    return to_plan_out(plan)
