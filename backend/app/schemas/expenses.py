import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, field_validator


VALID_SPLIT_METHODS = {"EQUAL", "EXACT", "PERCENT", "SHARE"}


class SplitInput(BaseModel):
    """Input for a single member's split value."""
    user_id: uuid.UUID
    value: Decimal  # amount for EXACT, percentage for PERCENT, share units for SHARE, ignored for EQUAL


class ExpenseCreate(BaseModel):
    group_id: uuid.UUID
    description: str
    total_amount: Decimal
    paid_by_id: uuid.UUID
    split_method: str  # EQUAL | EXACT | PERCENT | SHARE
    splits: List[SplitInput]  # subset of group members

    @field_validator("split_method")
    @classmethod
    def validate_split_method(cls, v: str) -> str:
        if v not in VALID_SPLIT_METHODS:
            raise ValueError(f"split_method must be one of {VALID_SPLIT_METHODS}")
        return v

    @field_validator("total_amount")
    @classmethod
    def validate_amount(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("total_amount must be positive")
        return v

    @field_validator("splits")
    @classmethod
    def validate_splits_not_empty(cls, v: List[SplitInput]) -> List[SplitInput]:
        if not v:
            raise ValueError("At least one split member is required")
        return v


class SplitUserInfo(BaseModel):
    id: uuid.UUID
    name: str
    email: str

    model_config = {"from_attributes": True}


class SplitResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    owed_amount: Decimal
    user_share_input: Optional[Decimal]
    user: SplitUserInfo

    model_config = {"from_attributes": True}


class PaidByInfo(BaseModel):
    id: uuid.UUID
    name: str
    email: str

    model_config = {"from_attributes": True}


class ExpenseResponse(BaseModel):
    id: uuid.UUID
    group_id: uuid.UUID
    description: str
    total_amount: Decimal
    paid_by_id: uuid.UUID
    paid_by: PaidByInfo
    split_method: str
    rounding_remainder: Optional[Decimal]
    created_at: datetime
    splits: List[SplitResponse] = []

    model_config = {"from_attributes": True}
