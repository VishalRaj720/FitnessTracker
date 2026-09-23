import uuid

from fastapi import APIRouter, Request

from app.api.deps import CurrentUser, DbDep
from app.companion import service
from app.core.limiter import limiter
from app.schemas.companion import (
    ChatIn,
    ChatOut,
    CueIn,
    CueOut,
    DebriefOut,
    MessageOut,
    StatusOut,
    ThreadOut,
)

router = APIRouter(prefix="/companion", tags=["companion"])


@router.get("/status", response_model=StatusOut)
def status(_: CurrentUser) -> StatusOut:
    """Lets the client hide the coach entirely when no key is configured."""
    return StatusOut(enabled=service.enabled(), provider=service.provider().name)


@router.post("/cue", response_model=CueOut)
@limiter.limit("90/minute")
def cue(request: Request, data: CueIn, user: CurrentUser, db: DbDep) -> CueOut:
    """Per-rep form analysis. Called once per repetition, so the limit is generous but real."""
    return service.cue(db, user, data)


@router.post("/chat", response_model=ChatOut)
@limiter.limit("20/minute")
def chat(request: Request, data: ChatIn, user: CurrentUser, db: DbDep) -> ChatOut:
    return service.chat(db, user, data)


@router.get("/thread", response_model=ThreadOut)
def thread(user: CurrentUser, db: DbDep) -> ThreadOut:
    return ThreadOut(
        messages=[
            MessageOut(id=m.id, role=m.role, content=m.content, created_at=m.created_at)
            for m in service.history(db, user)
        ]
    )


@router.delete("/thread", status_code=204)
def clear_thread(user: CurrentUser, db: DbDep) -> None:
    service.clear_history(db, user)


@router.get("/debrief/{session_id}", response_model=DebriefOut)
def debrief(session_id: uuid.UUID, user: CurrentUser, db: DbDep) -> DebriefOut:
    return service.debrief(db, user, session_id)
