from fastapi import APIRouter

from app.api.deps import CurrentUser, DbDep
from app.schemas.progress import ProgressSummaryOut
from app.services import progress_service

router = APIRouter(prefix="/progress", tags=["progress"])


@router.get("/summary", response_model=ProgressSummaryOut)
def summary(user: CurrentUser, db: DbDep) -> ProgressSummaryOut:
    return progress_service.summary(db, user)
