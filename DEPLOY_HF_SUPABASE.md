# Deploy on Hugging Face Spaces + Supabase (Single Space)

This guide uses one Hugging Face Space with the repository root Dockerfile to run:
- Next.js frontend
- FastAPI backend
- background scanner

Supabase provides PostgreSQL, so the Space does not need a local database container.

## 1) Create Supabase database URL

In Supabase:
1. Open Project Settings -> Database.
2. Copy Connection string (URI) for direct connection.
3. Ensure `sslmode=require` is present in the URI.

Example:
`postgresql://postgres:YOUR_PASSWORD@db.xxx.supabase.co:5432/postgres?sslmode=require`

## 2) Create one HF Space (Docker)

Create a Space:
- SDK: Docker
- Suggested name: `yourname-blockchain-app`

Push the full repository to the Space.

The root `Dockerfile`, `entrypoint.sh`, and `supervisord.conf` already start the frontend, backend, and scanner together.

Set backend Space Variables/Secrets:
- `DATABASE_URL` = your Supabase URI
- `ALCHEMY_API_KEY` = your key
- `HF_TOKEN` = your Hugging Face token (if used by AI analyst)
- `JWT_SECRET_KEY` = long random secret
- `AUTH_DISABLED` = `false`
- `CORS_ALLOWED_ORIGINS` = `*` or your custom domain if you want direct browser access

Example:
`https://yourname-blockchain-app.hf.space`

After deploy, verify health endpoint:
- `https://yourname-blockchain-app.hf.space/`

## 3) Run DB initialization and seed once

The Space now runs a best-effort bootstrap on startup:
- If `users` does not exist, it loads `database/init.sql` and then `database/seed_rich_demo.sql`
- If the schema exists but `users` is empty, it loads `database/seed_rich_demo.sql`

If you want to do it manually, you can still run the SQL directly against Supabase using psql or Supabase SQL Editor.

Run in order:
1. `database/init.sql`
2. `database/seed_rich_demo.sql`

If you use SQL Editor, paste/run each file in chunks.

## 4) Frontend and backend in the same Space

The frontend proxies API calls to `/api`, and the reverse proxy in the same container forwards those calls to backend on `http://localhost:8000`.

No extra frontend deployment is needed for this single-Space setup.

## 5) Important HF notes

- One Space = one public endpoint. This setup uses a single Docker Space for the full app.
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
