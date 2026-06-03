# PersonalSplitWise 🚀

A modern, dynamic web application to track shared expenses and settle debts seamlessly among friends, roommates, or travel groups. Features real-time expense-level chat and dynamic net balance computation.

Built with **FastAPI** (Python) and **React** (Vite, Tailwind CSS, Zustand).

## 🌟 Key Features

1. **Authentication:** Secure JWT-based auth via HTTP-only cookies.
2. **Group Management:** Create groups and add registered members with role-based access (Creator, Admin, Member).
3. **Expense Splitting Engine:** 
   - **Equal:** Split evenly among selected members.
   - **Exact:** Specify exact penny-perfect amounts.
   - **Percent:** Split by exact percentages.
   - **Shares:** Split proportionally (e.g. 2 shares to 1).
4. **Dynamic Balances:** SQL-driven aggregate net balance computation. No stale cache.
5. **Dual-View Dashboard:** See your overall net balance across all groups, plus a per-group breakdown.
6. **Real-time Chat:** WebSocket-based chat room for *each specific expense*. Discuss details contextually!
7. **Premium UI/UX:** Built with Tailwind CSS v3, featuring a beautiful dark mode, micro-animations, and responsive glassmorphism.

---

## 🛠 Tech Stack

**Frontend:**
- React 18, Vite
- Tailwind CSS v3
- Zustand (Global State Management)
- React Router v6
- Axios
- date-fns

**Backend:**
- Python 3.10+, FastAPI
- SQLAlchemy (Async), PostgreSQL
- Pydantic (Data validation)
- Passlib, Bcrypt (Password hashing)
- PyJWT (Authentication)
- WebSockets

---

## 🚀 Getting Started (Local Development)

### 1. Database Setup
Ensure you have Docker Desktop installed. Start the PostgreSQL database:
```bash
docker compose up -d
```
*This starts a Postgres instance on port 5432 with default credentials.*

### 2. Backend Setup
```bash
cd backend
py -3.11 -m venv venv

# Windows
venv\Scripts\activate
# Mac/Linux
source venv/bin/activate

pip install -r requirements.txt

# Copy the environment file
cp .env.example .env
```

Start the FastAPI server:
```bash
uvicorn app.main:app --reload
```
*Backend runs on `http://localhost:8000`. Swagger UI at `http://localhost:8000/docs`.*

### 3. Frontend Setup
Open a new terminal window:
```bash
cd frontend
npm install

# Start the Vite dev server
npm run dev
```
*Frontend runs on `http://localhost:5173`.*

> **Note:** The frontend uses Vite's built-in proxy to route `/api` and `/ws` to `localhost:8000`, solving CORS issues and allowing HTTP-only cookies to work seamlessly in local development.

---

## 🧪 Running Tests
The core split engine handles complex monetary math (exact penny splits, rounding logic). It has comprehensive Pytest coverage.

```bash
cd backend
venv\Scripts\activate
pytest tests/ -v
```

---

## 🚀 Deployment Strategy

### Database: Supabase
1. Create a free Supabase project.
2. Get the PostgreSQL connection string (Transaction Pooler).
3. Set `DATABASE_URL` in the backend environment.

### Backend: Render
1. Connect Render to your GitHub repository.
2. Select **Web Service** -> Python.
3. Build Command: `pip install -r requirements.txt`
4. Start Command: `uvicorn app.main:app --host 0.0.0.0 --port 10000`
5. Add environment variables: `DATABASE_URL`, `SECRET_KEY`, `CORS_ORIGINS` (point to Vercel URL).

### Frontend: Vercel
1. Connect Vercel to your GitHub repository.
2. Framework Preset: **Vite**.
3. Build Command: `npm run build`
4. Add environment variable: `VITE_API_URL` (point to Render backend URL).

*(Note: In production, since Vercel and Render are on different domains, ensure `secure=True` is set for the JWT cookie in `backend/app/routers/auth.py`, and `SameSite='none'` if strictly required, though a custom domain setup is recommended for HTTP-only cookies.)*

