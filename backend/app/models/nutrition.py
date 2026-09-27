"""Diet & nutrition tables.

All four are new tables rather than new columns on `users`/`user_profiles`: the app has no
migration tool (`Base.metadata.create_all` only creates what is missing), so adding columns to
an existing table would break every database created before this feature. The person's goal and
level still come from `UserProfile` — this only stores what nutrition needs on top of it.
"""

import uuid
from datetime import UTC, date, datetime

from sqlalchemy import JSON, Date, DateTime, Float, ForeignKey, Index, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def _now() -> datetime:
    return datetime.now(UTC)


class NutritionProfile(Base):
    """Body metrics and diet type. One per user, created from the Nutrition page."""

    __tablename__ = "nutrition_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    sex: Mapped[str] = mapped_column(String(10), nullable=False)  # male|female|other
    age: Mapped[int] = mapped_column(Integer, nullable=False)
    height_cm: Mapped[float] = mapped_column(Float, nullable=False)
    weight_kg: Mapped[float] = mapped_column(Float, nullable=False)
    # sedentary|light|moderate|active|very_active
    activity_level: Mapped[str] = mapped_column(String(20), nullable=False)
    diet_type: Mapped[str] = mapped_column(String(10), nullable=False)  # vegan|veg|egg|non_veg
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )


class Food(Base):
    """Seeded catalog of common Indian hostel/mess foods. Values are per `serving`."""

    __tablename__ = "foods"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String(60), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    category: Mapped[str] = mapped_column(String(20), nullable=False)
    diet: Mapped[str] = mapped_column(String(10), nullable=False)
    serving: Mapped[str] = mapped_column(String(60), nullable=False)
    calories: Mapped[float] = mapped_column(Float, nullable=False)
    protein_g: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    carbs_g: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    fat_g: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    fiber_g: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    iron_mg: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    calcium_mg: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    vitamin_c_mg: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    tags: Mapped[list] = mapped_column(JSON, default=list, nullable=False)


class FoodLog(Base):
    """One eaten item. Nutrients are a snapshot (per-serving x servings) taken when logged,
    so re-seeding the catalog never rewrites what someone already ate."""

    __tablename__ = "food_logs"
    __table_args__ = (Index("ix_food_logs_user_date", "user_id", "log_date"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    log_date: Mapped[date] = mapped_column(Date, nullable=False)  # IST calendar day
    meal: Mapped[str] = mapped_column(String(12), nullable=False)  # breakfast|lunch|snack|dinner
    food_id: Mapped[int | None] = mapped_column(ForeignKey("foods.id", ondelete="SET NULL"))
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    serving: Mapped[str | None] = mapped_column(String(60))
    servings: Mapped[float] = mapped_column(Float, default=1, nullable=False)
    calories: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    protein_g: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    carbs_g: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    fat_g: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    fiber_g: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    iron_mg: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    calcium_mg: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    vitamin_c_mg: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    food = relationship("Food", lazy="joined")


class WaterIntake(Base):
    """Running water total for one user on one IST day."""

    __tablename__ = "water_intake"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    log_date: Mapped[date] = mapped_column(Date, primary_key=True)
    water_ml: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )
