# PersonalSplitWise — AI Context (Single Source of Truth)

This document is the single source of truth for the entire project.
All decisions here are **final and confirmed by the product owner**.
The final app must be fully buildable from this context alone.

**Deadline: 24 hours from project start.**

---

## 1. Product Goals & Splitwise Research

### Product Goals
- **Highly Reliable & Zero-Bloat**: A streamlined debt tracking application designed for maximum performance, minimal visual clutter, and rock-solid stability.
- **Absolute Data Integrity**: Guarantees perfect precision for all mathematical splits (eliminating penny-rounding errors) using `NUMERIC(12, 2)` throughout.
- **Real-Time Synchronization**: Instant state propagation across all connected clients via WebSockets to keep balances and chat up-to-date.

### Splitwise Research (Emulation & Improvements)
- **Shared Ledger**: Emulating the core shared ledger of Splitwise — a transparent, chronological stream of expenses per group.
- **Net-Balance Dashboard**: Dual-view dashboard — aggregate net balance across ALL groups (budget overview) + per-group breakdown (priority view).
- **Simplification (Single Currency)**: Hardcoded to a single base currency **INR (₹)** to eliminate conversion complexity.
- **Innovation (Expense-Level Chat)**: Real-time chat box directly inside individual expenses, allowing group members to instantly discuss and resolve split disputes.

---

## 2. User Personas, Core Workflows & MVP Scope

### User Personas
- **Primary Persona**: Roommates and friend groups splitting daily expenses (rent, groceries, utility bills, dining out).
- **UX Core Focus**: Rapid expense entry and a clean, responsive layout optimized for both mobile and desktop screens.

### Core Workflows (Priority Order)
1. **Authentication**: Sign up, log in, and secure session management.
2. **Create/Manage Groups**: Create groups, manage members, delegate member-management authority.
3. **Add Expense (with Split Logic)**: Create expenses with subset-splitting across 4 methods.
4. **View Balances**: Dual-view dashboard — aggregate net + per-group breakdown.
5. **Settle Debts**: Manual offline payment recording between group members.
6. **Real-time Chat**: Instant WebSockets-based discussion within individual expenses.

### MVP Scope (In-Scope)
- Login / Signup with JWT authentication (1-hour expiry, HTTP-only cookie).
- Group creation and member management with delegated authority model.
- Expenses with all 4 splitting methods (Equal, Exact, Percent, Share) and subset support.
- Rounding edge-case handling: excess paisa allocated to group creator for manual resolution.
- Dual dashboard: aggregate net balance + group-level balance breakdown.
- Manual settlement recording (peer-to-peer, no third-party payment gateway).
- WebSockets real-time chat inside each individual expense drawer.
- Both **Dark Mode and Light Mode** themes (Tailwind CSS v3).

### Out-of-Scope Features
- **Multi-currency**: Strictly hardcoded to INR.
- **Email Invitations**: Only already-registered users can be added to groups.
- **OCR Receipt Scanning**: No receipt image parsing or AI extraction.
- **Recurring Bills**: No automated or scheduled recurring expenses.
- **Complex Debt Simplification**: No multi-party graph-minimization. Direct peer-to-peer settlements only.
- **Mobile Native App**: Responsive web design is the goal; no React Native or PWA.

---

## 3. Data Model & Database Choice

### Database Choice & Access
- **Database**: PostgreSQL (ACID compliance, `NUMERIC` precision support).
- **ORM/Access Layer**: Python with **SQLAlchemy** (async session) over **asyncpg** driver.
- **Local Dev**: Docker Compose spins up the PostgreSQL container (no local Postgres install needed).

### Splits Storage Strategy
- **Normalized Splits**: Dedicated `expense_splits` table mapping `expense_id` + `user_id` → `owed_amount`.
- **Precision**: All financial columns use `NUMERIC(12, 2)` — no floating-point math anywhere.
- **Rounding**: When a total is not evenly divisible among selected members, the leftover paisa is flagged and attributed to the **group creator**, who decides who covers it.

### Balance Calculation Strategy
- **On-the-Fly Aggregation**: Net balances are computed dynamically via SQL aggregate queries over `expenses`, `expense_splits`, and `settlements`. No cached balance state — guarantees absolute integrity.

