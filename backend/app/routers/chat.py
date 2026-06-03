import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.models import User, GroupMember, Expense, ChatMessage
from app.schemas.chat import ChatMessageResponse

router = APIRouter()


@router.get("/{expense_id}/messages", response_model=List[ChatMessageResponse])
async def get_chat_history(
    expense_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch historical chat messages for a specific expense."""
    # Verify the expense exists and user is a group member
    result = await db.execute(
        select(Expense).where(Expense.id == expense_id)
    )
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == expense.group_id,
            GroupMember.user_id == current_user.id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member of this group")

    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.expense_id == expense_id)
        .options(selectinload(ChatMessage.sender))
        .order_by(ChatMessage.sent_at.asc())
    )
    messages = result.scalars().all()

    return [
        ChatMessageResponse(
            id=msg.id,
            expense_id=msg.expense_id,
            sender_id=msg.sender_id,
            sender_name=msg.sender.name,
            message_text=msg.message_text,
            sent_at=msg.sent_at,
        )
        for msg in messages
    ]
