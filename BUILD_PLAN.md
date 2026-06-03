# PersonalSplitWise — Build Plan

## 1. Product Research

### How you studied Splitwise
- Analyzed the core user journey of adding group expenses and dividing them among friends.
- Reviewed the Splitwise UI to identify the most critical views: the dashboard (who owes whom) and the group ledger (chronological expenses).
- Evaluated pain points in the original app, specifically the lack of contextual discussion around disputed expenses.

### What you learned
- The value of an expense splitter lies in trust and transparency; absolute precision in math is paramount.
- Users want to add expenses rapidly without complex accounting rules or bloated UI.
- Real-time discussion about an expense often happens off-app (e.g., WhatsApp), indicating a missed opportunity for context-specific chat.

### What workflows you identified
1. **Authentication & Group Creation**: Creating secure accounts and forming groups with specific roommates.
2. **Adding Expenses**: Splitting bills using multiple methods (Equal, Exact, Percent, Share) across specific subsets of users.
3. **Viewing Balances**: Checking net balances across all groups and within specific groups to prioritize repayments.
4. **Settlements**: Recording manual peer-to-peer payments to clear outstanding debts.

### What product assumptions you made
- Users primarily split expenses in a single local currency (assumed INR for this MVP).
- Users prefer direct peer-to-peer settlements rather than a centralized clearing house.
- Not everyone in a group is involved in every single expense (subset splitting is mandatory).

## 2. Architecture

### Tech stack
- **Frontend**: React, Vite, Tailwind CSS v3, Zustand for state management, React Router.
- **Backend**: Python, FastAPI, SQLAlchemy 2.0 (async), WebSockets for real-time chat.
- **Database**: PostgreSQL (ACID compliance, `NUMERIC` precision support).

### Database schema
- `users`: Core identity (ID, name, email, hashed_password).
- `groups`: Group metadata.
- `group_members`: M:M junction mapping users to groups with Roles (CREATOR, ADMIN, MEMBER).
- `expenses`: Expense metadata (amount, split_method, paid_by_id, rounding_remainder).
- `expense_splits`: Precise owed amounts per user per expense.
- `settlements`: Payer, payee, and amount.
- `chat_messages`: WebSocket message history per expense.

### API design
- RESTful JSON endpoints for CRUD operations (Auth, Groups, Expenses, Settlements).
- Secure Authentication using JWT stored in HTTP-only cookies (`SameSite=None`, `Secure=True` for cross-origin cloud deployments).
- Dedicated WebSocket endpoint (`/ws/expenses/{id}`) for bi-directional real-time chat within an expense drawer.

### Frontend structure
- Single Page Application (SPA) architecture.
- **Zustand** global store for handling Authentication sessions and UI state (Toasts, Dark Mode).
- **React Router DOM** for client-side navigation, backed by `vercel.json` rewrite rules to prevent 404s on page refresh.

### Deployment approach
- **Vercel**: Hosts the static React frontend via GitHub integration.
- **Render**: Hosts the ASGI FastAPI backend (handles WebSockets and REST).
- **Supabase**: Managed PostgreSQL database utilizing the IPv4 Session Pooler connection string for compatibility with Render.

## 3. AI Collaboration Process

### How you instructed the AI
- Provided a clear 24-hour MVP sprint goal with strict architectural boundaries (FastAPI backend + React frontend).
- Mandated the creation and continuous updating of `AI_CONTEXT.md` as the single source of truth for the project.
- Provided specific debugging constraints and logs when deploying to cloud platforms (e.g., pasting Render startup logs, Supabase connection string formats, Vercel build errors).

### What questions the AI asked
- The AI asked for clarification on the exact Supabase UI configuration, specifically requesting the user to check if "Connection Pooling" was enabled and what format the connection string was in.
- The AI asked the user to manually run specific `npm install` commands in their terminal when the background execution environment lacked the correct PATH to Node.js.

### How you answered
- Provided text dumps and screenshots of the Supabase dashboard (revealing the UI update from checkboxes to radio buttons for "Session pooler").
- Confirmed Vercel live URLs so the AI could diagnose cross-origin CORS and cookie rejection issues dynamically.
- Pasted exact terminal output logs (e.g., `Rollup failed to resolve import`) so the AI could pinpoint missing dependencies in `package.json`.

### How the plan evolved
- Initially, local development was the primary focus, but as deployment commenced, the plan dynamically evolved to include necessary cloud-platform architecture fixes.
- This included switching to an IPv4 Session Pooler for Supabase (due to Render's network restrictions) and upgrading the JWT cookie policy from `SameSite=Lax` to `SameSite=None` with `Secure=True` to support cross-domain authentication between Vercel and Render.

### How AI_CONTEXT.md was maintained
- The AI was instructed to treat `AI_CONTEXT.md` as a living blueprint.
- Every major architectural decision, database schema update, and deployment breakthrough (like Vercel React Router fallback rules and Cross-Origin cookie configurations) was documented to ensure the file could be used by another developer to recreate the exact same application.

## 4. Tradeoffs

### What you simplified
- Simplified the settlement process to direct manual peer-to-peer entry rather than integrating a third-party payment gateway (like Stripe or PayPal).

### What you hardcoded
- Hardcoded the currency to INR (₹) globally to avoid real-time exchange rate complexity and multi-currency database columns.

### What you avoided
- Avoided complex graph-minimization algorithms ("Debt Simplification"). Direct peer-to-peer tracking was chosen to ensure 100% accurate, traceable ledgers for the MVP.
- Avoided email-based invitations and SMTP server configuration; users must be pre-registered on the platform before being added to a group.

### What you would improve with more time
- Implement complex debt simplification (graph minimization) to reduce the total number of transactions needed to settle a group.
- Add push notifications or email alerts for new expenses and chat messages.
- Integrate receipt scanning via OCR to automatically parse line items and assign them to specific users.
- Add multi-currency support with live exchange rate fetching for international trips.
