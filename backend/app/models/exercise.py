from sqlalchemy import JSON, Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Exercise(Base):
    __tablename__ = "exercises"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String(60), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    category: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # legs|push|core|cardio|mobility
    difficulty: Mapped[int] = mapped_column(Integer, default=1, nullable=False)  # 1..3
    mode: Mapped[str] = mapped_column(String(10), nullable=False)  # reps|hold
    cv_supported: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    orientation: Mapped[str] = mapped_column(String(10), default="any", nullable=False)
    default_reps: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    default_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    instructions: Mapped[str] = mapped_column(Text, default="", nullable=False)
    muscle_groups: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    cv_config_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
