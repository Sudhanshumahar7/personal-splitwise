# PersonalSplitWise — Build Plan (24-Hour Execution)

This build plan outlines the development path for a **24-hour MVP sprint** of PersonalSplitWise — a debt-tracking app for roommates and friend groups.

> **Deadline**: 24 hours from project start.
> **All decisions are finalized.** See `AI_CONTEXT.md` for full specification.

---

## 1. Product Scope & Core Workflows

### Target Persona
- **Primary Persona**: Roommates and friend groups splitting daily expenses.
- **UX Core Focus**: Rapid expense entry, clean responsive layout (desktop-first, usable on mobile browser).

### Core Workflows (Priority Order)
1. **Authentication**: JWT-based sign up, login, and secure session (1-hr token, HTTP-only cookie).
2. **Group Management**: Group creation, member management with `CREATOR` / `ADMIN` / `MEMBER` role model.
3. **Expense Splitting**: Add/edit/delete expenses with 4 split methods (Equal, Exact, Percent, Share) over member subsets.
4. **Net Balance Dashboard**: Dual-view — aggregate net balance across all groups + per-group breakdown.
5. **Settle Up**: Record manual peer-to-peer payments to clear debts.
6. **Real-time Chat**: WebSocket chat room inside each individual expense drawer.

---

## 2. MVP vs. Out-of-Scope Features

### In-Scope (MVP)
- JWT authentication (HTTP-only cookie, 1-hour expiry).
- Group creation + member management with delegated `ADMIN` authority.
- Only **already-registered users** can be added to groups (no email invitations).
- Expense splitting across **subsets** of group members via all 4 methods.
- Rounding remainder handling — flagged and visible to group creator for manual resolution.
- Edit/delete permissions: **payer only** (`paid_by_id`).
- Dual dashboard: aggregate net + per-group balance cards.
- Manual settlement recording (peer-to-peer, no payment gateway).
- WebSocket real-time chat per expense.
- **Dark mode + Light mode** (Tailwind CSS v3, toggle saved to `localStorage`).
- Responsive web design (desktop-first; not a native mobile app).

### Out-of-Scope
- **Multi-currency**: Hardcoded to INR (₹).
- **Email Invitations**: No invite links; registered-only.
- **OCR Receipt Scanning**: No image parsing.
- **Recurring Expenses**: No scheduled billing.
- **Complex Debt Simplification**: No graph minimization. Direct peer-to-peer only.
- **Mobile Native / PWA**: Responsive web only.

---

## 3. Architecture & Tech Stack — FINAL

| Layer | Technology |
|---|---|
| **Backend Framework** | FastAPI (Python) — async HTTP + native WebSockets |
| **Database** | PostgreSQL — ACID, `NUMERIC(12,2)` precision |
| **ORM** | SQLAlchemy 2.0 (async session) + asyncpg driver |
| **Auth** | PyJWT + passlib[bcrypt] — JWT in HTTP-only cookie, 1-hr expiry |
| **WebSockets** | `/ws/expenses/{expense_id}` — in-memory `ConnectionManager` |
| **Local DB** | Docker Compose (PostgreSQL container) |
| **Frontend** | React + Vite |
| **Styling** | Tailwind CSS **v3** (dark mode via `dark:` variant + toggle) |
| **State** | Zustand |
| **Routing** | react-router-dom v6 |
| **Deployment** | Vercel (frontend) · Render (backend) · Supabase (PostgreSQL) |

---

## 4. Data Model & Database Schema

All financial data uses `NUMERIC(12, 2)`. Balances computed dynamically via SQL aggregates — no cached state.

| Table | Purpose |
|---|---|
| `users` | Registered users (email, hashed_password) |
| `groups` | Group metadata (name, description, created_by) |
| `group_members` | Many-to-many with `role` column: `CREATOR`, `ADMIN`, `MEMBER` |
| `expenses` | Expense metadata (who paid, amount, split method, rounding_remainder) |
| `expense_splits` | Per-member owed amounts + original input audit field |
| `settlements` | Manual peer-to-peer payment records |
| `chat_messages` | WebSocket message history per expense |

### Key Business Rules
- `rounding_remainder` on `expenses` — stores leftover paisa when split is uneven; creator resolves manually.
- `group_members.role` — `CREATOR` can promote to `ADMIN`; both can add/remove `MEMBER`s.
- Edit/delete expense → only `paid_by_id` user.

---

## 5. 24-Hour Execution Timeline

