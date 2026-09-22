import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def _now() -> datetime:
    return datetime.now(UTC)


class Squad(Base):
    __tablename__ = "squads"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(40), nullable=False)
    invite_code: Mapped[str] = mapped_column(String(8), unique=True, nullable=False, index=True)
    institute_id: Mapped[int | None] = mapped_column(
        ForeignKey("institutes.id", ondelete="SET NULL"), index=True
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    members: Mapped[list["SquadMember"]] = relationship(
        back_populates="squad", cascade="all, delete-orphan", lazy="selectin"
    )
    institute = relationship("Institute", lazy="joined")


class SquadMember(Base):
    __tablename__ = "squad_members"

    squad_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("squads.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    squad = relationship("Squad", back_populates="members")
    user = relationship("User", lazy="joined")
