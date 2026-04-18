# Deploy on Hugging Face Spaces + Supabase (No Docker)

This guide focuses on running backend directly on Hugging Face native runtime (no Docker), with PostgreSQL on Supabase.

Current practical topology:
- Backend: Hugging Face Space native Python runtime (FastAPI)
- Database: Supabase PostgreSQL
- Frontend: deploy separately (recommended Vercel/Netlify) and point to backend HF URL

## 1) Create Supabase database URL

In Supabase:
1. Open Project Settings -> Database.
2. Copy Connection string (URI) for direct connection.
3. Ensure `sslmode=require` is present in the URI.

Example:
`postgresql://postgres:YOUR_PASSWORD@db.xxx.supabase.co:5432/postgres?sslmode=require`

## 2) Create backend Space (Native Python, no Docker)

Create a Space:
- SDK: Gradio
- Suggested name: `yourname-blockchain-backend`

Upload files from `backend/` folder to the Space root.

Important:
- Keep `backend/app.py` as entrypoint file in Space root.
- HF will run this process and expose port 7860.

Set backend Space Variables/Secrets:
- `DATABASE_URL` = your Supabase URI
- `ALCHEMY_API_KEY` = your key
- `HF_TOKEN` = your Hugging Face token (if used by AI analyst)
- `JWT_SECRET_KEY` = long random secret
- `AUTH_DISABLED` = `false`
- `API_PORT` = `7860`
- `CORS_ALLOWED_ORIGINS` = frontend Space URL(s), comma-separated

Example:
`https://yourname-blockchain-frontend.hf.space`

After deploy, verify health endpoint:
- `https://yourname-blockchain-backend.hf.space/`

## 3) Run DB initialization and seed once

Because backend no longer uses local Postgres volume, run SQL directly against Supabase using psql or Supabase SQL Editor.

Run in order:
1. `database/init.sql`
2. `database/seed_rich_demo.sql`

If you use SQL Editor, paste/run each file in chunks.

## 4) Frontend connection to HF backend

Because this repository frontend is Next.js server runtime, non-Docker HF Space is not suitable for hosting it directly.

Recommended:
- Deploy frontend on Vercel/Netlify
- Set frontend env to use backend HF URL
- Allow that frontend domain in `CORS_ALLOWED_ORIGINS`

If you still want frontend on HF, keep using Docker Space specifically for frontend.

## 5) Important HF notes

- One Space = one public endpoint. Native HF setup here runs backend only.
- Free Spaces can sleep when idle; first request after idle can be slow.
- Scanner/background jobs are not ideal on sleeping Spaces; for always-on scanning, use a dedicated worker host.

## 6) Quick smoke tests

Backend:
- `/`
- `/statistics/dashboard`
- `/alerts/recent?limit=12`

Frontend:
- Open home page
- Open quick routes login/register/user/admin
- Confirm dashboard panels show seeded data

## 7) Recommended production hardening

- Restrict `CORS_ALLOWED_ORIGINS` to exact frontend domains.
- Rotate `JWT_SECRET_KEY` and Supabase DB password if leaked.
- Disable debug logs in production.
- Add Supabase PITR/backup policy.