### Database Schema

#### `users`
| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, Default: `gen_random_uuid()` |
| `name` | VARCHAR(255) | Not Null |
| `email` | VARCHAR(255) | Not Null, Unique, Indexed |
| `hashed_password` | VARCHAR(255) | Not Null |
| `created_at` | TIMESTAMP | Default: `NOW()` |

#### `groups`
| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, Default: `gen_random_uuid()` |
| `name` | VARCHAR(255) | Not Null |
| `description` | TEXT | Nullable |
| `created_by` | UUID | FK → `users.id`, Not Null |
| `created_at` | TIMESTAMP | Default: `NOW()` |

#### `group_members` (Junction table — Many-to-Many)
| Column | Type | Constraints |
|---|---|---|
| `group_id` | UUID | FK → `groups.id`, On Delete Cascade, Composite PK |
| `user_id` | UUID | FK → `users.id`, On Delete Cascade, Composite PK |
| `role` | VARCHAR(50) | Default: `'MEMBER'` — Values: `'CREATOR'`, `'ADMIN'`, `'MEMBER'` |
| `joined_at` | TIMESTAMP | Default: `NOW()` |

> **Role Notes**: `CREATOR` is assigned to the group creator. `CREATOR` can promote any `MEMBER` to `ADMIN`. Both `CREATOR` and `ADMIN` can add or remove `MEMBER`-role users.

#### `expenses`
| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, Default: `gen_random_uuid()` |
| `group_id` | UUID | FK → `groups.id`, On Delete Cascade, Indexed, Not Null |
| `description` | VARCHAR(255) | Not Null |
| `total_amount` | NUMERIC(12, 2) | Not Null |
| `paid_by_id` | UUID | FK → `users.id`, Not Null |
| `split_method` | VARCHAR(50) | Not Null — Values: `'EQUAL'`, `'EXACT'`, `'PERCENT'`, `'SHARE'` |
| `rounding_remainder` | NUMERIC(12, 2) | Nullable — Leftover paisa when split is uneven |
| `created_at` | TIMESTAMP | Default: `NOW()` |

#### `expense_splits`
| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, Default: `gen_random_uuid()` |
| `expense_id` | UUID | FK → `expenses.id`, On Delete Cascade, Indexed |
| `user_id` | UUID | FK → `users.id`, Indexed, Not Null |
| `owed_amount` | NUMERIC(12, 2) | Not Null — Computed exact amount owed |
| `user_share_input` | NUMERIC(12, 2) | Nullable — Original input value (%, share units, exact) for audit |

#### `settlements`
| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, Default: `gen_random_uuid()` |
| `group_id` | UUID | FK → `groups.id`, On Delete Cascade, Indexed, Not Null |
| `payer_id` | UUID | FK → `users.id`, Not Null — Person paying |
| `payee_id` | UUID | FK → `users.id`, Not Null — Person receiving |
| `amount` | NUMERIC(12, 2) | Not Null |
| `settled_at` | TIMESTAMP | Default: `NOW()` |

#### `chat_messages`
| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, Default: `gen_random_uuid()` |
| `expense_id` | UUID | FK → `expenses.id`, On Delete Cascade, Indexed |
| `sender_id` | UUID | FK → `users.id`, Not Null |
| `message_text` | TEXT | Not Null |
| `sent_at` | TIMESTAMP | Default: `NOW()` |

---

## 4. Authentication & Groups

### Authentication — FINAL DECISIONS
- **Mechanism**: JWT (JSON Web Tokens) stored in **HTTP-only cookies** for XSS protection.
- **Token Expiry**: **1 hour** — finance-critical app, short-lived tokens are required.
- **Refresh Strategy**: On expiry, user is redirected to `/login` (no silent refresh in MVP).
- **Password Hashing**: `passlib[bcrypt]` for one-way password hashing.
- **Protected Routes**: All `/api/*` routes (except `/api/auth/signup` and `/api/auth/login`) require a valid JWT. Unauthenticated requests → `401 Unauthorized`.

