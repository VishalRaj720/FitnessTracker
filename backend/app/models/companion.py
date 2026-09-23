import uuid
from datetime import UTC, datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Index, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def _now() -> datetime:
    return datetime.now(UTC)


class CompanionThread(Base):
    """One rolling conversation per user. Kept so the coach can refer back to what was said."""

    __tablename__ = "companion_threads"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    messages: Mapped[list["CompanionMessage"]] = relationship(
        back_populates="thread",
        cascade="all, delete-orphan",
        order_by="CompanionMessage.created_at",
        lazy="selectin",
    )


class CompanionMessage(Base):
    __tablename__ = "companion_messages"
    __table_args__ = (Index("ix_companion_msg_thread_created", "thread_id", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    thread_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("companion_threads.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(10), nullable=False)  # user|coach
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # What the coach was told at the time, so a reply can be explained after the fact.
    context_digest: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)

    thread = relationship("CompanionThread", back_populates="messages")


class SessionDebrief(Base):
    """Cached post-session summary, so re-opening a summary screen is free."""

    __tablename__ = "session_debriefs"

    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workout_sessions.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
