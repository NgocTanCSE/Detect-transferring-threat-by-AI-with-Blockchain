# Deploy on Hugging Face Spaces + Supabase

This project can run with:
- Frontend on one Hugging Face Space (Docker)
- Backend on one Hugging Face Space (Docker)
- PostgreSQL on Supabase

## 1) Create Supabase database URL

In Supabase:
1. Open Project Settings -> Database.
2. Copy Connection string (URI) for direct connection.
3. Ensure `sslmode=require` is present in the URI.

Example:
`postgresql://postgres:YOUR_PASSWORD@db.xxx.supabase.co:5432/postgres?sslmode=require`

## 2) Create backend Space (Docker)

Create a Space:
- SDK: Docker
- Suggested name: `yourname-blockchain-backend`

Use repository backend Dockerfile and app as-is.

Set backend Space Variables/Secrets:
- `DATABASE_URL` = your Supabase URI
- `ALCHEMY_API_KEY` = your key
- `HF_TOKEN` = your Hugging Face token (if used by AI analyst)
- `JWT_SECRET_KEY` = long random secret
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

## 4) Create frontend Space (Docker)

Create a second Space:
- SDK: Docker
- Suggested name: `yourname-blockchain-frontend`

Set frontend Space Variables:
- `BACKEND_URL` = backend Space URL (no trailing slash)
- `NEXT_PUBLIC_API_URL` = backend Space URL (optional, proxy remains `/api`)

Example:
- `BACKEND_URL=https://yourname-blockchain-backend.hf.space`
- `NEXT_PUBLIC_API_URL=https://yourname-blockchain-backend.hf.space`

The frontend server-side `/api/[...path]` proxy forwards to `BACKEND_URL`.

## 5) Important HF notes

- One Space = one public app endpoint. Keep frontend and backend in separate Spaces.
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
