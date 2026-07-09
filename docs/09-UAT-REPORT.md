# User Acceptance Test (UAT) Report — Cò Con Dự Báo

> Biên bản nghiệm thu / Báo cáo kiểm thử chấp nhận người dùng

| Field | Value |
|---|---|
| **Document** | 09 — User Acceptance Test (UAT) Report |
| **Version** | 1.0.0 |
| **Status** | Baseline — automated coverage complete; human sign-off fields to be filled at the acceptance session |
| **Related** | 02-SRS · 06-TEST-PLAN · 08-DEPLOYMENT |

> Scope note: the automated test suites (backend/frontend/e2e) and their results are the
> objective backing for this report and are reproduced from [06-TEST-PLAN](06-TEST-PLAN.md).
> The **human UAT scenarios** (§4) and the **sign-off** (§7) are filled in during the live
> acceptance session with the cooperative; fields marked `[ ... ]` are completed then.

---

## Table of contents

1. Purpose & acceptance criteria
2. Participants & environment
3. Automated test evidence (summary)
4. UAT scenarios (human)
5. Defects found during UAT
6. Open items & residual risks
7. Acceptance decision & sign-off

---

## 1. Purpose & acceptance criteria

This report records whether **Cò Con Dự Báo** meets the agreed requirements and is fit for
pilot use by the Trường Khánh cooperative. The product is **accepted** when:

- All Must-priority functional requirements (SRS §4) are demonstrated working.
- The automated suites pass (backend + frontend + e2e), with no open critical/security defect.
- The core human scenarios (§4) are completed successfully by representative users.
- Residual/known issues are documented and accepted by the sponsor (see 07-RISK-REGISTER).

---

## 2. Participants & environment

| Role | Name | Organization |
|------|------|--------------|
| Sponsor / acceptor | `[ tên ]` | Trường Khánh cooperative (HTX) |
| Product owner / developer | `[ tên ]` | — |
| Agronomist (engineer) tester | `[ tên ]` | — |
| Farmer tester(s) | `[ tên ]` | — |

| Item | Value |
|------|-------|
| UAT date | `[ ngày nghiệm thu ]` |
| Frontend (PWA) | https://cocondubao.vercel.app |
| Backend | Railway production (`/health` = ok) |
| Test devices | `[ vd: Android tầm trung, trình duyệt Chrome ]` |
| Build / commit under test | `[ commit hash / ngày ]` |

---

## 3. Automated test evidence (summary)

From the baseline test run on 2026-06-30 (see [06-TEST-PLAN](06-TEST-PLAN.md) §9):

| Suite | Passed | Skipped | Failed |
|-------|--------|---------|--------|
| Backend unit/integration (Vitest) | 142 | 2 | 0 |
| Frontend unit/component (Vitest) | 12 | 0 | 0 |
| End-to-end (Playwright, last known) | 3 | 0 | 0 |
| **Total** | **157** | **2** | **0** |

The 2 skipped tests are the opt-in DB-integration flow (intentionally skipped so the suite
never writes to production). Requirement-to-test traceability is in 06-TEST-PLAN §11. The
latest automated results are always available in CI (GitHub Actions).

---

## 4. UAT scenarios (human)

Executed by representative users on real devices. Result legend: **Pass** / **Fail** /
**Partial**. (Maps to Test Plan §6.10.)

| # | Scenario | Steps | Expected result | Result | Notes |
|---|----------|-------|-----------------|--------|-------|
| UAT-01 | Farmer asks by **voice**, unaided | Open app → mic → speak a crop question → send | Readable, sensible answer or a clean "forwarded to engineer" | `[ ]` | `[ ]` |
| UAT-02 | Farmer asks with a **photo** of a diseased leaf | Open camera → take/choose photo → send | Sensible vision answer, or escalation if uncertain | `[ ]` | `[ ]` |
| UAT-03 | **Outdoor readability** | Use app in bright sunlight at largest font | Text legible and usable | `[ ]` | `[ ]` |
| UAT-04 | **Escalation end-to-end** | Farmer asks a hard question → engineer answers in queue → optionally adds to KB | Farmer is notified; answer received; KB optionally grows | `[ ]` | `[ ]` |
| UAT-05 | **Register / login** (phone + 6-digit PIN) | Register, log out, log back in | Account created; login succeeds | `[ ]` | `[ ]` |
| UAT-06 | **Notifications** | Enable notifications; admin sends a broadcast | Notification received (respecting quiet hours) | `[ ]` | `[ ]` |
| UAT-07 | **Community feed** | Create a post (optional image), comment, like | Post/comment/like work; report + admin moderation work | `[ ]` | `[ ]` |
| UAT-08 | **Admin: user management** | Lock/unlock a user; reset a farmer PIN | Lock takes effect promptly; new PIN issued | `[ ]` | `[ ]` |
| UAT-09 | **Weather** | Open weather screen; review an alert draft | Forecast shown; weather alerts require admin approval before sending | `[ ]` | `[ ]` |
| UAT-10 | **Report a wrong answer** | Tap "báo lỗi" on an answer, choose a reason | Report recorded; visible to engineer/admin for review | `[ ]` | `[ ]` |

---

## 5. Defects found during UAT

| ID | Scenario | Severity | Description | Status |
|----|----------|----------|-------------|--------|
| `[ ]` | `[ ]` | Low/Med/High/Critical | `[ ]` | Open / Fixed |

> Defects are logged to `IMPROVEMENTS.md` and tracked to closure; critical/security defects
> block acceptance.

---

## 6. Open items & residual risks

The following are **known and accepted** for the pilot (full detail in
[07-RISK-REGISTER](07-RISK-REGISTER.md) §5):

- Gemini free-tier quota can cause occasional `429` at peak (mitigated by caching/retries;
  billing is the definitive fix).
- Single backend replica (in-process cache/scheduler/rate-limit) — documented scale-out path.
- Public `images` bucket (hard-to-guess paths; pest images auto-purge after 30 days).
- SMS/OTP deliverability in Vietnam (phone+PIN is primary; OTP optional).
- Load/stress testing not automated at pilot scale.

---

## 7. Acceptance decision & sign-off

**Decision:** `[ ] Accepted` · `[ ] Accepted with conditions` · `[ ] Rejected`

Conditions / notes (if any): `[ ............................................. ]`

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Sponsor (HTX) | `[ ]` | `[ ]` | `[ ]` |
| Product owner / developer | `[ ]` | `[ ]` | `[ ]` |
| Agronomist representative | `[ ]` | `[ ]` | `[ ]` |

---

*This report is completed during the acceptance session. Automated evidence (§3) is
regenerated from the test suites; human results (§4–5) and sign-off (§7) are filled in by
the participants.*
