import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.models import User, GroupMember, Settlement
from app.schemas.settlements import SettlementCreate, SettlementResponse

router = APIRouter()


@router.post("", response_model=SettlementResponse, status_code=status.HTTP_201_CREATED)
async def create_settlement(
    data: SettlementCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Record a manual peer-to-peer payment to settle a debt."""
    # Check payer is a group member
    result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == data.group_id,
            GroupMember.user_id == current_user.id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="You are not a member of this group")

    # Prevent self-settlement
    if data.payee_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot settle with yourself")

    # Check payee is also a group member
    result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == data.group_id,
            GroupMember.user_id == data.payee_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=404, detail="Payee is not a member of this group"
        )

    settlement = Settlement(
        group_id=data.group_id,
        payer_id=current_user.id,
        payee_id=data.payee_id,
        amount=data.amount,
    )
    db.add(settlement)
    await db.commit()

    # Re-fetch with relationships
    result = await db.execute(
        select(Settlement)
        .where(Settlement.id == settlement.id)
        .options(selectinload(Settlement.payer), selectinload(Settlement.payee))
    )
    return result.scalar_one()