### ⏱ Phase 1 (Hours 0–4): Project Scaffolding & Dev Environment
- [ ] Create `docker-compose.yml` for PostgreSQL local dev container.
- [ ] Initialize FastAPI backend project structure:
  - `app/main.py`, `app/models/`, `app/routers/`, `app/schemas/`, `app/core/`, `app/services/`
- [ ] Configure SQLAlchemy async engine + session factory.
- [ ] Write all SQLAlchemy ORM models (all 7 tables).
- [ ] Initialize Vite + React frontend project.
- [ ] Install and configure Tailwind CSS v3 with dark mode.
- [ ] Install Zustand, react-router-dom.
- [ ] Set up page routing skeleton (`/login`, `/signup`, `/dashboard`, `/groups/:id`).

---

### ⏱ Phase 2 (Hours 4–9): Authentication & Group Management

#### Backend
- [ ] Implement `passlib[bcrypt]` password hashing utility.
- [ ] Implement JWT creation and verification (`PyJWT`, 1-hr expiry, HTTP-only cookie).
- [ ] `POST /api/auth/signup` — register user.
- [ ] `POST /api/auth/login` — authenticate, set JWT cookie.
- [ ] `GET /api/auth/me` — return current user from token.
- [ ] `POST /api/auth/logout` — clear JWT cookie.
- [ ] Auth dependency (`get_current_user`) for route protection → returns `401` if invalid/expired.
- [ ] `GET /api/groups` — list user's groups.
- [ ] `POST /api/groups` — create group, assign `CREATOR` role.
- [ ] `GET /api/groups/{group_id}` — group detail + member roster.
- [ ] `POST /api/groups/{group_id}/members` — add registered user by email (CREATOR/ADMIN only).
- [ ] `DELETE /api/groups/{group_id}/members/{user_id}` — remove member (CREATOR/ADMIN only).
- [ ] `PATCH /api/groups/{group_id}/members/{user_id}/role` — promote to ADMIN (CREATOR only).

#### Frontend
- [ ] Login page UI (`/login`) — email + password form, error handling.
- [ ] Signup page UI (`/signup`) — name, email, password form.
- [ ] Zustand auth store — `user`, `isAuthenticated`, `login()`, `logout()`.
- [ ] Protected route wrapper — redirect to `/login` on `401`.
- [ ] Dashboard page skeleton (`/dashboard`) — groups list + "Create Group" button.
- [ ] Create Group modal.
- [ ] Group detail page skeleton (`/groups/:id`) — member roster panel.
- [ ] Add Member modal (search registered users by email).

---

### ⏱ Phase 3 (Hours 9–16): Expenses, Splits & Balances

#### Backend — Split Engine
- [ ] Implement the 4 split calculation engines (pure functions, easily testable):
  - `split_equal(total, member_count)` → `[owed_amount, ...]` + remainder
  - `split_exact(total, amounts_dict)` → validate sum == total
  - `split_percent(total, percents_dict)` → validate sum == 100%, compute amounts
  - `split_share(total, shares_dict)` → proportional amounts + remainder
- [ ] Remainder detection: store in `expenses.rounding_remainder`, log which user it's attributed to.
- [ ] `pytest` unit tests for all 4 engines — verify penny-perfect sums, rounding edge cases.

#### Backend — Expense APIs
- [ ] `GET /api/groups/{group_id}/expenses` — paginated chronological list.
- [ ] `POST /api/expenses` — create expense, run split engine, write `expense_splits`.
- [ ] `PUT /api/expenses/{expense_id}` — edit (payer only), rewrite splits.
- [ ] `DELETE /api/expenses/{expense_id}` — delete (payer only), cascade splits + chat.
- [ ] `GET /api/groups/{group_id}/balances` — dynamic balance matrix (SQL aggregates).
- [ ] `GET /api/dashboard/summary` — aggregate net + per-group balances for dashboard.
- [ ] `POST /api/settlements` — record manual payment.

#### Frontend — Ledger & Forms
- [ ] Dashboard cards: aggregate net balance (big number) + per-group balance list.
- [ ] Group ledger timeline (`/groups/:id`) — chronological expense + settlement entries.
- [ ] Group balance panel — who owes whom inside this group.
- [ ] Add/Edit Expense modal:
  - Description, total amount, paid-by dropdown.
  - Split method selector (Equal / Exact / Percent / Share).
  - Member subset multi-select (only group members).
  - Dynamic split input fields based on method.
  - Client-side validation (sum checks for Exact/Percent).
  - Rounding remainder alert (shown to creator if present).
- [ ] Settle Up modal — payer → payee, amount.

---

### ⏱ Phase 4 (Hours 16–21): WebSocket Chat & Expense Drawer

