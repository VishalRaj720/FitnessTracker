from fastapi import APIRouter

from app.api.deps import CurrentUser, DbDep
from app.schemas.user import ProfileIn, UserOut
from app.services import user_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser, db: DbDep) -> UserOut:
    return user_service.to_user_out(db, user)


@router.put("/me/profile", response_model=UserOut)
def update_profile(data: ProfileIn, user: CurrentUser, db: DbDep) -> UserOut:
    return user_service.upsert_profile(db, user, data)
