# Deployment & Installation Guide — Cò Con Dự Báo

| Field | Value |
|---|---|
| **Document** | 08 — Deployment & Installation Guide |
| **Version** | 1.0.0 |
| **Status** | Baseline (reflects `master` @ 2026-06-30) |
| **Audience** | Maintainers, reviewers, anyone re-deploying the system |
| **Related** | 03-ARCHITECTURE · 04-DATABASE · OPERATIONS.md · README.md |

> This guide covers **first-time setup** (clone to running app) and **production
> deployment**. Day-2 operations (backup, monitoring, quota, incident response) are in
> `OPERATIONS.md`.

---

## Table of contents

1. Prerequisites
2. Get the code
3. Provision external services
4. Database setup (Supabase + pgvector)
5. Environment variables
6. Run locally
7. Seed the first admin & knowledge base
8. Production deployment (Railway + Vercel)
9. Post-deploy verification
10. Upgrades & re-deploys
11. Troubleshooting

---

## 1. Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 22.x | Both packages target Node 22 |
| npm | bundled with Node | |
| PostgreSQL client (`psql`) | 17 | For applying migrations manually (no Docker used) |
| A Supabase project | — | Postgres 17 + `pgvector` + a Storage bucket |
| A Google Gemini API key | — | Embeddings + generation + vision + STT |
| Accounts (deploy) | — | Railway (backend), Vercel (frontend) |

This project is intentionally developed **without Docker**; the database is reached
directly with `psql` over the Supabase Session pooler.

---

## 2. Get the code

```bash
git clone <repo-url> cocon-du-bao
cd cocon-du-bao
```

The repo is a two-package monorepo with **no root `package.json`** — install dependencies
inside each package (see §6).

---

## 3. Provision external services

1. **Supabase** — create a project. Note the project ref, `SUPABASE_URL`, the
   **service-role** key, and the **anon** key (Settings → API). Enable the `pgvector`
   extension (it ships with Supabase; the base migration also enables it).
2. **Storage** — create a **public** bucket named `images` (used for pest photos,
   community images, and notification illustrations).
3. **Google Gemini** — create an API key (`GOOGLE_API_KEY`). Free tier quota is low; for
   production, consider enabling billing (the definitive fix for 429s).
4. **VAPID keys** (Web Push) — generate once:
   ```bash
   npx web-push generate-vapid-keys
   ```
   Use the public key for both `VAPID_PUBLIC_KEY` (backend) and `VITE_VAPID_PUBLIC_KEY`
   (frontend), and the private key for `VAPID_PRIVATE_KEY` (backend only).
5. **SMS OTP (optional)** — configure a phone provider (e.g. Twilio) **inside the Supabase
   Auth dashboard**. No `TWILIO_*` variables are needed in the app; phone+PIN is the
   primary auth path and OTP is optional.
6. **Sentry (optional)** — create two projects (Node + React) for `SENTRY_DSN` /
   `VITE_SENTRY_DSN`.

---

## 4. Database setup (Supabase + pgvector)

The schema lives in `supabase/migrations/*.sql` and is the **source of truth**. Apply each
migration **in timestamp order** with `psql` 17 over the Session pooler:

```bash
# Example (Windows path to psql 17 shown; adjust for your OS):
"C:/Program Files/PostgreSQL/17/bin/psql.exe" \
  "postgresql://postgres.<project-ref>:<db-password>@<pooler-host>:5432/postgres" \
  -f supabase/migrations/20260603182216_remote_schema.sql

# Repeat -f for each migration file, in ascending timestamp order.
```

Migration order (as of this baseline) is listed in [04-DATABASE](04-DATABASE.md) §11. The
base migration creates the tables, the `match_knowledge_chunks` RPC, the `update_updated_at`
trigger, indexes, and RLS. Vector columns are `vector(1536)` (Gemini embedding dimension).

> **Soft-degrade:** the API is written to return an "unavailable" flag instead of `500`
> when a not-yet-applied table is queried, so a deploy that precedes a manual migration
> does not crash. Still, apply migrations promptly.

---

## 5. Environment variables

Copy the example files and fill in real values:

```bash
cp backend/.env.example  backend/.env
cp frontend/.env.example frontend/.env.local
```

- Backend variables: see [`backend/.env.example`](../backend/.env.example) (Supabase keys,
  `GOOGLE_API_KEY`, `JWT_SECRET`, VAPID keys, `FRONTEND_URL`, `PORT`, `NODE_ENV`,
  optional `SENTRY_DSN`, `GEMINI_RPM_LIMIT`/`GEMINI_RPD_LIMIT`).
