"""
Balance Service — PersonalSplitWise
=====================================
Computes net balance matrices dynamically via SQL aggregates.
No cached state — guaranteed accuracy and zero stale data.

Key logic:
  - raw_debt: For each expense, the payer is owed money by each non-payer split member.
  - raw_settlement: Settlements reduce debts between pairs.
  - net_owed: raw_debt - settlement = what still needs to be paid.

Per-user net balance (for dashboard):
  net = (total paid for others) - (total owed to others by self) + settlements
"""

import uuid
from decimal import Decimal
from typing import Dict, List, Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text


async def get_group_balances(
    db: AsyncSession, group_id: uuid.UUID
) -> Dict[str, Any]:
    """
    Returns the full balance matrix for a group:
    - member_balances: each member's net balance within the group
    - debts: list of {debtor, creditor, amount} pairs showing who owes whom
    """

    # ── Member net balances ────────────────────────────────────────────────
    member_balance_query = text("""
        WITH
        paid_out AS (
            -- Total amount each user PAID for the group (total expense amounts)
            SELECT e.paid_by_id AS user_id, SUM(e.total_amount) AS amount
            FROM expenses e
            WHERE e.group_id = :group_id
            GROUP BY e.paid_by_id
        ),
        owed AS (
            -- Total amount each user OWES (their splits, excluding their own paid expenses)
            SELECT es.user_id, SUM(es.owed_amount) AS amount
            FROM expense_splits es
            JOIN expenses e ON es.expense_id = e.id
            WHERE e.group_id = :group_id
            GROUP BY es.user_id
        ),
        settled_as_payer AS (
            -- Total settlements each user made (they paid someone)
            SELECT payer_id AS user_id, SUM(amount) AS amount
            FROM settlements
            WHERE group_id = :group_id
            GROUP BY payer_id
        ),
        settled_as_payee AS (
            -- Total settlements each user received
            SELECT payee_id AS user_id, SUM(amount) AS amount
            FROM settlements
            WHERE group_id = :group_id
            GROUP BY payee_id
        ),
        all_members AS (
            SELECT DISTINCT user_id FROM group_members WHERE group_id = :group_id
        )
        SELECT
            m.user_id,
            u.name,
            u.email,
            COALESCE(po.amount, 0)
            - COALESCE(ow.amount, 0)
            + COALESCE(sp.amount, 0)
            - COALESCE(sr.amount, 0) AS net_balance
        FROM all_members m
        JOIN users u ON u.id = m.user_id
        LEFT JOIN paid_out po ON po.user_id = m.user_id
        LEFT JOIN owed ow ON ow.user_id = m.user_id
        LEFT JOIN settled_as_payee sp ON sp.user_id = m.user_id
        LEFT JOIN settled_as_payer sr ON sr.user_id = m.user_id
        ORDER BY net_balance DESC
    """)

    # ── Pairwise debts ────────────────────────────────────────────────────
    debt_query = text("""
        WITH
        raw_debts AS (
            SELECT
                es.user_id        AS debtor_id,
                e.paid_by_id      AS creditor_id,
                SUM(es.owed_amount) AS gross_debt
            FROM expense_splits es
            JOIN expenses e ON es.expense_id = e.id
            WHERE e.group_id = :group_id
              AND es.user_id != e.paid_by_id
            GROUP BY es.user_id, e.paid_by_id
        ),
        raw_settlements AS (
            SELECT payer_id AS debtor_id, payee_id AS creditor_id, SUM(amount) AS settled
            FROM settlements
            WHERE group_id = :group_id
            GROUP BY payer_id, payee_id
        )
        SELECT
            rd.debtor_id,
            du.name  AS debtor_name,
            du.email AS debtor_email,
            rd.creditor_id,
            cu.name  AS creditor_name,
            cu.email AS creditor_email,
            rd.gross_debt - COALESCE(rs.settled, 0) AS net_amount
        FROM raw_debts rd
        JOIN users du ON du.id = rd.debtor_id
        JOIN users cu ON cu.id = rd.creditor_id
        LEFT JOIN raw_settlements rs
            ON rs.debtor_id = rd.debtor_id AND rs.creditor_id = rd.creditor_id
        WHERE rd.gross_debt - COALESCE(rs.settled, 0) > 0.00
        ORDER BY net_amount DESC
    """)

    group_id_str = str(group_id)

    balance_result = await db.execute(member_balance_query, {"group_id": group_id_str})
    debt_result = await db.execute(debt_query, {"group_id": group_id_str})

    member_balances = [
        {
            "user_id": str(row.user_id),
            "name": row.name,
            "email": row.email,
            "net_balance": float(row.net_balance),
        }
        for row in balance_result.fetchall()
    ]

    debts = [
        {
            "debtor": {
                "id": str(row.debtor_id),
                "name": row.debtor_name,
                "email": row.debtor_email,
            },
            "creditor": {
                "id": str(row.creditor_id),
                "name": row.creditor_name,
                "email": row.creditor_email,
            },
            "amount": float(row.net_amount),
        }
        for row in debt_result.fetchall()
    ]

    return {"member_balances": member_balances, "debts": debts}


