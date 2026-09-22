from fastapi import APIRouter

from app.api.deps import CurrentUser, DbDep
from app.schemas.plan import PlanOut
from app.services import plan_service

router = APIRouter(prefix="/plans", tags=["plans"])


@router.get("/today", response_model=PlanOut)
def today(user: CurrentUser, db: DbDep) -> PlanOut:
    return plan_service.get_or_generate_today(db, user)


@router.post("/today/regenerate", response_model=PlanOut)
def regenerate(user: CurrentUser, db: DbDep) -> PlanOut:
    return plan_service.regenerate_today(db, user)
