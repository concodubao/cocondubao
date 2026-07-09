# Test Plan, Test Cases & Test Report — Cò Con Dự Báo

| Field | Value |
|---|---|
| **Document** | 06 — Test Plan / Test Cases / Test Report |
| **Version** | 1.0.0 |
| **Status** | Baseline (test run @ 2026-06-30) |
| **Frameworks** | Vitest + Supertest (backend), Vitest + Testing Library (frontend), Playwright (e2e), custom RAG eval |
| **Related** | [02-SRS](02-SRS.md) (requirement IDs) · [05-API](05-API.md) · [07-RISK-REGISTER](07-RISK-REGISTER.md) |

---

## Table of contents

1. [Introduction](#1-introduction)
2. [Test strategy & levels](#2-test-strategy--levels)
3. [Test environment & tooling](#3-test-environment--tooling)
4. [Scope of testing](#4-scope-of-testing)
5. [Entry & exit criteria](#5-entry--exit-criteria)
6. [Test cases](#6-test-cases)
7. [RAG evaluation framework](#7-rag-evaluation-framework)
8. [Non-functional testing](#8-non-functional-testing)
9. [Test execution report](#9-test-execution-report-current)
10. [Defect management](#10-defect-management)
11. [Traceability matrix](#11-requirement--test-traceability)

---

## 1. Introduction

### 1.1 Purpose
Define how Cò Con Dự Báo is verified: the test levels, environments, cases, the RAG
quality-evaluation approach, and the current execution results. Because wrong agronomic
advice is dangerous, the plan emphasizes **answer correctness/safety** (RAG behavior &
escalation) and **access control** (auth/IDOR/RLS) above cosmetic concerns.

### 1.2 Objectives
- Verify functional requirements ([SRS §4](02-SRS.md#4-functional-requirements)).
- Verify access-control and data-safety invariants.
- Provide a repeatable measure of RAG answer quality (gate prompt/model changes).
- Catch regressions automatically in CI.

### 1.3 References
[SRS](02-SRS.md), [API](05-API.md), [Architecture](03-ARCHITECTURE.md), the eval suite
`backend/eval/README.md`, and the test sources under `backend/test/`,
`frontend/src/**/*.test.jsx`, `frontend/tests/e2e/`.

---

## 2. Test strategy & levels

| Level | Tooling | Where | What it covers |
|-------|---------|-------|----------------|
| **Unit** | Vitest (mocked Supabase/Gemini) | `backend/test/*.test.js` | Pure logic: RAG tiers, FAQ/off-topic gates, caches, auth middleware, schedulers, validators |
| **Integration (API)** | Vitest + Supertest | `backend/test/*.test.js` | Route handlers with mocked DB: status codes, role guards, ownership/IDOR, conflict handling |
| **DB integration** | Vitest (gated) | `backend/test/integration/db_flow.test.js` | Real-DB flow — **opt-in only** (`RUN_DB_INTEGRATION=1` + separate test DB) |
| **Frontend unit/component** | Vitest + Testing Library | `frontend/src/**` | Image compression, answer rendering, wait-engineer UI |
| **End-to-end** | Playwright (Chromium) | `frontend/tests/e2e/` | Critical paths: login (phone/email), consent, role-based routes |
| **RAG evaluation** | Custom (`scripts/eval_rag.js`) | `backend/eval/` | Answer behavior/keywords/LLM-judge quality (real Gemini) |
| **Security review** | Manual + `npm audit` | whole codebase | IDOR, injection, secrets, deps |
| **Manual/UAT** | Human | staging/prod | Elderly-farmer usability, field conditions |

**Test design techniques:** equivalence partitioning & boundary values (PIN length,
content length, confidence thresholds 0.5/0.7/0.80/0.95), state transition (queue
`pending→in_progress→resolved`), decision tables (RAG confidence bands), and negative
testing (auth failures, ownership violations, quota errors).

### 2.1 Mocking strategy (unit/integration)

- **Supabase** and **Gemini** are mocked via `vi.hoisted`. `GoogleGenerativeAI`/
  `GoogleGenAI` are constructed with `new`, so mocks are **functions** (not arrows).
- LLM mocks return native-SDK shape `{ text: () => '...' }` / `result.text`.
- The Supabase query builder is mocked as a chainable/thenable that dequeues one enqueued
  result per `await`.
- `rag.js` exports `checkFAQ`, `looksOffTopic`, `contextualizeQuery`,
  `extractCuratedAnswer`, `getAnswerCache`/`setAnswerCache`/`_clearAnswerCache`,
  `getSemanticCache`, `embedTexts` specifically to enable unit testing.

---

## 3. Test environment & tooling

| Item | Value |
|------|-------|
| Backend test runner | `cd backend && npm test` (`vitest run`); watch: `npm run test:watch`; single file: `npm test -- rag` |
| Frontend test runner | `cd frontend && npm test` |
| E2e runner | `cd frontend && npm run test:e2e` (requires `npx playwright install chromium`) |
| RAG eval | `cd backend && npm run eval` (needs real `.env`: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `GOOGLE_API_KEY`) |
| CI | GitHub Actions on Node 22 — runs backend + frontend test suites and lint |
| Lint | `cd frontend && npm run lint` (ESLint flat config) |
| Node | 22.x |

> **Safety:** the DB integration test refuses to run against the production URL and is
> skipped unless `RUN_DB_INTEGRATION=1` with a dedicated `SUPABASE_TEST_URL/KEY`, so
> `npm test` never writes to production.

---

## 4. Scope of testing

**In scope:** RAG pipeline behavior & caching; auth/RBAC/denylist; per-resource ownership
(IDOR); engineer queue concurrency; knowledge ingestion safety; notification dispatch
(quiet hours, crop targeting, scheduling); weather-alert generation; community moderation;
admin operations; input validation; quota/rate-limit handling.

**Out of scope (automated):** real SMS/OTP delivery, real push delivery to devices,
third-party provider uptime, visual/pixel regression, load/stress testing (manual only),
and live-LLM determinism (covered probabilistically by the eval suite, not unit tests).

---

## 5. Entry & exit criteria

**Entry:** code compiles; dependencies installed; mocks configured; for eval, a populated
knowledge base and valid Gemini key.

**Exit (per release):**
- All backend + frontend unit/integration tests pass in CI.
- E2e critical paths pass locally before release.
- RAG eval pass-rate ≥ configured threshold (gate for prompt/model/threshold changes).
- No open critical/security defects; `npm audit` shows no high/critical in prod deps.
- Security review completed for changes touching auth, uploads, or data access.

---

## 6. Test cases

> Representative cases grouped by module, each traceable to an SRS requirement and a test
> source. "Automated" cases exist in the suites; "Manual" cases are executed by a human.

### 6.1 Authentication & access control (→ FR-AUTH, NFR-SEC)

| TC ID | Title | Steps / input | Expected | Type | Source |
|-------|-------|---------------|----------|------|--------|
| TC-AUTH-01 | Missing Authorization header | call protected route, no header | `401` | Auto | `auth.middleware.test.js` |
| TC-AUTH-02 | Malformed/expired/wrong-secret token | tampered JWT | `401` | Auto | `auth.middleware.test.js` |
| TC-AUTH-03 | Valid token attaches `req.user` | valid JWT | `next()` called, `req.user` set | Auto | `auth.middleware.test.js` |
| TC-AUTH-04 | Locked account rejected despite valid token | `markInactive` then call | `401` "account locked" | Auto | `auth.middleware.test.js` |
| TC-AUTH-05 | Unlock restores access | `markActive` then call | passes | Auto | `auth.middleware.test.js` |
| TC-AUTH-06 | Role guard denies wrong role | farmer hits engineer route | `403` | Auto | `auth.middleware.test.js` |
| TC-AUTH-07 | PIN strength enforced | set PIN ≠ 6 digits | `400` | Manual/Auto | `routes/auth.js` |
| TC-AUTH-08 | PIN brute-force lockout | 5 wrong PINs | `429`, 10-min lock | Manual | `routes/auth.js` |
| TC-AUTH-09 | OTP does not leak account existence | request-otp for any number | no `isExistingUser`/role in body | Manual | `routes/auth.js` |
| TC-AUTH-10 | Self-delete soft-disables + nulls PII | delete account | `is_active=false`, PII null, images removed | Manual | `routes/auth.js` |

### 6.2 RAG answering (→ FR-CHAT)

| TC ID | Title | Input | Expected | Type | Source |
|-------|-------|-------|----------|------|--------|
| TC-RAG-01 | FAQ short-circuit | "bạn là ai" | `source=faq`, no embed/LLM | Auto | `rag.test.js` |
| TC-RAG-02 | Filler/echo question | "vậy hả" | FAQ clarify, not RAG | Auto | `rag.test.js` |
| TC-RAG-03 | No chunks → escalate | retrieval empty | `needEngineer=true`, `source=rag` | Auto | `rag.test.js` |
| TC-RAG-04 | Confidence < 0.5 → escalate, no LLM | low sim | `needEngineer=true`, LLM not called | Auto | `rag.test.js` |
| TC-RAG-05 | Off-topic < 0.5 → polite decline | "kết quả bóng đá" | `source=faq`, no engineer, no LLM | Auto | `rag.test.js` |
| TC-RAG-06 | Band 0.5–0.7 → cautious, no cache | mid sim | `source=rag_low_conf`, not cached | Auto | `rag.test.js` |
| TC-RAG-07 | Curated QA ≥ 0.80 → serve verbatim | high-sim QA chunk | `source=qa_direct`, LLM not called | Auto | `rag.test.js` |
| TC-RAG-08 | Confidence ≥ 0.7 → full answer + cache | high sim | `source=rag`, cached (L1+L2) | Auto | `rag.test.js` |
| TC-RAG-09 | Repeat question → cache hit | ask twice | 2nd from cache, no pgvector/LLM | Auto | `rag.test.js` |
| TC-RAG-10 | Semantic cache near-duplicate | cosine ≥ 0.95 | served from cache | Auto | `rag.test.js` |
| TC-RAG-11 | Off-topic detection is conservative | off-topic word + agri word | `looksOffTopic=false` (still escalate) | Auto | `rag.test.js` |
| TC-RAG-12 | Follow-up contextualization | "còn cách khác" + history | topic prepended before embed | Auto | `rag.test.js` |
| TC-RAG-13 | pgvector error propagates | RPC error | error thrown to caller (→ friendly 500/429) | Auto | `rag.test.js` |

### 6.3 Chat API access & safety (→ FR-CHAT-17, NFR-SEC-03)

| TC ID | Title | Expected | Type | Source |
|-------|-------|----------|------|--------|
| TC-CHAT-01 | IDOR: ask into another's session | `403` | Auto | `chat.access.test.js` |
| TC-CHAT-02 | Report/feedback/bookmark on others' message | `403` | Auto | `chat.access.test.js` |
| TC-CHAT-03 | History only for own userId | `403` for others | Auto | `chat.access.test.js` |
| TC-CHAT-04 | Staff read only escalated sessions | `403` if not escalated | Auto | `chat.access.test.js` |
| TC-CHAT-05 | Bookmarks soft-degrade when table missing | `{unavailable:true}` not 500 | Auto | `chat.access.test.js` |
| TC-CHAT-06 | Quota error → friendly 429 | Gemini 429 | `429` friendly copy | Auto | `chat.access.test.js` |
| TC-CHAT-07 | testMode (staff) doesn't persist/notify | no session/queue/push | Auto | `chat.access.test.js` |

### 6.4 Engineer queue & knowledge (→ FR-ENG)

| TC ID | Title | Expected | Type | Source |
|-------|-------|----------|------|--------|
| TC-ENG-01 | Claim is atomic | second claimant gets `409` | Auto | `engineer.queue.test.js` |
| TC-ENG-02 | Answer by non-assignee blocked | `403` (admin override allowed) | Auto | `engineer.queue.test.js` |
| TC-ENG-03 | Edit resolved overwrites, no duplicate | single engineer message | Auto | `engineer.queue.test.js` |
| TC-ENG-04 | addToKnowledge creates curated QA | doc inserted + embedded | Auto | `engineer.queue.test.js` |
| TC-ENG-05 | Delete unanswered notifies farmer | system message + push | Auto | `engineer.queue.test.js` |
| TC-ENG-06 | Delete resolved blocked | `400` | Auto | `engineer.queue.test.js` |
| TC-ENG-07 | Role guard on all queue/KB routes | non-staff `403` | Auto | `engineer.queue.test.js` |

### 6.5 Admin (→ FR-ADMIN)

| TC ID | Title | Expected | Type | Source |
|-------|-------|----------|------|--------|
| TC-ADM-01 | Admin cannot self-lock / self-demote | `400` | Auto | `admin.endpoints.test.js` |
| TC-ADM-02 | Lock/unlock updates denylist | instant effect | Auto | `admin.endpoints.test.js` |
| TC-ADM-03 | Reset PIN only for farmers | `400` for staff | Auto | `admin.endpoints.test.js` |
| TC-ADM-04 | Search input injection stripped | `.or()` chars removed | Auto | `admin.endpoints.test.js` |
| TC-ADM-05 | CSV export neutralizes formula injection | leading `=+-@` prefixed `'` | Auto | `admin.endpoints.test.js` |
| TC-ADM-06 | Mutations write audit log | audit row created (soft-degrade) | Auto | `admin.endpoints.test.js` |
| TC-ADM-07 | Role guards on admin routes | non-admin `403` | Auto | `admin.endpoints.test.js` |

### 6.6 Community (→ FR-COM)

| TC ID | Title | Expected | Type | Source |
|-------|-------|----------|------|--------|
| TC-COM-01 | Delete own/admin only | `403` otherwise | Auto | `community.test.js` |
| TC-COM-02 | Content length limits | `400` over limit | Auto | `community.test.js` |
| TC-COM-03 | Report idempotent | duplicate → `already:true` | Auto | `community.test.js` |
| TC-COM-04 | Like toggles | like/unlike | Auto | `community.test.js` |
| TC-COM-05 | Admin moderation queue grouped | grouped + dismiss | Auto | `community.test.js` |

### 6.7 Notifications & weather (→ FR-NOTIF)

| TC ID | Title | Expected | Type | Source |
|-------|-------|----------|------|--------|
| TC-NOT-01 | Scheduler sends due, marks sent | dispatched + `sent_at` set | Auto | `notifications.scheduler.test.js` |
| TC-NOT-02 | Quiet hours suppress (incl. overnight) | not delivered in window | Auto | `notifications.scheduler.test.js` |
| TC-NOT-03 | Crop targeting (filter then profile) | only matching subs | Auto | `notifications.scheduler.test.js` |
| TC-NOT-04 | Overlap guard | no concurrent runs | Auto | `notifications.scheduler.test.js` |
| TC-NOT-05 | Scheduled list/cancel before send | cancel only if unsent | Auto | `push.scheduled.test.js` |
| TC-NOT-06 | Settings with no subscription | `{noSubscription:true}` | Auto | `push.scheduled.test.js` |
| TC-NOT-07 | Weather thresholds produce drafts | rain≥20/heat≥35/wind≥40/cold≤18 → draft | Auto | `weatherAlerts.test.js` |
| TC-NOT-08 | Draft dedup per kind/day | one draft per kind/day | Auto | `weatherAlerts.test.js` |
| TC-NOT-09 | Stale drafts cleaned | past-day drafts removed | Auto | `weatherAlerts.test.js` |

### 6.8 Storage cleanup (→ FR/NFR infra)

| TC ID | Title | Expected | Type | Source |
|-------|-------|----------|------|--------|
| TC-STO-01 | Delete pest images > 30 days | old removed, `image_url` nulled | Auto | `storageCleanup.test.js` |
| TC-STO-02 | Community images untouched | not deleted | Auto | `storageCleanup.test.js` |

### 6.9 Frontend & e2e

| TC ID | Title | Expected | Type | Source |
|-------|-------|----------|------|--------|
| TC-FE-01 | Image compression ≤ 1280px, fallback | compressed or original | Auto | `frontend` Vitest |
| TC-FE-02 | Answer markdown + disclaimer | renders + disclaimer for technical | Auto | `frontend` Vitest |
| TC-FE-03 | Wait-engineer state | correct UI/polling | Auto | `frontend` Vitest |
| TC-E2E-01 | Login by phone & email | reaches role home | Auto | Playwright `critical-path.spec.js` |
| TC-E2E-02 | Consent required to proceed | button enabled only after consent (`#consent`) | Auto | Playwright |
| TC-E2E-03 | Role-based routing | farmer→`/home`, engineer→`/engineer/queue` | Auto | Playwright |

### 6.10 Manual / UAT (→ NFR-USE)

| TC ID | Title | Expected |
|-------|-------|----------|
| TC-UAT-01 | Elderly farmer asks by voice unaided | gets a readable answer |
| TC-UAT-02 | Photo diagnosis of a diseased leaf | sensible answer or escalation |
| TC-UAT-03 | Outdoor readability (bright sun, large font) | legible, usable |
| TC-UAT-04 | Engineer answers a real escalation end-to-end | farmer notified, KB optionally grows |

---

## 7. RAG evaluation framework

Located in `backend/eval/` (`dataset.json` + `scripts/eval_rag.js`, `npm run eval`).
Because incorrect dosage/disease advice is dangerous, this turns "try a few questions by
hand" into a **repeatable measurement** to run before changing `SYSTEM_PROMPT`, the model,
or thresholds in `rag.js`.

**Three scoring signals per case:**
1. **Behavior** — correct tier: `faq` / `engineer` (must escalate) / `answer` (AI answers).
2. **Keywords** — `expectKeywords` must appear and `forbidKeywords` must not (accent- and
   case-insensitive).
3. **LLM-judge (optional)** — Gemini grades the answer vs a `reference` on 0–5; ≥ 3 passes.

A case **passes** when: no error, correct behavior, required keywords present, no forbidden
keywords, and (if judging) score ≥ 3.

**Usage / gating:**
```bash
npm run eval                       # behavior + keywords (cheap)
npm run eval -- --judge            # add LLM-judge (uses quota)
npm run eval -- --threshold 0.9    # exit ≠ 0 if pass-rate < 90% (CI/regression gate)
npm run eval -- --json > result.json
```

> **Owner action:** `dataset.json` is a seed. Engineers must expand `reference` with
> domain expertise and add a case for every 👎-reported answer (regression guard).

---

## 8. Non-functional testing

| Area | Approach | Status |
|------|----------|--------|
| **Security** | Manual code review (IDOR, injection, secrets) + `npm audit` | Completed; backend & frontend reviewed; 2 high vite dev-server vulns fixed (`npm audit fix`); residual accepted items documented |
| **Performance** | LLM latency observed (~1.8 s after thinking-off); bundle size tracked (~137 KB entry) | Verified via real API calls / build output (estimates) |
| **Quota/rate-limit** | Unit tests for 429 handling; `quotaMonitor` 80% alert | Covered |
| **Layout/responsive** | Playwright at 360 px width (overflow checks) | Covered (H6) |
| **Reliability** | Soft-degrade paths, vision→text fallback, embed failure-safety | Covered by unit tests + design |
| **Load/stress** | Not automated | Manual/future (Đề xuất sử dụng **K6** hoặc **JMeter** để giả lập tải đồng thời khi mở rộng) |
| **Accessibility (elderly)** | Manual UAT | Manual |

---

## 9. Test execution report (current)

> [!NOTE]
> Báo cáo dưới đây là Baseline Test Run (chạy lần đầu lúc nghiệm thu). Kết quả chạy test tự động mới nhất vui lòng xem tại hệ thống CI/CD (Github Actions).

**Run date:** 2026-06-30 · **Environment:** local, Node 22, mocked Supabase/Gemini.

### 9.1 Backend (Vitest) — `cd backend && npm test`

```
Test Files  10 passed | 1 skipped (11)
     Tests  142 passed | 2 skipped (144)
  Duration  ~3.8 s
```

| Test file | Cases | Result |
|-----------|-------|--------|
| `rag.test.js` | 29 | ✅ pass |
| `admin.endpoints.test.js` | 24 | ✅ pass |
| `engineer.queue.test.js` | 22 | ✅ pass |
| `chat.access.test.js` | 19 | ✅ pass |
| `auth.middleware.test.js` | 12 | ✅ pass |
| `community.test.js` | 10 | ✅ pass |
| `notifications.scheduler.test.js` | 9 | ✅ pass |
| `weatherAlerts.test.js` | 8 | ✅ pass |
| `push.scheduled.test.js` | 6 | ✅ pass |
| `storageCleanup.test.js` | 3 | ✅ pass |
| `integration/db_flow.test.js` | 2 | ⏭️ skipped (opt-in, needs real test DB) |

### 9.2 Frontend (Vitest) — `cd frontend && npm test`

```
Test Files  3 passed (3)
     Tests  12 passed (12)
  Duration  ~3.8 s
```

### 9.3 End-to-end (Playwright)

3 critical-path specs (`tests/e2e/critical-path.spec.js`) — login (phone/email), consent
gating, role-based routing. Last known run: **3/3 pass** (`npx playwright install chromium`
required; not re-run in this report as it needs a browser + running frontend).

### 9.4 Summary

| Suite | Passed | Skipped | Failed |
|-------|--------|---------|--------|
| Backend unit/integration | 142 | 2 | 0 |
| Frontend unit/component | 12 | 0 | 0 |
| E2e (last known) | 3 | 0 | 0 |
| **Total** | **157** | **2** | **0** |

> The 2 skipped tests are the opt-in DB integration flow, intentionally skipped so the
> suite never writes to production.

---

## 10. Defect management

- **Tracking:** defects and improvements are logged in `IMPROVEMENTS.md` with an ID,
  severity (🔴/🟠/🟡/🟢), area, problem, fix, and status; runtime errors are captured in
  **Sentry**.
- **Severity:** 🔴 critical (data loss / security / core flow broken) → 🟢 enhancement.
- **Lifecycle:** ⬜ open → 🔧 in progress → ✅ done; fixes are committed with a descriptive
  message and (for prod) deployed via push.
- **Regression prevention:** every fixed bug should gain a test (backend) or eval case
  (RAG); 👎-reported answers should become eval cases.

---

## 11. Requirement → test traceability

| SRS group | Primary cases | Suite |
|-----------|---------------|-------|
| FR-AUTH | TC-AUTH-01…10 | `auth.middleware.test.js`, manual |
| FR-CHAT | TC-RAG-01…13, TC-CHAT-01…07 | `rag.test.js`, `chat.access.test.js`, eval |
| FR-ENG | TC-ENG-01…07 | `engineer.queue.test.js` |
| FR-COM | TC-COM-01…05 | `community.test.js` |
| FR-NOTIF | TC-NOT-01…09 | `notifications.scheduler.test.js`, `push.scheduled.test.js`, `weatherAlerts.test.js` |
| FR-ADMIN | TC-ADM-01…07 | `admin.endpoints.test.js` |
| NFR-SEC | TC-AUTH-*, TC-CHAT-01…05, TC-ADM-04/05 | suites + security review |
| NFR-REL | TC-CHAT-05, TC-NOT-04, TC-ENG-03, TC-STO-* | suites |
| Quality (RAG) | §7 eval cases | `backend/eval` |

> Coverage goal: every Must-priority requirement has at least one automated case or a
> defined manual/UAT procedure. Gaps (load testing, broader UAT) are tracked as future
> work in the [Risk Register](07-RISK-REGISTER.md).
