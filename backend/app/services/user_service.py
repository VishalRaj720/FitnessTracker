from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.models import Institute, User, UserProfile, UserStats
from app.schemas.common import InstituteBrief
from app.schemas.user import ProfileIn, ProfileOut, StatsOut, UserOut


def institute_brief(inst: Institute | None) -> InstituteBrief | None:
    if inst is None:
        return None
    return InstituteBrief(
        id=inst.id, name=inst.name, slug=inst.slug, city=inst.city, state=inst.state
    )


def ensure_stats(db: Session, user: User) -> UserStats:
    if user.stats is None:
        user.stats = UserStats(user_id=user.id)
        db.add(user.stats)
        db.flush()
    return user.stats


def to_user_out(db: Session, user: User) -> UserOut:
    stats = ensure_stats(db, user)
    profile = user.profile
    return UserOut(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        institute=institute_brief(user.institute),
        department=user.department,
        hostel=user.hostel,
        profile=(
            ProfileOut(
                goal=profile.goal,
                level=profile.level,
                minutes_per_session=profile.minutes_per_session,
                days_per_week=profile.days_per_week,
                preferences=profile.preferences or {},
                onboarding_completed_at=profile.onboarding_completed_at,
            )
            if profile
            else None
        ),
        stats=StatsOut(
            current_streak=stats.current_streak,
            longest_streak=stats.longest_streak,
            last_workout_date=stats.last_workout_date,
            total_sessions=stats.total_sessions,
            total_verified_minutes=stats.total_verified_seconds // 60,
        ),
        onboarding_completed=bool(profile and profile.onboarding_completed_at),
    )


def upsert_profile(db: Session, user: User, data: ProfileIn) -> UserOut:
    if data.institute_id is not None:
        inst = db.get(Institute, data.institute_id)
        if inst is None:
            raise AppError("institute_not_found", "Institute not found", 404)
        user.institute_id = inst.id
        user.institute = inst
    user.department = (data.department or "").strip() or None
    user.hostel = (data.hostel or "").strip() or None

    profile = user.profile
    if profile is None:
        profile = UserProfile(user_id=user.id, goal=data.goal, level=data.level)
        user.profile = profile
        db.add(profile)
    profile.goal = data.goal
    profile.level = data.level
    profile.minutes_per_session = data.minutes_per_session
    profile.days_per_week = data.days_per_week
    profile.preferences = {**(profile.preferences or {}), **(data.preferences or {})}
    if profile.onboarding_completed_at is None:
        profile.onboarding_completed_at = datetime.now(UTC)

    db.commit()
    db.refresh(user)
    return to_user_out(db, user)