#### Backend
- [ ] `ConnectionManager` class — `Dict[str, Set[WebSocket]]` (expense_id → connections).
- [ ] `WS /ws/expenses/{expense_id}` — connect, receive, save to DB, broadcast to room.
- [ ] Handle `WebSocketDisconnect` gracefully — remove stale connections.
- [ ] `GET /api/expenses/{expense_id}/messages` — fetch historical messages.

#### Frontend
- [ ] Expense Details Drawer component (triggered from ledger row click):
  - Split breakdown table.
  - Rounding remainder banner (visible to creator if `rounding_remainder > 0`).
  - WebSocket chat section.
- [ ] Chat section:
  - Fetch historical messages on drawer open (`GET /api/expenses/{expense_id}/messages`).
  - Open WS connection on drawer open; close on drawer close.
  - Message list (sender name, text, timestamp).
  - Send message input + button.
  - Auto-scroll to latest message.

---

### ⏱ Phase 5 (Hours 21–24): Polish, Deploy & Audit

#### Polish
- [ ] Dark mode toggle button (header) — saves preference to `localStorage`.
- [ ] Loading states and skeleton loaders on all data-fetching components.
- [ ] Error toast notifications (API errors, WS errors, form validation failures).
- [ ] Empty state illustrations/messages for groups list, expense list.

#### Deployment
- [ ] Backend: push to GitHub, deploy to **Render** (set env vars: `DATABASE_URL`, `SECRET_KEY`, etc.).
- [ ] Database: provision **Supabase** PostgreSQL instance, run schema migrations.
- [ ] Frontend: push to GitHub, deploy to **Vercel** (set `VITE_API_URL` env var).
- [ ] Smoke test end-to-end on deployed URLs.

#### Final Audit
- [ ] Run `pytest` split engine tests — all pass.
- [ ] Manual WebSocket test: 2 parallel browser sessions in same expense drawer.
- [ ] API security check: unauthenticated requests to `/api/groups/` → `401 Unauthorized`.
- [ ] Update `walkthrough.md` with deployment steps and architecture summary.

---

## 6. Deployment Plan — FINAL

| Layer | Platform | Notes |
|---|---|---|
| **Frontend** | **Vercel** | GitHub integration, auto-deploy, global edge CDN |
| **Backend API** | **Render** | Python/FastAPI native support, WebSocket compatible |
| **Database** | **Supabase** | Managed PostgreSQL, PgBouncer connection pooler |

### Environment Variables
```bash
# Backend (.env on Render)
DATABASE_URL=postgresql+asyncpg://<user>:<pass>@<supabase-host>:5432/<db>
SECRET_KEY=<strong-random-256-bit-key>
ACCESS_TOKEN_EXPIRE_MINUTES=60
ALGORITHM=HS256

# Frontend (.env on Vercel)
VITE_API_URL=https://<your-render-backend-url>
```

---

## 7. Testing Plan

| Test | Method |
|---|---|
| Split engine correctness | `pytest` unit tests — all 4 methods, rounding edge cases |
| Real-time chat | Manual: 2 parallel browser sessions (standard + incognito) in same expense drawer |
| Auth security boundary | Postman / `TestClient` — verify `401` on all protected routes without JWT |
| Edit/delete permission | Attempt edit as non-payer → verify `403 Forbidden` |
| Dashboard balance accuracy | Cross-check UI numbers against direct SQL queries |

---

## 8. Known Risks & Mitigations

| Risk | Mitigation |
|---|---|
| WS connection leak on browser close | `try...except WebSocketDisconnect` wrapping all broadcasts; remove from room on disconnect |
| Rounding/decimal mismatch (₹10 ÷ 3) | `NUMERIC(12,2)` everywhere; backend stores remainder; creator resolves manually |
| JWT expiry mid-session | `401` interceptor on frontend → redirect to `/login`; by design for finance app |
| Unauthorized expense edit/delete | Backend enforces `paid_by_id == current_user.id`; returns `403 Forbidden` |
| Supabase connection limits | Use PgBouncer pooler URL (transaction mode) to prevent connection exhaustion |

---
## 9. Trade-offs Made

| Decision | Rationale |
|---|---|
| Dynamic balances (no cache) | Zero stale state; integrity > read performance for MVP |
| Direct peer-to-peer settlements | Out-of-scope graph algorithms; simple and correct for 24-hr deadline |
| HTTP-only cookie JWT | XSS-resistant; finance security requirement |
| 1-hour token expiry (no silent refresh) | Security-first; re-login is acceptable for finance context |
| Subset expense splits | Real-world accuracy; not all members share every expense |
| Registered-only member invites | Avoids email service complexity; saves ~4 hours of development time |
