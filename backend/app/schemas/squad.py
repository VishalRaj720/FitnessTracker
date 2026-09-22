import uuid

from pydantic import BaseModel, Field

from app.schemas.common import InstituteBrief


class SquadCreateIn(BaseModel):
    name: str = Field(min_length=2, max_length=40)


class SquadJoinIn(BaseModel):
    invite_code: str = Field(min_length=4, max_length=8)


class SquadOut(BaseModel):
    id: uuid.UUID
    name: str
    invite_code: str
    member_count: int
    institute: InstituteBrief | None


class LeaderboardRow(BaseModel):
    rank: int
    user_id: uuid.UUID
    name: str
    verified_minutes: int
    sessions: int
    avg_form: float | None
    is_me: bool


class LeaderboardOut(BaseModel):
    squad: SquadOut
    week: str
    rows: list[LeaderboardRow]
