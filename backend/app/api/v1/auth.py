from fastapi import APIRouter, Request, status

from app.api.deps import DbDep
from app.core.limiter import limiter
from app.schemas.user import LoginIn, RegisterIn, TokenOut
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
def register(request: Request, data: RegisterIn, db: DbDep) -> TokenOut:
    return auth_service.register(db, data)


@router.post("/login", response_model=TokenOut)
@limiter.limit("10/minute")
def login(request: Request, data: LoginIn, db: DbDep) -> TokenOut:
    return auth_service.login(db, data)
