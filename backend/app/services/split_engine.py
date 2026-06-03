"""
Split Engine — PersonalSplitWise
=================================
Handles all 4 split calculation methods with NUMERIC(12, 2) precision.
No floating-point math. All calculations use Python's Decimal type.

Rounding strategy:
- Amounts are rounded DOWN to 2 decimal places (ROUND_DOWN).
- The remainder (if any) is returned separately for the group creator to resolve.

Methods:
  split_equal   — divide total equally among N members
  split_exact   — validate user-provided exact amounts
  split_percent — percentage-based split (must sum to 100%)
  split_share   — proportional split by share units

All methods return:
  (splits_map: Dict[str, Decimal], remainder: Decimal)
  where splits_map maps user_id (str) -> owed_amount (Decimal)
"""

from decimal import Decimal, ROUND_DOWN
from typing import Dict, List, Tuple

from app.schemas.expenses import SplitInput

TWO_PLACES = Decimal("0.01")
ZERO = Decimal("0.00")


def _quantize(value: Decimal) -> Decimal:
    """Round a Decimal down to 2 decimal places."""
    return value.quantize(TWO_PLACES, rounding=ROUND_DOWN)


def split_equal(
    total: Decimal, member_ids: List[str]
) -> Tuple[Dict[str, Decimal], Decimal]:
    """
    Divide total equally among all members.
    Leftover paisa (if total not perfectly divisible) returned as remainder.
    """
    n = len(member_ids)
    if n == 0:
        raise ValueError("At least one member is required for a split")

    per_person = _quantize(total / n)
    total_distributed = per_person * n
    remainder = total - total_distributed

    splits = {uid: per_person for uid in member_ids}
    return splits, remainder


def split_exact(
    total: Decimal, splits: List[SplitInput]
) -> Tuple[Dict[str, Decimal], Decimal]:
    """
    Validate user-provided exact amounts.
    Sum of all splits must equal total (within ₹0.01 tolerance for rounding).
    """
    total_assigned = sum(_quantize(s.value) for s in splits)
    remainder = total - total_assigned

    if abs(remainder) > Decimal("0.01"):
        raise ValueError(
            f"Exact amounts sum to ₹{total_assigned:.2f}, "
            f"but expense total is ₹{total:.2f}. Difference: ₹{abs(remainder):.2f}"
        )

    result = {str(s.user_id): _quantize(s.value) for s in splits}
    return result, ZERO


def split_percent(
    total: Decimal, splits: List[SplitInput]
) -> Tuple[Dict[str, Decimal], Decimal]:
    """
    Split by percentage. All percentages must sum to 100% (within 0.01% tolerance).
    The last member absorbs any rounding remainder.
    """
    total_pct = sum(s.value for s in splits)
    if abs(total_pct - Decimal("100")) > Decimal("0.01"):
        raise ValueError(
            f"Percentages must sum to 100%. Currently: {total_pct:.2f}%"
        )

    result: Dict[str, Decimal] = {}
    total_distributed = ZERO

    for i, s in enumerate(splits):
        uid = str(s.user_id)
        if i == len(splits) - 1:
            # Last member gets the exact remainder to prevent cumulative rounding loss
            amount = _quantize(total - total_distributed)
        else:
            amount = _quantize(total * s.value / Decimal("100"))
            total_distributed += amount
        result[uid] = amount

    remainder = total - sum(result.values())
    return result, remainder


def split_share(
    total: Decimal, splits: List[SplitInput]
) -> Tuple[Dict[str, Decimal], Decimal]:
    """
    Split proportionally by share units.
    e.g., A=2 shares, B=1 share → A pays 2/3, B pays 1/3.
    The last member absorbs any rounding remainder.
    """
    total_shares = sum(s.value for s in splits)
    if total_shares <= ZERO:
        raise ValueError("Total shares must be greater than 0")

    result: Dict[str, Decimal] = {}
    total_distributed = ZERO

    for i, s in enumerate(splits):
        uid = str(s.user_id)
        if i == len(splits) - 1:
            amount = _quantize(total - total_distributed)
        else:
            amount = _quantize(total * s.value / total_shares)
            total_distributed += amount
        result[uid] = amount

    remainder = total - sum(result.values())
    return result, remainder


def calculate_splits(
    total: Decimal,
    method: str,
    splits: List[SplitInput],
) -> Tuple[Dict[str, Decimal], Decimal]:
    """
    Entry point — dispatches to the correct split engine based on method.
    Returns (splits_map, remainder).
    """
    if method == "EQUAL":
        return split_equal(total, [str(s.user_id) for s in splits])
    elif method == "EXACT":
        return split_exact(total, splits)
    elif method == "PERCENT":
        return split_percent(total, splits)
    elif method == "SHARE":
        return split_share(total, splits)
    else:
        raise ValueError(f"Unknown split method: {method}")
