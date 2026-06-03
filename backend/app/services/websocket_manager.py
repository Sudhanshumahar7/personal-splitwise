"""
WebSocket Connection Manager — PersonalSplitWise
=================================================
In-memory manager that maps expense_id → Set[WebSocket].
Thread-safe broadcast with graceful stale connection cleanup.
"""

import logging
from typing import Dict, Set

from fastapi import WebSocket
from starlette.websockets import WebSocketDisconnect

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        # expense_id (str) → set of active WebSocket connections
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, expense_id: str) -> None:
        """Add an accepted WebSocket connection to the expense room."""
        if expense_id not in self.active_connections:
            self.active_connections[expense_id] = set()
        self.active_connections[expense_id].add(websocket)
        logger.info(
            f"[WS] Client connected to expense room '{expense_id}'. "
            f"Active: {len(self.active_connections[expense_id])}"
        )

    def disconnect(self, websocket: WebSocket, expense_id: str) -> None:
        """Remove a WebSocket from the expense room, cleaning up empty rooms."""
        if expense_id in self.active_connections:
            self.active_connections[expense_id].discard(websocket)
            if not self.active_connections[expense_id]:
                del self.active_connections[expense_id]
        logger.info(f"[WS] Client disconnected from expense room '{expense_id}'")

    async def broadcast(self, expense_id: str, message: dict) -> None:
        """
        Broadcast a JSON message to all active connections in an expense room.
        Stale connections (those that have disconnected abruptly) are cleaned up.
        """
        if expense_id not in self.active_connections:
            return

        stale_connections: Set[WebSocket] = set()

        for websocket in list(self.active_connections[expense_id]):
            try:
                await websocket.send_json(message)
            except (WebSocketDisconnect, RuntimeError, Exception) as e:
                logger.warning(f"[WS] Stale connection detected: {e}. Removing.")
                stale_connections.add(websocket)

        # Cleanup stale sockets
        for ws in stale_connections:
            self.disconnect(ws, expense_id)


# Singleton instance shared across all WebSocket routes
manager = ConnectionManager()
