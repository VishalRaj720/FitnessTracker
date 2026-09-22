from fastapi import APIRouter, Query

from app.api.deps import DbDep
from app.schemas.common import InstituteBrief
from app.schemas.institute import InstituteStatsOut
from app.services import institute_service

router = APIRouter(prefix="/institutes", tags=["institutes"])


@router.get("", response_model=list[InstituteBrief])
def search_institutes(
    db: DbDep, q: str | None = Query(default=None, max_length=80)
) -> list[InstituteBrief]:
    return institute_service.search(db, q)


@router.get("/{slug}/stats", response_model=InstituteStatsOut)
def institute_stats(slug: str, db: DbDep, weeks: int = Query(default=8, ge=1, le=26)):
    return institute_service.stats(db, slug, weeks)
