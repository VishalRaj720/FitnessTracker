import datetime as dt
import uuid

from fastapi import APIRouter, Query, Response, status

from app.api.deps import CurrentUser, DbDep
from app.schemas.nutrition import (
    DailyNutritionOut,
    FoodLogBatchIn,
    FoodLogIn,
    FoodLogOut,
    FoodOut,
    NutritionHistoryOut,
    NutritionPlanOut,
    NutritionProfileIn,
    NutritionProfileOut,
    NutritionTargetsOut,
    WaterIn,
    WaterOut,
)
from app.services import nutrition_service

router = APIRouter(prefix="/nutrition", tags=["nutrition"])


@router.get("/profile", response_model=NutritionProfileOut | None)
def get_profile(user: CurrentUser, db: DbDep) -> NutritionProfileOut | None:
    return nutrition_service.get_profile(db, user)


@router.put("/profile", response_model=NutritionProfileOut)
def put_profile(data: NutritionProfileIn, user: CurrentUser, db: DbDep) -> NutritionProfileOut:
    return nutrition_service.upsert_profile(db, user, data)


@router.post("/preview", response_model=NutritionTargetsOut)
def preview(data: NutritionProfileIn, user: CurrentUser) -> NutritionTargetsOut:
    """Targets for unsaved metrics, so the setup form can show them while you type."""
    return nutrition_service.preview_targets(user, data)


@router.get("/plan", response_model=NutritionPlanOut)
def plan(user: CurrentUser, db: DbDep) -> NutritionPlanOut:
    return nutrition_service.get_plan(db, user)


@router.get("/day", response_model=DailyNutritionOut)
def day(user: CurrentUser, db: DbDep, date: dt.date | None = None) -> DailyNutritionOut:
    return nutrition_service.day(db, user, date)


@router.get("/history", response_model=NutritionHistoryOut)
def history(
    user: CurrentUser, db: DbDep, days: int = Query(default=7, ge=1, le=30)
) -> NutritionHistoryOut:
    return nutrition_service.history(db, user, days)


@router.get("/foods", response_model=list[FoodOut])
def foods(
    user: CurrentUser,
    db: DbDep,
    q: str | None = Query(default=None, max_length=60),
    compatible: bool = True,
) -> list[FoodOut]:
    return nutrition_service.search_foods(db, user, q, compatible)


@router.post("/logs", response_model=FoodLogOut, status_code=status.HTTP_201_CREATED)
def add_log(data: FoodLogIn, user: CurrentUser, db: DbDep) -> FoodLogOut:
    return nutrition_service.add_log(db, user, data)


@router.post("/logs/batch", response_model=list[FoodLogOut], status_code=status.HTTP_201_CREATED)
def add_logs_batch(data: FoodLogBatchIn, user: CurrentUser, db: DbDep) -> list[FoodLogOut]:
    return nutrition_service.add_logs_batch(db, user, data)


@router.delete("/logs/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_log(log_id: uuid.UUID, user: CurrentUser, db: DbDep) -> Response:
    nutrition_service.delete_log(db, user, log_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/water", response_model=WaterOut)
def add_water(data: WaterIn, user: CurrentUser, db: DbDep) -> WaterOut:
    return nutrition_service.add_water(db, user, data)
