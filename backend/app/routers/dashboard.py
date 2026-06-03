from fastapi import APIRouter, Depends

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.models import User
from app.services.balance_service import get_dashboard_summary
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


@router.get("/summary")
async def dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Return dual-view dashboard data:
    - aggregate_net_balance: total net balance across ALL groups
    - groups: per-group net balance breakdown for priority view
    """
    return await get_dashboard_summary(db, current_user.id)
