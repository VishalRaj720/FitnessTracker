import uuid
from datetime import UTC, datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def _now() -> datetime:
    return datetime.now(UTC)


class WorkoutSession(Base):
    __tablename__ = "workout_sessions"
    __table_args__ = (Index("ix_sessions_user_started", "user_id", "started_at"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    plan_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("workout_plans.id", ondelete="SET NULL")
    )
    client_session_id: Mapped[uuid.UUID] = mapped_column(Uuid, unique=True, nullable=False)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    ended_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    mode: Mapped[str] = mapped_column(String(10), nullable=False)  # cv|manual|mixed
    total_reps: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    avg_form_score: Mapped[float | None] = mapped_column(Float)
    verified_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    rpe: Mapped[int | None] = mapped_column(Integer)
    device_info: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    exercises: Mapped[list["SessionExercise"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="SessionExercise.position",
        lazy="selectin",
    )


class SessionExercise(Base):
    __tablename__ = "session_exercises"
    __table_args__ = (Index("ix_sx_user_exercise_created", "user_id", "exercise_id", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workout_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    exercise_id: Mapped[int] = mapped_column(ForeignKey("exercises.id"), nullable=False)
    plan_item_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("plan_items.id", ondelete="SET NULL")
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    mode: Mapped[str] = mapped_column(String(10), nullable=False)  # cv|manual
    sets_completed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reps_completed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    seconds_held: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    target_reps: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    target_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    form_score: Mapped[float | None] = mapped_column(Float)
    mean_visibility: Mapped[float | None] = mapped_column(Float)
    verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    form_flags: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    rep_events: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    session = relationship("WorkoutSession", back_populates="exercises")
    exercise = relationship("Exercise", lazy="joined")
