import uuid

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, DbDep
from app.schemas.session import (
    SessionCreateOut,
    SessionIn,
    SessionListOut,
    SessionOut,
    SessionRpeIn,
)
from app.services import session_service

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("", response_model=SessionCreateOut, status_code=status.HTTP_201_CREATED)
def create_session(data: SessionIn, user: CurrentUser, db: DbDep) -> SessionCreateOut:
    return session_service.create_session(db, user, data)


@router.get("", response_model=SessionListOut)
def list_sessions(
    user: CurrentUser,
    db: DbDep,
    limit: int = Query(default=10, ge=1, le=50),
    cursor: str | None = None,
) -> SessionListOut:
    return session_service.list_sessions(db, user, limit, cursor)


@router.get("/{session_id}", response_model=SessionOut)
def get_session(session_id: uuid.UUID, user: CurrentUser, db: DbDep) -> SessionOut:
    return session_service.get_session(db, user, session_id)


@router.patch("/{session_id}", response_model=SessionOut)
def set_rpe(session_id: uuid.UUID, data: SessionRpeIn, user: CurrentUser, db: DbDep) -> SessionOut:
    return session_service.set_rpe(db, user, session_id, data.rpe)