async def get_dashboard_summary(
    db: AsyncSession, user_id: uuid.UUID
) -> Dict[str, Any]:
    """
    Returns aggregate net balance across ALL groups + per-group balance breakdown.
    Used for the dual-view dashboard.
    """

    summary_query = text("""
        WITH user_groups AS (
            SELECT group_id FROM group_members WHERE user_id = :user_id
        ),
        paid_out AS (
            SELECT e.group_id, SUM(e.total_amount) AS amount
            FROM expenses e
            WHERE e.paid_by_id = :user_id AND e.group_id IN (SELECT group_id FROM user_groups)
            GROUP BY e.group_id
        ),
        owed AS (
            SELECT e.group_id, SUM(es.owed_amount) AS amount
            FROM expense_splits es
            JOIN expenses e ON es.expense_id = e.id
            WHERE es.user_id = :user_id AND e.group_id IN (SELECT group_id FROM user_groups)
            GROUP BY e.group_id
        ),
        settled_payer AS (
            SELECT group_id, SUM(amount) AS amount
            FROM settlements
            WHERE payer_id = :user_id AND group_id IN (SELECT group_id FROM user_groups)
            GROUP BY group_id
        ),
        settled_payee AS (
            SELECT group_id, SUM(amount) AS amount
            FROM settlements
            WHERE payee_id = :user_id AND group_id IN (SELECT group_id FROM user_groups)
            GROUP BY group_id
        )
        SELECT
            g.id         AS group_id,
            g.name       AS group_name,
            g.description,
            COALESCE(po.amount, 0)
            - COALESCE(ow.amount, 0)
            + COALESCE(sp.amount, 0)
            - COALESCE(sr.amount, 0) AS my_net_balance
        FROM groups g
        JOIN user_groups ug ON ug.group_id = g.id
        LEFT JOIN paid_out po  ON po.group_id  = g.id
        LEFT JOIN owed ow      ON ow.group_id   = g.id
        LEFT JOIN settled_payee sp ON sp.group_id = g.id
        LEFT JOIN settled_payer sr ON sr.group_id = g.id
        ORDER BY my_net_balance DESC
    """)

    user_id_str = str(user_id)
    result = await db.execute(summary_query, {"user_id": user_id_str})
    rows = result.fetchall()

    groups_summary = [
        {
            "group_id": str(row.group_id),
            "group_name": row.group_name,
            "description": row.description,
            "my_net_balance": float(row.my_net_balance),
        }
        for row in rows
    ]

    aggregate_net_balance = sum(g["my_net_balance"] for g in groups_summary)

    return {
        "aggregate_net_balance": aggregate_net_balance,
        "groups": groups_summary,
    }
