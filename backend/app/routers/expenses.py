import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.models import User, GroupMember, Expense, ExpenseSplit
from app.schemas.expenses import ExpenseCreate, ExpenseResponse
from app.services.split_engine import calculate_splits

router = APIRouter()


async def _check_group_membership(
    db: AsyncSession, group_id: uuid.UUID, user_id: uuid.UUID
) -> None:
    result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="You are not a member of this group")


async def _fetch_expense(db: AsyncSession, expense_id: uuid.UUID) -> Expense:
    result = await db.execute(
        select(Expense)
        .where(Expense.id == expense_id)
        .options(
            selectinload(Expense.splits).selectinload(ExpenseSplit.user),
            selectinload(Expense.paid_by),
        )
    )
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    return expense


# ── Routes ─────────────────────────────────────────────────────────────────


@router.get("/groups/{group_id}/expenses", response_model=List[ExpenseResponse])
async def list_expenses(
    group_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all expenses in a group (chronological, newest first)."""
    await _check_group_membership(db, group_id, current_user.id)

    result = await db.execute(
        select(Expense)
        .where(Expense.group_id == group_id)
        .options(
            selectinload(Expense.splits).selectinload(ExpenseSplit.user),
            selectinload(Expense.paid_by),
        )
        .order_by(Expense.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
async def create_expense(
    expense_data: ExpenseCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new expense with automatic split computation.
    Only group members can add expenses.
    """
    await _check_group_membership(db, expense_data.group_id, current_user.id)

    # Run the split engine
    try:
        splits_map, remainder = calculate_splits(
            expense_data.total_amount,
            expense_data.split_method,
            expense_data.splits,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    expense = Expense(
        group_id=expense_data.group_id,
        description=expense_data.description,
        total_amount=expense_data.total_amount,
        paid_by_id=expense_data.paid_by_id,
        split_method=expense_data.split_method,
        rounding_remainder=remainder if remainder > 0 else None,
    )
    db.add(expense)
    await db.flush()

    # Write split records
    for split_input in expense_data.splits:
        uid = str(split_input.user_id)
        split = ExpenseSplit(
            expense_id=expense.id,
            user_id=split_input.user_id,
            owed_amount=splits_map[uid],
            user_share_input=(
                split_input.value if expense_data.split_method != "EQUAL" else None
            ),
        )
        db.add(split)

    await db.commit()
    return await _fetch_expense(db, expense.id)


@router.put("/{expense_id}", response_model=ExpenseResponse)
async def update_expense(
    expense_id: uuid.UUID,
    expense_data: ExpenseCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Edit an existing expense and recalculate all splits.
    Only the original payer can edit.
    """
    result = await db.execute(
        select(Expense)
        .where(Expense.id == expense_id)
        .options(selectinload(Expense.splits))
    )
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    if expense.paid_by_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="Only the payer can edit this expense"
        )

    try:
        splits_map, remainder = calculate_splits(
            expense_data.total_amount,
            expense_data.split_method,
            expense_data.splits,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Update expense fields
    expense.description = expense_data.description
    expense.total_amount = expense_data.total_amount
    expense.paid_by_id = expense_data.paid_by_id
    expense.split_method = expense_data.split_method
    expense.rounding_remainder = remainder if remainder > 0 else None

    # Delete old splits
    for split in expense.splits:
        await db.delete(split)
    await db.flush()

    # Write new splits
    for split_input in expense_data.splits:
        uid = str(split_input.user_id)
        split = ExpenseSplit(
            expense_id=expense.id,
            user_id=split_input.user_id,
            owed_amount=splits_map[uid],
            user_share_input=(
                split_input.value if expense_data.split_method != "EQUAL" else None
            ),
        )
        db.add(split)

    await db.commit()
    return await _fetch_expense(db, expense_id)


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expense(
    expense_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Delete an expense. Cascades to splits and chat messages.
    Only the original payer can delete.
    """
    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    if expense.paid_by_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="Only the payer can delete this expense"
        )

    await db.delete(expense)
    await db.commit()
