from fastapi import APIRouter

from app.api.v1 import auth, exercises, institutes, plans, progress, sessions, squads, users

api_router = APIRouter(prefix="/api/v1")
for r in (auth, users, institutes, exercises, plans, sessions, progress, squads):
    api_router.include_router(r.router)
