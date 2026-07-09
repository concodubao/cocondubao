# Project Charter & Business Requirements — Cò Con Dự Báo

| Field | Value |
|---|---|
| **Document** | 01 — Project Charter / Business Requirements Document (BRD) |
| **Product** | Cò Con Dự Báo ("Little Stork Forecast") |
| **Version** | 1.0.0 |
| **Status** | Baseline / Pilot (as of 2026-06-30) |
| **Sponsor** | Trường Khánh agricultural cooperative (commune-level) |
| **Related** | [02-SRS](02-SRS.md) · [03-ARCHITECTURE](03-ARCHITECTURE.md) · [07-RISK-REGISTER](07-RISK-REGISTER.md) |

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [Problem statement & business case](#2-problem-statement--business-case)
3. [Vision & mission](#3-vision--mission)
4. [Goals, objectives & success metrics](#4-goals-objectives--success-metrics)
5. [Scope](#5-scope)
6. [Deliverables](#6-deliverables)
7. [Stakeholders & roles](#7-stakeholders--roles)
8. [Target users (personas)](#8-target-users-personas)
9. [Assumptions & constraints](#9-assumptions--constraints)
10. [High-level milestones](#10-high-level-milestones)
11. [Budget & resources](#11-budget--resources)
12. [High-level risks](#12-high-level-risks)
13. [Governance & ways of working](#13-governance--ways-of-working)

---

## 1. Executive summary

**Cò Con Dự Báo** is a Progressive Web App that gives farmers in Trường Khánh commune
(Sóc Trăng province, Vietnam) instant, trustworthy agricultural advice. A farmer asks a
question by **text, voice, or photo**; an AI assistant answers using a curated agronomy
knowledge base (RAG), and **hard questions are routed to human agronomists**. The product
also provides a community feed, weather information and alerts, and broadcast
notifications, plus administrative tooling for the cooperative.

The project's guiding principle is **"address risks and limitations first, then expand
features"** — reflected in a backlog that prioritized correctness, security, cost
control, and operability before new capabilities.

---

## 2. Problem statement & business case

### 2.1 Problem
Smallholder farmers in the Mekong Delta face crop diseases, pests, fertilization
decisions, and weather risks daily, but expert agronomic advice is scarce, slow, and
often inaccessible to **elderly, low-literacy users** with only a basic smartphone. Wrong
or delayed advice translates directly into crop loss and financial harm. Generic search
or chatbots are unreliable for local crops and may give confidently wrong answers.

### 2.2 Why now / why this approach
- LLMs can now converse in natural Southern-Vietnamese, but **need grounding** to be
  trustworthy → a RAG pipeline over a **curated, expert-reviewed** knowledge base.
- A **human-in-the-loop** escalation keeps answers safe where the AI is uncertain, and
  feeds expert answers back into the knowledge base (a virtuous loop).
- A **PWA** avoids app-store friction and runs on cheap Android phones.

### 2.3 Expected benefits
- Faster, more consistent answers to common agronomy questions, 24/7.
- Reduced agronomist workload on repetitive questions (handled by curated QA / cache).
- A growing, locally-relevant knowledge base owned by the cooperative.
- A communication channel (notifications, weather alerts) to the farming community.

---

## 3. Vision & mission

- **Vision:** every farmer in the commune has an expert agronomist "in their pocket."
- **Mission:** deliver reliable, plain-language, locally-grounded agricultural advice
  through an accessible PWA, backed by human experts, at near-zero running cost.

---

## 4. Goals, objectives & success metrics

| # | Objective | Success metric (KPI) | Target (pilot) |
|---|-----------|----------------------|----------------|
| O1 | Answer common questions without human effort | Share of questions resolved by AI (FAQ/cache/`qa_direct`/RAG ≥ 0.7) | Majority of repeat/common questions* |
| O2 | Keep answers trustworthy | Low-confidence questions escalated, not guessed | 100% of confidence < 0.5 (agronomy) escalated |
| O3 | Respond quickly to escalations (SLA) | Avg engineer response time (`avgResponseHours`) | ≤ 24 h (SLA monitored by Admin/HTX; overdue flagged for follow-up) |
| O4 | Operate within free-tier cost | Monthly infra cost | ~0 (Railway/Vercel/Supabase/Gemini/Open-Meteo free tier) |
| O5 | Be usable by elderly farmers | Successful unaided task completion (ask + read answer) | Qualitative pilot feedback |
| O6 | Continuously improve the KB | Curated QAs added from engineer answers + 👍/👎 review | Steady growth; 👎 cases converted |
| O7 | Operate reliably | Uptime via `/health` monitor; errors triaged in Sentry | High availability; no unhandled error backlog |

\* The system instruments `ragRate` (share of recent answers with confidence ≥ 0.7) and
queue/feedback counts in the admin dashboard; exact pilot targets are set with the
cooperative. Figures here are objectives, not measured results.

---

## 5. Scope

### 5.1 In scope (v1.0)
- Multi-role accounts (farmer / engineer / admin) with phone+PIN and email+password auth.
- AI Q&A by text, photo (vision), and voice (STT), with RAG grounding and caching.
- Human escalation queue and engineer answering workflow.
- Knowledge-base ingestion (PDF/DOCX/TXT) and curated Q&A authoring + embedding.
- AI quality review, knowledge-gap surfacing, and feedback (👍/👎) loops.
- Community feed (posts/comments/likes) with reporting and admin moderation.
- Notifications: broadcast, scheduled, and system-generated weather-alert drafts.
- Weather information (Open-Meteo).
- Admin tooling: user management, role/lock control, PIN reset, audit log, CSV export,
  analytics dashboard.
- Observability (Sentry), quota monitoring, and an operations runbook.

### 5.2 Out of scope (v1.0)
- Payments / e-commerce / input marketplace.
- IoT / field-sensor integration.
- Native iOS/Android apps (PWA only).
- Multi-commune / multi-tenant deployment and horizontal scaling.
- Full offline operation beyond PWA shell caching.
- Replacing the OTP/SMS provider (deferred; Twilio kept but flagged).

### 5.3 Scope boundary notes
The architecture is intentionally **pilot-scoped to a single backend replica**; scaling
out is explicitly deferred with a documented migration path (see
[Architecture §13](03-ARCHITECTURE.md#13-scalability--the-single-replica-constraint)).

---

## 6. Deliverables

| Deliverable | Description |
|-------------|-------------|
| Frontend PWA | React PWA on Vercel (`cocondubao.vercel.app`) |
| Backend API | Express REST API on Railway |
| Database | Supabase Postgres + pgvector schema & migrations |
| Knowledge base | Curated agronomy documents + Q&A, embedded |
| Documentation set | This SDLC suite (`docs/01`–`07`) + user manuals (`docs/HUONG-DAN-*`) |
| Operations runbook | `OPERATIONS.md` (backup, monitoring, quota) |
| Quality assets | Test suites (vitest/Playwright) + RAG eval framework (`backend/eval/`) |

---

## 7. Stakeholders & roles

| Stakeholder | Interest / role |
|-------------|-----------------|
| **Farmers** | Primary end users; ask questions, read answers, receive alerts |
| **Agronomists (engineers)** | Answer escalations, curate the knowledge base, review AI quality |
| **Cooperative admin/staff** | Manage users, broadcast information, moderate community, review analytics |
| **Project owner / developer** | Build, deploy, operate, and maintain the system |
| **Commune authority (sponsor)** | Endorses and promotes adoption |
| **External providers** | Google (Gemini), Supabase, Vercel, Railway, Open-Meteo, Twilio |

> RACI is lightweight for a pilot: the developer is Responsible for build/run; engineers
> are Responsible for knowledge quality; admin is Accountable for community & user
> governance; the cooperative is Consulted/Informed on direction.

---

## 8. Target users (personas)

- **Bác Bảy (farmer, ~60):** grows rice; basic Android phone; reads slowly; prefers
  speaking and taking photos; needs big text and very plain language outdoors.
- **Kỹ sư Hân (agronomist):** answers the queue between field visits; wants an efficient
  workflow and to avoid re-answering the same question (curated QA).
- **Anh Tâm (cooperative admin):** manages members, sends seasonal/weather notices,
  keeps the community civil, watches basic analytics.

Full requirements derived from these personas are in [02-SRS §2.3](02-SRS.md#23-user-classes).

---

## 9. Assumptions & constraints

### 9.1 Assumptions
- Farmers have a smartphone with a modern browser and intermittent internet.
- The cooperative provides agronomist time to staff the queue and curate knowledge.
- Pilot user base is on the order of tens of users (single commune).

### 9.2 Constraints
- **Cost:** must run on free tiers → scarce Gemini quota is the dominant technical
  constraint (primary source of 429 errors).
- **Single replica:** in-process cache/rate-limit/schedulers; scaling needs Redis + locks.
- **Operations:** no Docker locally → manual `psql` migrations; auto-deploy on `git push`.
- **Language/locale:** all content in Vietnamese; AI tuned to Southern-Vietnamese phrasing.

---

## 10. High-level milestones

> The project was built iteratively in review-driven "đợt" (waves), risk-first. Dates
> reflect delivered work in the repository history (see [CHANGELOG](../CHANGELOG.md)).

| Phase | Focus | Status |
|-------|-------|--------|
| M1 — Core platform | Auth, chat/RAG, engineer queue, knowledge base, community, notifications, weather | ✅ Delivered |
| M2 — Risk hardening (waves 1–3) | Push/SW fixes, account lockout denylist, crop-filter, IDOR, OTP enumeration, storage cleanup, rate-limit keys, semantic cache | ✅ Delivered (G1–G22, H1–H15) |
| M3 — Productization (2026-06-28→30) | LLM stack migration (`@google/genai`, thinking off), bundle/image perf, frontend tests, Sentry, security review, RAG eval, ops runbook | ✅ Delivered (I1–I6, J1–J3) |
| M4 — Documentation baseline | Full SDLC document suite (this set) | ✅ In progress |
| M5 — Scale & growth (future) | Redis + distributed locks, Gemini billing, pgvector tuning, differential QA, OTP provider swap | ⬜ Backlog |

See [07-RISK-REGISTER](07-RISK-REGISTER.md) and [IMPROVEMENTS.md](../IMPROVEMENTS.md) for
the detailed, ID-tracked backlog.

---

## 11. Budget & resources

- **Financial:** target **~0 recurring cost** using free tiers (Railway, Vercel,
  Supabase, Gemini, Open-Meteo). The single explicit paid upgrade on the roadmap is
  **enabling Gemini billing**, which is the definitive fix for quota 429s.
- **Human:** primarily a solo developer for build/run; agronomist volunteer/staff time
  for the queue and knowledge curation; admin time from the cooperative.
- **Technical:** Node.js/React skill set; Postgres/pgvector; prompt & RAG engineering.

---

## 12. High-level risks

Summarized here; tracked in full in [07-RISK-REGISTER](07-RISK-REGISTER.md).

| Risk | Impact | Mitigation summary |
|------|--------|--------------------|
| Gemini free-tier quota exhaustion (429) | Answers fail at peak | Tiered cache + curated QA + retries; enable billing (roadmap) |
| Incorrect AI advice | Crop/financial harm | Confidence gating, escalation, curated KB, disclaimers, eval framework |
| Single replica limits | No horizontal scaling | Documented Redis/lock migration path |
| SMS (OTP) deliverability in VN | Onboarding friction | Phone+PIN primary; OTP optional; provider swap planned |
| Operator key-person dependence | Maintenance risk | Documentation suite, runbook, Sentry, tests |
| PWA stale cache after deploy | Users see old code | Auto-reload on SW update; documented behavior |

---

## 13. Governance & ways of working

- **Source of truth:** `AI-CONTEXT.md` (current state + LLM stack + gotchas) and
  `IMPROVEMENTS.md` (backlog) are the shared memory; `CLAUDE.md` documents architecture &
  conventions for contributors (human and AI).
- **Change management:** work proceeds in risk-first waves; each change is committed with
  a descriptive message; deploys are automatic on push to `master`.
- **Quality gates:** vitest (backend) + vitest/Testing Library + Playwright (frontend);
  ESLint; a RAG eval suite (`npm run eval`) intended to gate prompt/model/threshold
  changes; periodic security review.
- **Decision records:** significant technical decisions captured as ADRs in
  [03-ARCHITECTURE §14](03-ARCHITECTURE.md#14-architecture-decision-records-adr).

---

## 14. Glossary (Thuật ngữ)

| Term | Definition |
|------|------------|
| **HTX** | Hợp tác xã (Agricultural Cooperative) - The governing body managing the deployment. |
| **Cò Con** | Project nickname ("Little Stork") representing a friendly, localized assistant. |
| **SLA** | Service Level Agreement - Formal commitments (e.g., <= 24h response time) monitored by HTX. |
| **Engineer** | Kỹ sư nông nghiệp (Agronomist) - Human experts who answer escalated questions. |

---

*This charter establishes the why, what, and boundaries of the project. Requirements are
detailed in the [SRS](02-SRS.md); the technical design is in the
[Architecture](03-ARCHITECTURE.md).*

