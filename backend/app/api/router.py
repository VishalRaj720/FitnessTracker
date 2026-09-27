from fastapi import APIRouter

from app.api.v1 import (
    auth,
    companion,
    exercises,
    institutes,
    nutrition,
    plans,
    progress,
    sessions,
    squads,
    users,
)

api_router = APIRouter(prefix="/api/v1")
for r in (
    auth,
    users,
    institutes,
    exercises,
    plans,
    sessions,
    progress,
    squads,
    nutrition,
    companion,
):
    api_router.include_router(r.router)