### Group Management — FINAL DECISIONS
- **Adding Members**: Only users **already registered** in the system can be added (search by email). No email invitations.
- **Authority Model**:
  - `CREATOR` role: Full authority — add, remove, promote members to `ADMIN`.
  - `ADMIN` role: Can add and remove `MEMBER`-role users (cannot promote or remove other admins).
  - `MEMBER` role: View-only group access; cannot manage members.
- **Member Removal**: `CREATOR` and `ADMIN` can remove `MEMBER`s. `CREATOR` cannot be removed.

---

## 5. Expenses & Settlements

### Splitting Methods (All 4 — FINAL)
All methods use `NUMERIC(12, 2)` precision. Splits can be applied to a **subset** of group members (not necessarily the full group).

1. **EQUAL**: Total amount ÷ number of selected members. Each member owes the same amount.
2. **EXACT**: User manually specifies the exact amount each selected member owes. Sum of splits **must equal** total expense amount (validated server-side).
3. **PERCENT**: User specifies a percentage for each selected member. Percentages **must sum to 100%** (validated). System computes cash amounts.
4. **SHARE**: User assigns share units per selected member. System divides total proportionally by unit ratios.

### Rounding Edge Case — FINAL DECISION
- When the total is not evenly divisible among selected members, the **leftover remainder (paisa)** is stored in `expenses.rounding_remainder`.
- The UI shows this remainder to the **group creator**, who decides which member covers it.
- This is a manual decision — the backend records it as-is; the creator adjusts manually.

### Edit & Delete Rules — FINAL DECISION
- **Only the user who paid** (`paid_by_id`) can edit or delete an expense.
- Editing rewrites all records in `expense_splits`.
- Deleting cascades to `expense_splits` and `chat_messages`.

### Settlements (Repayments)
- Manual recording of direct peer-to-peer payments (e.g., "User A paid User B ₹500").
- No third-party payment gateway integration.

---

## 6. Balance Calculation & Debt Simplification

### Dynamic Calculations
Balances computed on-the-fly:
- **User owes**: Sum of `expense_splits.owed_amount` where `user_id = target`.
- **User is owed**: Sum of `expenses.total_amount` where `paid_by_id = target`.
- **Adjustments**: Add payments received from `settlements.amount` (as payee), subtract payments made (as payer).

### Dashboard — FINAL DECISION (Dual View)
- **Aggregate Card**: Total net balance across ALL groups (e.g., "You are owed ₹3,200 overall").
- **Per-Group Cards**: Each group shows its individual net balance so the user can prioritize which group to settle first.

### Debt Simplification
- **Not implemented**. Direct peer-to-peer only. No graph-minimization algorithms.

---

## 7. UI/UX, Routing & Frontend Architecture

### Frontend Tech Stack — FINAL
- **Framework**: React + **Vite** (fast HMR, optimized builds).
- **Styling**: **Tailwind CSS v3** (stable, widely supported, utility-first).
- **State Management**: **Zustand** (lightweight global store for auth context, active group, expense state).
- **Routing**: `react-router-dom` v6.

### Theme — FINAL
- **Both Dark Mode and Light Mode** supported via Tailwind's `dark:` variant and a toggle button.
- Default: Light mode on first load; preference saved to `localStorage`.
- Design style: Clean minimalist ledger interface. Modern sans-serif typography (Inter or Outfit from Google Fonts).
- Financial indicators:
  - 🟢 Emerald Green (`text-emerald-600`) for positive balances (owed to user).
  - 🔴 Muted Red (`text-red-600`) for negative balances (user owes others).

### Responsiveness
- Fully responsive web design (desktop-first, tablet-friendly, usable on mobile browser).
- **Not** a native mobile app. No React Native or PWA scope.

### Page Routing
| Route | Description |
|---|---|
| `/login` | Login page |
| `/signup` | Registration page |
| `/dashboard` | Dual balance overview + group list |
| `/groups/:id` | Group detail: ledger, members, balances |

### Dynamic Overlays & Modals
- **Add/Edit Expense Modal**: Description, amount, paid-by, split method, member subset selector, split inputs.
- **Settle Up Modal**: Peer-to-peer payment recording form.
- **Expense Details Drawer**: Triggered by clicking a ledger item. Shows:
  - Split breakdown table.
  - Rounding remainder alert (if applicable, visible to creator).
  - Real-time WebSocket chat room.

