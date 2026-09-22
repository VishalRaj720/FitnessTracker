from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.core.security import create_access_token, hash_password, verify_password
from app.models import User, UserStats
from app.schemas.user import LoginIn, RegisterIn, TokenOut
from app.services.user_service import to_user_out


def register(db: Session, data: RegisterIn) -> TokenOut:
    email = data.email.lower().strip()
    exists = db.scalar(select(User.id).where(User.email == email))
    if exists:
        raise AppError("email_taken", "An account with this email already exists", 409)

    user = User(email=email, password_hash=hash_password(data.password), name=data.name.strip())
    user.stats = UserStats()
    db.add(user)
    db.commit()
    db.refresh(user)
    return TokenOut(access_token=create_access_token(str(user.id)), user=to_user_out(db, user))


def login(db: Session, data: LoginIn) -> TokenOut:
    email = data.email.lower().strip()
    user = db.scalar(select(User).where(User.email == email))
    if user is None or not verify_password(data.password, user.password_hash):
        raise AppError("invalid_credentials", "Incorrect email or password", 401)
    return TokenOut(access_token=create_access_token(str(user.id)), user=to_user_out(db, user))
