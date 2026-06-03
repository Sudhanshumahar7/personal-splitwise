import uuid
from datetime import datetime
from pydantic import BaseModel


class ChatMessageResponse(BaseModel):
    id: uuid.UUID
    expense_id: uuid.UUID
    sender_id: uuid.UUID
    sender_name: str
    message_text: str
    sent_at: datetime

    model_config = {"from_attributes": True}


class ChatMessageCreate(BaseModel):
    message_text: str
