"""
WebSocket Chat Route — PersonalSplitWise
=========================================
Route: WS /ws/expenses/{expense_id}

Connection lifecycle:
  - Client opens connection when Expense Detail Drawer opens
  - Client sends JSON: {"message_text": "..."}
  - Backend saves to DB, broadcasts to all room connections
  - Client closes connection when Expense Detail Drawer closes

Authentication: JWT token passed as query param ?token=<jwt>
"""

import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Cookie
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import AsyncSessionLocal
from app.core.security import decode_access_token
from app.models.models import User, Expense, GroupMember, ChatMessage
from app.services.websocket_manager import manager

router = APIRouter()
logger = logging.getLogger(__name__)


async def _authenticate_ws(token: str | None) -> User | None:
    """Authenticate a WebSocket connection from query param token."""
    if not token:
        return None
    payload = decode_access_token(token)
    if not payload:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()


@router.websocket("/ws/expenses/{expense_id}")
async def websocket_chat(
    websocket: WebSocket,
    expense_id: uuid.UUID,
    access_token: str | None = Cookie(default=None),
):
    """
    WebSocket endpoint for real-time expense-level chat.
    Authentication via HTTP-only cookie access_token.
    """
    expense_id_str = str(expense_id)
    
    # We must accept the WebSocket connection before we can cleanly close it with a custom code
    await websocket.accept()

    # Authenticate
    user = await _authenticate_ws(access_token)
    if not user:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    # Verify expense exists and user is a group member
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Expense).where(Expense.id == expense_id))
        expense = result.scalar_one_or_none()

        if not expense:
            await websocket.close(code=4004, reason="Expense not found")
            return

        result = await db.execute(
            select(GroupMember).where(
                GroupMember.group_id == expense.group_id,
                GroupMember.user_id == user.id,
            )
        )
        if not result.scalar_one_or_none():
            await websocket.close(code=4003, reason="Not a group member")
            return

    # Accept and register the connection
    await manager.connect(websocket, expense_id_str)

    try:
        while True:
            data = await websocket.receive_json()
            message_text = data.get("message_text", "").strip()

            if not message_text:
                continue

            # Persist message to DB
            async with AsyncSessionLocal() as db:
                msg = ChatMessage(
                    expense_id=expense_id,
                    sender_id=user.id,
                    message_text=message_text,
                )
                db.add(msg)
                await db.commit()
                await db.refresh(msg)

            # Broadcast to all connections in this expense room
            payload = {
                "id": str(msg.id),
                "expense_id": expense_id_str,
                "sender_id": str(user.id),
                "sender_name": user.name,
                "message_text": message_text,
                "sent_at": msg.sent_at.isoformat(),
            }
            await manager.broadcast(expense_id_str, payload)

    except WebSocketDisconnect:
        manager.disconnect(websocket, expense_id_str)
        logger.info(f"[WS] User '{user.name}' disconnected from expense '{expense_id_str}'")
    except Exception as e:
        logger.error(f"[WS] Unexpected error: {e}")
        manager.disconnect(websocket, expense_id_str)
