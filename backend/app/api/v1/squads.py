import uuid

from fastapi import APIRouter, Query, Response, status

from app.api.deps import CurrentUser, DbDep
from app.schemas.squad import LeaderboardOut, SquadCreateIn, SquadJoinIn, SquadOut
from app.services import squad_service

router = APIRouter(prefix="/squads", tags=["squads"])


@router.post("", response_model=SquadOut, status_code=status.HTTP_201_CREATED)
def create(data: SquadCreateIn, user: CurrentUser, db: DbDep) -> SquadOut:
    return squad_service.create_squad(db, user, data.name)


@router.post("/join", response_model=SquadOut)
def join(data: SquadJoinIn, user: CurrentUser, db: DbDep) -> SquadOut:
    return squad_service.join_squad(db, user, data.invite_code)


@router.post("/leave", status_code=status.HTTP_204_NO_CONTENT)
def leave(user: CurrentUser, db: DbDep) -> Response:
    squad_service.leave_squad(db, user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/mine", response_model=SquadOut | None)
def mine(user: CurrentUser, db: DbDep) -> SquadOut | None:
    return squad_service.my_squad(db, user)


@router.get("/{squad_id}/leaderboard", response_model=LeaderboardOut)
def leaderboard(
    squad_id: uuid.UUID,
    user: CurrentUser,
    db: DbDep,
    week: str | None = Query(default=None, pattern=r"^\d{4}-W\d{2}$"),
) -> LeaderboardOut:
    return squad_service.leaderboard(db, user, squad_id, week)
