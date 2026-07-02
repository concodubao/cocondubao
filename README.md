# Cò Con Dự Báo — "Little Stork Forecast"

A Progressive Web App that gives farmers in Trường Khánh commune (Sóc Trăng, Vietnam)
instant, trustworthy agricultural advice. A farmer asks a question by **text, voice, or
photo**; an AI assistant answers using a curated agronomy knowledge base (RAG), and
**hard questions are routed to human agronomists**. It also provides a community feed,
weather information and alerts, broadcast notifications, and administrative tooling for
the cooperative.

- **Live app (frontend):** https://cocondubao.vercel.app
- **Roles:** `farmer`, `engineer`, `admin`
- **Guiding principle:** address risks and limitations first, then expand features.

---

## Features

- AI Q&A by **text, photo (vision), and voice (STT)**, grounded in a curated RAG knowledge base.
- **Human escalation** queue: low-confidence questions go to agronomists, whose answers feed back into the knowledge base.
- Tiered caching + curated Q&A to stay within Gemini's scarce free-tier quota.
- Community feed (posts / comments / likes) with reporting and admin moderation.
- Notifications: broadcast, scheduled, and system-generated weather-alert drafts.
- Weather information (Open-Meteo) and alerts.
- Admin tooling: user management, role/lock control, PIN reset, audit log, CSV export, analytics.
- Built mobile-first for elderly, low-literacy users: large text, high contrast, plain Southern-Vietnamese.

---

## Monorepo layout

Two independent packages (no root `package.json`):

| Path | What | Deploys to |
|------|------|------------|
| `backend/` | Express REST API (ESM) | Railway (`laudable-happiness`) |
| `frontend/` | React 19 + Vite + Tailwind v4 PWA | Vercel (`cocondubao.vercel.app`) |
| `supabase/migrations/` | Postgres 17 + pgvector schema (source of truth for the DB) | Supabase |

## Tech stack

- **Backend:** Node.js (ESM), Express, `@google/genai` (Gemini), `@supabase/supabase-js`, `jsonwebtoken`, `bcrypt`, `helmet`, `express-rate-limit`, `web-push`, `sharp`, Vitest.
- **Frontend:** React 19, Vite, Tailwind CSS v4, React Query, Zustand, React Router, Axios, `vite-plugin-pwa`/Workbox, Vitest + Playwright.
- **Data/AI:** Supabase Postgres + pgvector + Storage; Google Gemini (embeddings + generation + vision + STT); Open-Meteo (weather); Twilio via Supabase Auth (SMS OTP).

---

## Quick start (local development)

Prerequisites: **Node.js 22.x**, a Supabase project (Postgres 17 + pgvector), and a
Google Gemini API key.

```bash
# 1) Backend
cd backend
cp .env.example .env            # then fill in real values
npm install --legacy-peer-deps  # --legacy-peer-deps needed for the dependency set
npm run dev                     # http://localhost:3000  (health: /health)

# 2) Frontend (in a second terminal)
cd frontend
cp .env.example .env.local      # then fill in real values
npm install
npm run dev                     # http://localhost:5173
```

Environment variables are documented in [`backend/.env.example`](backend/.env.example)
and [`frontend/.env.example`](frontend/.env.example). Full setup, database migration, and
deployment steps are in [docs/08-DEPLOYMENT](docs/08-DEPLOYMENT.md).

## Common commands

```bash
# Backend (run inside backend/)
npm run dev          # nodemon dev server (port 3000)
npm test             # vitest run — full suite
npm test -- rag      # run one file by name match
npm run eval         # RAG evaluation suite (needs a real .env)

# Frontend (run inside frontend/)
npm run dev          # vite dev server (port 5173)
npm run build        # production build -> dist/
npm run lint         # eslint
npm test             # vitest run
npm run test:e2e     # Playwright (needs: npx playwright install chromium)
```

## Database & migrations

The database is Supabase Postgres (with `pgvector`). The schema lives in
`supabase/migrations/*.sql` and is the source of truth. Migrations are applied **manually
with `psql` 17** against the database (this project is developed without Docker). See
[docs/04-DATABASE](docs/04-DATABASE.md) and [docs/08-DEPLOYMENT](docs/08-DEPLOYMENT.md).

## Deployment

Both tiers **auto-deploy on `git push`** to `master` — Railway watches `backend/`, Vercel
watches `frontend/`. There is no manual deploy step; production runs the old code until a
push + redeploy completes. Details in [docs/08-DEPLOYMENT](docs/08-DEPLOYMENT.md).

