import uuid
from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import AppError
from app.core.security import decode_access_token
from app.models import User

bearer = HTTPBearer(auto_error=False)

DbDep = Annotated[Session, Depends(get_db)]


def get_current_user(
    db: DbDep,
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> User:
    if creds is None or creds.scheme.lower() != "bearer":
        raise AppError("unauthorized", "Missing bearer token", 401)
    sub = decode_access_token(creds.credentials)
    if sub is None:
        raise AppError("unauthorized", "Invalid or expired token", 401)
    try:
        user_id = uuid.UUID(sub)
    except ValueError as e:
        raise AppError("unauthorized", "Invalid token subject", 401) from e
    user = db.get(User, user_id)
    if user is None:
        raise AppError("unauthorized", "User no longer exists", 401)
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
