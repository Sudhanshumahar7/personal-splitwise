import uuid
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, field_validator


class SettlementCreate(BaseModel):
    group_id: uuid.UUID
    payee_id: uuid.UUID   # person receiving the payment
    amount: Decimal

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Settlement amount must be positive")
        return v


class SettlementUserInfo(BaseModel):
    id: uuid.UUID
    name: str
    email: str

    model_config = {"from_attributes": True}


class SettlementResponse(BaseModel):
    id: uuid.UUID
    group_id: uuid.UUID
    payer_id: uuid.UUID
    payee_id: uuid.UUID
    amount: Decimal
    settled_at: datetime
    payer: SettlementUserInfo
    payee: SettlementUserInfo

    model_config = {"from_attributes": True}