- Frontend variables: see [`frontend/.env.example`](../frontend/.env.example). **Every
  `VITE_*` value is bundled into the browser** — use public keys only. `VITE_API_URL`
  **includes** the `/api/v1` base path.

Keep `VAPID_PUBLIC_KEY` (backend) and `VITE_VAPID_PUBLIC_KEY` (frontend) identical, or push
subscriptions will fail.

---

## 6. Run locally

```bash
# Backend
cd backend
npm install --legacy-peer-deps   # the dependency set requires legacy peer resolution
npm run dev                      # http://localhost:3000  (health check: GET /health)

# Frontend (second terminal)
cd frontend
npm install
npm run dev                      # http://localhost:5173
```

Verify the backend is up: `curl http://localhost:3000/health` should return
`{"status":"ok",...}`.

---

## 7. Seed the first admin & knowledge base

1. **First admin** — there is no public admin signup. Create at least one `admin` directly
   in the `users` table (bcrypt-hash the password), or run a seed script if present. See
   [04-DATABASE](04-DATABASE.md) §11 "Seed Data". Engineers/admins can then be created
   in-app by an admin.
2. **Knowledge base** — log in as engineer/admin and upload documents or author curated
   Q&A, then approve them (they are chunked and embedded). The RAG pipeline only searches
   `status = 'approved'` documents, so the assistant is only useful once the KB is seeded.

---

## 8. Production deployment (Railway + Vercel)

Both tiers **auto-deploy on `git push`** to `master`. There is **no manual deploy command**.

### Backend → Railway
- Railway watches `backend/`. Build/run config is in `backend/railway.json`:
  - build: `npm install --legacy-peer-deps` (NIXPACKS)
  - start: `npm start`
  - healthcheck: `GET /health` (timeout 30s), restart on failure.
- Set all backend env vars in the Railway service settings, including
  **`NODE_ENV=production`** (enables Sentry and production behavior) and
  `FRONTEND_URL` = your Vercel origin (used for the CORS allow-list).

### Frontend → Vercel
- Vercel watches `frontend/`. Build: `npm run build` → `dist/` (config in
  `frontend/vercel.json`).
- Set all `VITE_*` env vars in the Vercel project. `VITE_API_URL` must point at the Railway
  backend, including `/api/v1`.

### Deploy
```bash
git push origin master   # Railway + Vercel pick up the change and redeploy automatically
```

---

## 9. Post-deploy verification

- `GET https://<railway-app>/health` returns `{"status":"ok","env":"production"}`.
- Frontend loads at the Vercel URL; login works (phone+PIN and email+password).
- Ask a question end-to-end; confirm an answer or a clean escalation.
- Push: enable notifications on a device, send an admin broadcast, confirm delivery.
- If Sentry is configured, confirm events arrive on both tiers.

---

## 10. Upgrades & re-deploys

- A fix only reaches production **after a push + redeploy completes**; the running
  backend serves old code until then.
- The PWA service worker caches aggressively — a new frontend deploy does not reach an
  **open** session until a real reload (the app auto-reloads on SW update). "Still broken
  after deploy" is usually stale cached code, not a regression.
- When adding a DB change: create the migration in `supabase/migrations/`, apply it by hand
  with `psql`, then commit. Write API code to degrade softly so the deploy can precede the
  manual migration.

---

## 11. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `npm install` peer-dependency errors (backend) | React/tooling peer ranges | Use `npm install --legacy-peer-deps` |
| `429` from the assistant | Gemini free-tier quota exhausted | Wait (auto-retry/backoff handles transient); enable Gemini billing for a real fix |
| Push subscription fails | VAPID public keys mismatch | Make `VAPID_PUBLIC_KEY` == `VITE_VAPID_PUBLIC_KEY` |
| CORS errors in browser | `FRONTEND_URL` not set to the real origin | Set `FRONTEND_URL` on Railway to the Vercel URL |
| API returns `unavailable: true` | A migration has not been applied | Apply the pending `psql` migration |
| `ERR_ERL_KEY_GEN_IPV6` | Custom rate-limit key returns raw `req.ip` | Use `ipKeyGenerator(req.ip)` for the IP fallback |
| Image upload rejected | File not an image / over size limit | Send a valid image within the size cap |

---

*Keep this guide in sync with `railway.json`, `vercel.json`, the `.env.example` files, and
the migration list in 04-DATABASE when they change.*
