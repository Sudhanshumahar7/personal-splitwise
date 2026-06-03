import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.models import User, Group, GroupMember
from app.schemas.groups import (
    GroupCreate,
    GroupResponse,
    AddMemberRequest,
    UpdateMemberRoleRequest,
)
from app.services.balance_service import get_group_balances

router = APIRouter()


async def _get_member_role(
    db: AsyncSession, group_id: uuid.UUID, user_id: uuid.UUID
) -> str | None:
    """Helper — get a user's role in a group, or None if not a member."""
    result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id,
        )
    )
    member = result.scalar_one_or_none()
    return member.role if member else None


async def _get_group_with_members(db: AsyncSession, group_id: uuid.UUID) -> Group:
    """Fetch a group with its member roster eagerly loaded."""
    result = await db.execute(
        select(Group)
        .where(Group.id == group_id)
        .options(selectinload(Group.members).selectinload(GroupMember.user))
    )
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return group


# ── Routes ─────────────────────────────────────────────────────────────────


@router.get("", response_model=List[GroupResponse])
async def list_groups(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all groups the current user belongs to."""
    result = await db.execute(
        select(Group)
        .join(GroupMember, Group.id == GroupMember.group_id)
        .where(GroupMember.user_id == current_user.id)
        .options(selectinload(Group.members).selectinload(GroupMember.user))
        .order_by(Group.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=GroupResponse, status_code=status.HTTP_201_CREATED)
async def create_group(
    group_data: GroupCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new group. Creator is automatically added with CREATOR role."""
    group = Group(
        name=group_data.name,
        description=group_data.description,
        created_by=current_user.id,
    )
    db.add(group)
    await db.flush()  # Get the generated group.id

    # Add creator as CREATOR role member
    creator_member = GroupMember(
        group_id=group.id,
        user_id=current_user.id,
        role="CREATOR",
    )
    db.add(creator_member)
    await db.commit()

    return await _get_group_with_members(db, group.id)


@router.get("/{group_id}", response_model=GroupResponse)
async def get_group(
    group_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get full group details including member roster."""
    role = await _get_member_role(db, group_id, current_user.id)
    if not role:
        raise HTTPException(status_code=403, detail="You are not a member of this group")
    return await _get_group_with_members(db, group_id)


@router.get("/{group_id}/balances")
async def get_balances(
    group_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get dynamic net balance matrix for all group members."""
    role = await _get_member_role(db, group_id, current_user.id)
    if not role:
        raise HTTPException(status_code=403, detail="You are not a member of this group")
    return await get_group_balances(db, group_id)


@router.post("/{group_id}/members", status_code=status.HTTP_201_CREATED)
async def add_member(
    group_id: uuid.UUID,
    request: AddMemberRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a registered user to the group (CREATOR or ADMIN only)."""
    current_role = await _get_member_role(db, group_id, current_user.id)
    if current_role not in ("CREATOR", "ADMIN"):
        raise HTTPException(
            status_code=403, detail="Only CREATOR or ADMIN can add members"
        )

    # Find the user by email
    result = await db.execute(select(User).where(User.email == request.email))
    new_user = result.scalar_one_or_none()
    if not new_user:
        raise HTTPException(
            status_code=404,
            detail="User not found. They must be registered first.",
        )

    # Check not already a member
    existing_role = await _get_member_role(db, group_id, new_user.id)
    if existing_role:
        raise HTTPException(
            status_code=400, detail="This user is already a member of the group"
        )

    member = GroupMember(
        group_id=group_id,
        user_id=new_user.id,
        role="MEMBER",
    )
    db.add(member)
    await db.commit()
    return {"message": f"{new_user.name} has been added to the group"}


@router.delete("/{group_id}/members/{user_id}", status_code=status.HTTP_200_OK)
async def remove_member(
    group_id: uuid.UUID,
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a member from a group (CREATOR or ADMIN only)."""
    current_role = await _get_member_role(db, group_id, current_user.id)
    if current_role not in ("CREATOR", "ADMIN"):
        raise HTTPException(
            status_code=403, detail="Only CREATOR or ADMIN can remove members"
        )

    target_role = await _get_member_role(db, group_id, user_id)
    if not target_role:
        raise HTTPException(status_code=404, detail="User is not a member of this group")

    if target_role == "CREATOR":
        raise HTTPException(status_code=400, detail="The group creator cannot be removed")

    if current_role == "ADMIN" and target_role == "ADMIN":
        raise HTTPException(
            status_code=403, detail="ADMINs cannot remove other ADMINs"
        )

    result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id, GroupMember.user_id == user_id
        )
    )
    member = result.scalar_one()
    await db.delete(member)
    await db.commit()
    return {"message": "Member removed from the group"}


@router.patch("/{group_id}/members/{user_id}/role")
async def update_member_role(
    group_id: uuid.UUID,
    user_id: uuid.UUID,
    request: UpdateMemberRoleRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Promote or demote a member's role (CREATOR only)."""
    current_role = await _get_member_role(db, group_id, current_user.id)
    if current_role != "CREATOR":
        raise HTTPException(
            status_code=403, detail="Only the CREATOR can change member roles"
        )

    if request.role not in ("ADMIN", "MEMBER"):
        raise HTTPException(
            status_code=400, detail="Role must be 'ADMIN' or 'MEMBER'"
        )

    result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id, GroupMember.user_id == user_id
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="User is not a member of this group")

    if member.role == "CREATOR":
        raise HTTPException(status_code=400, detail="Cannot change the CREATOR role")

    member.role = request.role
    await db.commit()
    return {"message": f"Role updated to {request.role}"}
