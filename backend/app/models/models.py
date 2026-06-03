"""
SQLAlchemy ORM Models for PersonalSplitWise.

All financial columns use NUMERIC(12, 2) for exact decimal precision.
UUIDs are used for all primary keys.
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Column,
    String,
    Text,
    ForeignKey,
    Numeric,
    func,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship
from sqlalchemy.types import TIMESTAMP

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, unique=True, index=True)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    created_groups = relationship(
        "Group", back_populates="creator", foreign_keys="Group.created_by"
    )
    group_memberships = relationship("GroupMember", back_populates="user")
    paid_expenses = relationship(
        "Expense", back_populates="paid_by", foreign_keys="Expense.paid_by_id"
    )
    expense_splits = relationship("ExpenseSplit", back_populates="user")
    sent_settlements = relationship(
        "Settlement", back_populates="payer", foreign_keys="Settlement.payer_id"
    )
    received_settlements = relationship(
        "Settlement", back_populates="payee", foreign_keys="Settlement.payee_id"
    )
    chat_messages = relationship("ChatMessage", back_populates="sender")


class Group(Base):
    __tablename__ = "groups"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_by = Column(
        PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    creator = relationship(
        "User", back_populates="created_groups", foreign_keys=[created_by]
    )
    members = relationship(
        "GroupMember", back_populates="group", cascade="all, delete-orphan"
    )
    expenses = relationship(
        "Expense", back_populates="group", cascade="all, delete-orphan"
    )
    settlements = relationship(
        "Settlement", back_populates="group", cascade="all, delete-orphan"
    )


class GroupMember(Base):
    """
    Junction table for the many-to-many relationship between Users and Groups.
    role: CREATOR | ADMIN | MEMBER
    - CREATOR: full authority, cannot be removed
    - ADMIN: can add/remove MEMBER-role users
    - MEMBER: view-only group access
    """

    __tablename__ = "group_members"

    group_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("groups.id", ondelete="CASCADE"),
        primary_key=True,
    )
    user_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    role = Column(String(50), nullable=False, default="MEMBER")
    joined_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    group = relationship("Group", back_populates="members")
    user = relationship("User", back_populates="group_memberships")


class Expense(Base):
    """
    Expense metadata. The payer paid the full total_amount.
    Splits are stored in expense_splits.
    rounding_remainder: leftover paisa when split is uneven — group creator resolves manually.
    """

    __tablename__ = "expenses"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("groups.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    description = Column(String(255), nullable=False)
    total_amount = Column(Numeric(12, 2), nullable=False)
    paid_by_id = Column(
        PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    split_method = Column(String(50), nullable=False)  # EQUAL | EXACT | PERCENT | SHARE
    rounding_remainder = Column(Numeric(12, 2), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    group = relationship("Group", back_populates="expenses")
    paid_by = relationship(
        "User", back_populates="paid_expenses", foreign_keys=[paid_by_id]
    )
    splits = relationship(
        "ExpenseSplit", back_populates="expense", cascade="all, delete-orphan"
    )
    chat_messages = relationship(
        "ChatMessage", back_populates="expense", cascade="all, delete-orphan"
    )


class ExpenseSplit(Base):
    """
    Per-member owed amounts for each expense.
    owed_amount: computed exact amount this user owes (NUMERIC(12,2))
    user_share_input: original input for audit trail (%, share units, or exact amount)
    """

    __tablename__ = "expense_splits"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    expense_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("expenses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    owed_amount = Column(Numeric(12, 2), nullable=False)
    user_share_input = Column(Numeric(12, 2), nullable=True)

    # Relationships
    expense = relationship("Expense", back_populates="splits")
    user = relationship("User", back_populates="expense_splits")


class Settlement(Base):
    """
    Manual peer-to-peer payment record.
    payer_id paid payee_id the given amount.
    """

    __tablename__ = "settlements"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("groups.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    payer_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    payee_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    settled_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    group = relationship("Group", back_populates="settlements")
    payer = relationship(
        "User", back_populates="sent_settlements", foreign_keys=[payer_id]
    )
    payee = relationship(
        "User", back_populates="received_settlements", foreign_keys=[payee_id]
    )


class ChatMessage(Base):
    """Real-time WebSocket chat messages scoped per expense."""

    __tablename__ = "chat_messages"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    expense_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("expenses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sender_id = Column(
        PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    message_text = Column(Text, nullable=False)
    sent_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    expense = relationship("Expense", back_populates="chat_messages")
    sender = relationship("User", back_populates="chat_messages")
