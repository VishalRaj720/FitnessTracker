import uuid
from datetime import UTC, date, datetime

from sqlalchemy import JSON, Date, DateTime, ForeignKey, Integer, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def _now() -> datetime:
    return datetime.now(UTC)


class WorkoutPlan(Base):
    __tablename__ = "workout_plans"
    __table_args__ = (UniqueConstraint("user_id", "plan_date", name="uq_plan_user_date"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    plan_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    generated_by: Mapped[str] = mapped_column(String(30), default="rules_v1", nullable=False)
    rationale: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    estimated_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    items: Mapped[list["PlanItem"]] = relationship(
        back_populates="plan",
        cascade="all, delete-orphan",
        order_by="PlanItem.position",
        lazy="selectin",
    )


class PlanItem(Base):
    __tablename__ = "plan_items"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    plan_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workout_plans.id", ondelete="CASCADE"), nullable=False, index=True
    )
    exercise_id: Mapped[int] = mapped_column(ForeignKey("exercises.id"), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    target_sets: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    target_reps: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    target_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    rest_seconds: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    focus_cue: Mapped[str | None] = mapped_column(String(80))

    plan = relationship("WorkoutPlan", back_populates="items")
    exercise = relationship("Exercise", lazy="joined")