### WebSocket Connection Lifecycle
- Connection to `/ws/expenses/{expense_id}` opened **only** when the Expense Details Drawer is opened.
- Connection **immediately closed** when the drawer is closed.

---

## 8. Backend Architecture & API Design

### Backend Tech Stack — FINAL
- **Framework**: FastAPI (Python) — async endpoints + native WebSockets.
- **Database Driver**: asyncpg (async PostgreSQL).
- **ORM**: SQLAlchemy 2.0 async session.
- **Auth**: PyJWT + passlib[bcrypt].
- **Local Dev**: Docker Compose (`docker-compose.yml`) spins up PostgreSQL container.

### API Endpoints

#### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/signup` | Register new user. Returns user object. |
| POST | `/api/auth/login` | Authenticate. Returns JWT in HTTP-only cookie. |
| GET | `/api/auth/me` | Get current authenticated user context. |
| POST | `/api/auth/logout` | Clear JWT cookie. |

#### Groups
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/groups` | List all groups the current user belongs to. |
| POST | `/api/groups` | Create a new group. |
| GET | `/api/groups/{group_id}` | Get group detail + member roster. |
| POST | `/api/groups/{group_id}/members` | Add a registered user to the group (CREATOR/ADMIN only). |
| DELETE | `/api/groups/{group_id}/members/{user_id}` | Remove a member (CREATOR/ADMIN only). |
| PATCH | `/api/groups/{group_id}/members/{user_id}/role` | Promote member to ADMIN (CREATOR only). |

#### Expenses & Settlements
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/groups/{group_id}/expenses` | List all expenses in a group (chronological). |
| POST | `/api/expenses` | Add expense, compute splits, store in `expense_splits`. |
| PUT | `/api/expenses/{expense_id}` | Edit expense (payer only). Rewrites splits. |
| DELETE | `/api/expenses/{expense_id}` | Delete expense (payer only). Cascades to splits + chat. |
| POST | `/api/settlements` | Record manual peer-to-peer payment. |
| GET | `/api/groups/{group_id}/balances` | Dynamic net balance matrix for all members. |
| GET | `/api/dashboard/summary` | Aggregate net balance + per-group balance summary for dashboard. |

#### Chat (Historical)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/expenses/{expense_id}/messages` | Fetch historical chat messages for an expense. |

#### WebSocket
| Route | Description |
|---|---|
| `WS /ws/expenses/{expense_id}` | Real-time bi-directional chat room per expense. |

### WebSocket Message Flow
1. Client connects to `/ws/expenses/{expense_id}` (authenticated via token in query param or cookie).
2. Client sends JSON payload: `{ "message_text": "..." }`.
3. Backend saves message to `chat_messages` table.
4. Backend broadcasts to all active connections in the room:
```json
{
  "id": "UUID",
  "expense_id": "UUID",
  "sender_id": "UUID",
  "sender_name": "string",
  "message_text": "string",
  "sent_at": "ISO-8601 TIMESTAMP"
}
```

### ConnectionManager
- In-memory class in FastAPI: maps `expense_id` → `Set[WebSocket]`.
- Wraps all broadcast operations in `try...except WebSocketDisconnect` for graceful cleanup.

---

## 9. Local Development Setup

### Prerequisites (Already Installed)
- Python (3.11+)
- Node.js (18+)
- Docker Desktop (for Docker Compose)

### Docker Compose
- `docker-compose.yml` in project root spins up:
  - PostgreSQL container (port 5432)
  - DB name, user, password configured via `.env` (set by developer)

### Environment Variables
Backend `.env` file (developer sets their own credentials):
```
DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@localhost:5432/personalsplitwisedb
SECRET_KEY=<strong-random-secret>
ACCESS_TOKEN_EXPIRE_MINUTES=60
ALGORITHM=HS256
```

---

## 10. Deployment Plan — FINAL

| Layer | Platform | Notes |
|---|---|---|
| **Frontend** | **Vercel** | Zero-config, GitHub auto-deploy, global edge CDN |
| **Backend API** | **Render** | Native Python/FastAPI, WebSocket support, env vars |
| **Database** | **Supabase** | Managed PostgreSQL, PgBouncer connection pooling |

