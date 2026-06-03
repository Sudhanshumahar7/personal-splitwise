"""
PersonalSplitWise — FastAPI Backend
=====================================
Main application entry point.
All routes, middleware, and startup/shutdown lifecycle managed here.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import engine, Base

# Import all models so SQLAlchemy knows about them before create_all
from app.models import models  # noqa: F401

from app.routers import auth, groups, expenses, settlements, chat, dashboard
from app.websockets.chat import router as ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create DB tables on startup. Dispose engine on shutdown."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(
    title="PersonalSplitWise API",
    description="Debt tracking & expense splitting API for roommates and friend groups",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS Middleware ──────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,  # Required for HTTP-only cookie to be sent cross-origin
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── REST Routers ─────────────────────────────────────────────────────────────
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(groups.router, prefix="/api/groups", tags=["Groups"])
app.include_router(expenses.router, prefix="/api/expenses", tags=["Expenses"])
app.include_router(settlements.router, prefix="/api/settlements", tags=["Settlements"])
app.include_router(chat.router, prefix="/api/expenses", tags=["Chat"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])

# ── WebSocket Routes ─────────────────────────────────────────────────────────
app.include_router(ws_router, tags=["WebSocket"])


@app.get("/health", tags=["Health"])
async def health_check():
    """Simple health check endpoint for deployment monitoring."""
    return {"status": "ok", "service": "PersonalSplitWise API"}
