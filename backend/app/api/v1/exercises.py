from fastapi import APIRouter

from app.api.deps import CurrentUser, DbDep
from app.schemas.common import ExerciseOut
from app.services import exercise_service

router = APIRouter(prefix="/exercises", tags=["exercises"])


@router.get("", response_model=list[ExerciseOut])
def list_exercises(_: CurrentUser, db: DbDep) -> list[ExerciseOut]:
    return exercise_service.list_exercises(db)