---

## 11. Testing Plan

- **Mathematical Engine**: `pytest` unit tests for all 4 split engines. Mock inputs, assert `owed_amount` sums match total to the paisa. Cover rounding edge cases.
- **Real-time Chat**: Manual validation with two parallel browser sessions (standard + incognito) in the same expense drawer.
- **Security Boundary**: FastAPI `TestClient` / Postman — verify `401 Unauthorized` on all protected routes without a valid JWT.

---

## 12. Known Risks & Mitigations

| Risk | Mitigation |
|---|---|
| WebSocket connection leak on browser close | Wrap all broadcast operations in `try...except WebSocketDisconnect`; clean up stale sockets |
| Decimal rounding mismatches (e.g., ₹10 ÷ 3) | Use `NUMERIC(12, 2)` everywhere; backend detects remainder and stores in `rounding_remainder`; creator resolves manually |
| JWT token not refreshed (1-hr expiry) | Redirect to `/login` on `401`; user re-authenticates (by design — finance app) |
| Unauthorized expense edit/delete | Backend checks `paid_by_id == current_user.id` before allowing PUT/DELETE |

---

## 13. Trade-offs Made

| Decision | Rationale |
|---|---|
| Dynamic balances (no cache) | Eliminates stale state and race conditions; slightly more read queries but guarantees integrity |
| Direct peer-to-peer settlements (no simplification) | Simplifies logic, avoids complex graph algorithms out of scope for 24hr deadline |
| HTTP-only cookie JWT | More secure than localStorage (XSS resistant) at the cost of minor cookie management complexity |
| Subset expense splits | More flexible than full-group splits; handles real-world scenarios where not everyone shares every expense |
| 1-hour JWT expiry | Finance app security requirement takes priority over user convenience |

---

## 14. Recent Debugging & Fixes (Session 2)
1. **Docker PostgreSQL Port Conflict**: 
   - *Issue*: Local Postgres on Windows running on 5432 conflicted with Docker container.
   - *Fix*: Mapped Docker Postgres to host port `5433:5432` in `docker-compose.yml` and updated `DATABASE_URL`.
2. **Pydantic V2 Configuration Error**: 
   - *Issue*: `.env` contained extra variables not in Pydantic schema, and strict mode rejected them.
   - *Fix*: Added `model_config = SettingsConfigDict(extra='ignore')` to `app/core/config.py`. Also changed `CORS_ORIGINS` from unquoted string to a valid JSON-formatted list in `.env`.
3. **TailwindCSS Build Error**:
   - *Issue*: Vite build failed because `@apply border-border` was used in `index.css` without defining the `border` color variable in Tailwind configuration.
   - *Fix*: Replaced `border-border` with standard Tailwind classes `border-gray-200 dark:border-slate-700` in `index.css`.
4. **Passlib bcrypt Incompatibility**:
   - *Issue*: Python backend crashed during signup with `AttributeError: module 'bcrypt' has no attribute '__about__'` due to `passlib` 1.7.4 incompatibility with `bcrypt >= 4.0`.
   - *Fix*: Completely removed `passlib` dependency in `app/core/security.py` and replaced it with direct `bcrypt` library calls (`bcrypt.hashpw`, `bcrypt.checkpw`).
5. **Vite IPv6 Localhost Proxy Issue**:
   - *Issue*: Vite proxy failed to forward `/api` requests to Uvicorn backend because Node 18+ resolves `localhost` to IPv6 `[::1]`, but Uvicorn binds to IPv4 `127.0.0.1` by default.
   - *Fix*: Updated Vite `proxy` target to explicitly use `http://127.0.0.1:8000` instead of `http://localhost:8000`.
6. **WebSocket HTTP-Only Cookie Authentication**:
   - *Issue*: WebSocket connections rejected with 403 Forbidden because JS cannot read HTTP-only cookies to pass as a query parameter (`?token=`), and Uvicorn closed the socket prematurely before accepting.
   - *Fix*: Updated `chat.py` to use `access_token: str | None = Cookie(default=None)`. We must first `await websocket.accept()` in the route *before* closing with `4001` if authentication fails. Also removed the duplicate `accept()` from the WebSocket Manager.
