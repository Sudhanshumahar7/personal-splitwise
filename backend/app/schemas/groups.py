import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class GroupCreate(BaseModel):
    name: str
    description: Optional[str] = None


class MemberUserInfo(BaseModel):
    id: uuid.UUID
    name: str
    email: str

    model_config = {"from_attributes": True}


class MemberResponse(BaseModel):
    user_id: uuid.UUID
    role: str
    joined_at: datetime
    user: MemberUserInfo

    model_config = {"from_attributes": True}


class GroupResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str]
    created_by: uuid.UUID
    created_at: datetime
    members: List[MemberResponse] = []

    model_config = {"from_attributes": True}


class AddMemberRequest(BaseModel):
    email: str


class UpdateMemberRoleRequest(BaseModel):
    role: str  # "ADMIN" or "MEMBER"
