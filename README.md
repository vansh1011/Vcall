# Vcall — 1:1 Video Calling App

Two folders:
- `backend/` — Node + Express + Socket.io + Passport + Neon Postgres. Deploy to **Railway**.
- `frontend/` — React + Vite + Tailwind. Deploy to **Vercel**.

## Quick start (local)

1. Create Neon DB and run the SQL in `backend/schema.sql`.
2. `cd backend && cp .env.example .env` → fill `DATABASE_URL`, `SECRET`, `FRONTURL`. Then `npm install && npm run dev`.
3. `cd frontend && cp .env.example .env` → set `VITE_SERVER=http://localhost:8000`. Then `npm install && npm run dev`.

## Deploy

### Neon
Run `backend/schema.sql` in Neon SQL editor.

### Railway (backend)
- New project → deploy from GitHub repo (point root to `backend/`).
- Env vars: `DATABASE_URL`, `SECRET` (random 32+ chars), `FRONTURL=https://<your-vercel-domain>`, `NODE_ENV=production`, `PORT=8000`.
- Start command: `node server.js`.

### Vercel (frontend)
- Import repo, root = `frontend/`.
- Env var: `VITE_SERVER=https://<your-railway-domain>`.
- Framework preset: Vite.

After both are live, update `FRONTURL` on Railway with the real Vercel URL and redeploy.
