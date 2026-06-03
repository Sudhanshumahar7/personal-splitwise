"""
Unit Tests — Split Engine
==========================
Tests all 4 split calculation methods:
  - split_equal
  - split_exact
  - split_percent
  - split_share

All tests verify:
  1. Penny-perfect sum accuracy (sum of splits == total)
  2. Correct individual amounts
  3. Rounding edge cases (₹10 ÷ 3, ₹100 ÷ 7, etc.)
  4. Validation errors on bad inputs

Run: cd backend && pytest tests/ -v
"""

import uuid
from decimal import Decimal

import pytest

from app.services.split_engine import (
    split_equal,
    split_exact,
    split_percent,
    split_share,
    calculate_splits,
)
from app.schemas.expenses import SplitInput


# ── Test Helpers ──────────────────────────────────────────────────────────────

def make_split(user_id: str, value: float) -> SplitInput:
    return SplitInput(user_id=uuid.UUID(user_id), value=Decimal(str(value)))


def D(val: float) -> Decimal:
    return Decimal(str(val))


USER_A = "00000000-0000-0000-0000-000000000001"
USER_B = "00000000-0000-0000-0000-000000000002"
USER_C = "00000000-0000-0000-0000-000000000003"


# ── EQUAL Split Tests ─────────────────────────────────────────────────────────

class TestSplitEqual:
    def test_equal_2_members(self):
        splits, remainder = split_equal(D(200), [USER_A, USER_B])
        assert splits[USER_A] == D(100)
        assert splits[USER_B] == D(100)
        assert remainder == D(0)
        assert sum(splits.values()) + remainder == D(200)

    def test_equal_3_members_clean(self):
        splits, remainder = split_equal(D(300), [USER_A, USER_B, USER_C])
        assert splits[USER_A] == D(100)
        assert splits[USER_B] == D(100)
        assert splits[USER_C] == D(100)
        assert remainder == D(0)

    def test_equal_rounding_10_among_3(self):
        """₹10 ÷ 3 = ₹3.33 each + ₹0.01 remainder"""
        splits, remainder = split_equal(D(10), [USER_A, USER_B, USER_C])
        assert splits[USER_A] == D("3.33")
        assert splits[USER_B] == D("3.33")
        assert splits[USER_C] == D("3.33")
        assert remainder == D("0.01")
        assert sum(splits.values()) + remainder == D(10)

    def test_equal_rounding_100_among_7(self):
        """₹100 ÷ 7 = ₹14.28 each + ₹0.04 remainder"""
        members = [str(uuid.uuid4()) for _ in range(7)]
        splits, remainder = split_equal(D(100), members)
        total = sum(splits.values()) + remainder
        assert total == D(100), f"Total {total} != 100"
        for uid in members:
            assert splits[uid] == D("14.28")

    def test_equal_single_member(self):
        splits, remainder = split_equal(D(500), [USER_A])
        assert splits[USER_A] == D(500)
        assert remainder == D(0)

    def test_equal_no_members_raises(self):
        with pytest.raises(ValueError, match="At least one member"):
            split_equal(D(100), [])


# ── EXACT Split Tests ─────────────────────────────────────────────────────────

class TestSplitExact:
    def test_exact_valid(self):
        splits_input = [
            make_split(USER_A, 150),
            make_split(USER_B, 50),
        ]
        splits, remainder = split_exact(D(200), splits_input)
        assert splits[USER_A] == D(150)
        assert splits[USER_B] == D(50)
        assert remainder == D(0)

    def test_exact_three_members(self):
        splits_input = [
            make_split(USER_A, 100),
            make_split(USER_B, 75),
            make_split(USER_C, 25),
        ]
        splits, remainder = split_exact(D(200), splits_input)
        assert sum(splits.values()) == D(200)

    def test_exact_wrong_sum_raises(self):
        """Should raise when amounts don't sum to total."""
        splits_input = [
            make_split(USER_A, 100),
            make_split(USER_B, 50),
        ]
        with pytest.raises(ValueError, match="₹150.00"):
            split_exact(D(200), splits_input)

    def test_exact_sum_integrity(self):
        splits_input = [
            make_split(USER_A, 333.33),
            make_split(USER_B, 333.33),
            make_split(USER_C, 333.34),
        ]
        splits, remainder = split_exact(D(1000), splits_input)
        # Each user has their exact amount (within 1 paisa of total)
        assert abs(sum(splits.values()) - D(1000)) <= D("0.01")


# ── PERCENT Split Tests ───────────────────────────────────────────────────────

class TestSplitPercent:
    def test_percent_50_50(self):
        splits_input = [
            make_split(USER_A, 50),
            make_split(USER_B, 50),
        ]
        splits, remainder = split_percent(D(200), splits_input)
        assert splits[USER_A] == D(100)
        assert splits[USER_B] == D(100)
        assert remainder == D(0)

    def test_percent_60_40(self):
        splits_input = [
            make_split(USER_A, 60),
            make_split(USER_B, 40),
        ]
        splits, _ = split_percent(D(1000), splits_input)
        assert splits[USER_A] == D(600)
        assert splits[USER_B] == D(400)

    def test_percent_three_members_sum_integrity(self):
        """33.33 + 33.33 + 33.34 = 100%"""
        splits_input = [
            make_split(USER_A, 33.33),
            make_split(USER_B, 33.33),
            make_split(USER_C, 33.34),
        ]
        splits, remainder = split_percent(D(300), splits_input)
        total = sum(splits.values()) + remainder
        assert total == D(300), f"Sum {total} != 300"

    def test_percent_wrong_sum_raises(self):
        splits_input = [
            make_split(USER_A, 60),
            make_split(USER_B, 30),  # only 90%
        ]
        with pytest.raises(ValueError, match="100%"):
            split_percent(D(100), splits_input)


# ── SHARE Split Tests ─────────────────────────────────────────────────────────

class TestSplitShare:
    def test_share_2_to_1(self):
        """A has 2 shares, B has 1 share → A pays 2/3, B pays 1/3"""
        splits_input = [
            make_split(USER_A, 2),
            make_split(USER_B, 1),
        ]
        splits, remainder = split_share(D(300), splits_input)
        assert splits[USER_A] == D(200)
        assert splits[USER_B] == D(100)
        assert remainder == D(0)

    def test_share_uneven_total_integrity(self):
        """₹100 across 3 shares (1, 1, 1): each gets ₹33.33 + ₹0.01 remainder"""
        splits_input = [
            make_split(USER_A, 1),
            make_split(USER_B, 1),
            make_split(USER_C, 1),
        ]
        splits, remainder = split_share(D(100), splits_input)
        total = sum(splits.values()) + remainder
        assert total == D(100)

    def test_share_zero_raises(self):
        splits_input = [make_split(USER_A, 0), make_split(USER_B, 0)]
        with pytest.raises(ValueError, match="greater than 0"):
            split_share(D(100), splits_input)


# ── calculate_splits Dispatcher ───────────────────────────────────────────────

class TestCalculateSplits:
    def test_dispatch_equal(self):
        splits_input = [make_split(USER_A, 0), make_split(USER_B, 0)]
        splits, _ = calculate_splits(D(200), "EQUAL", splits_input)
        assert splits[USER_A] == D(100)

    def test_dispatch_unknown_raises(self):
        with pytest.raises(ValueError, match="Unknown split method"):
            calculate_splits(D(100), "INVALID", [])
