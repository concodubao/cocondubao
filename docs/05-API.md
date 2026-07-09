# REST API Reference — Cò Con Dự Báo

| Field | Value |
|---|---|
| **Document** | 05 — REST API Reference |
| **Base URL (prod)** | `https://laudable-happiness-production-cdfb.up.railway.app` |
| **Base path** | `/api/v1` |
| **Version** | 1.0.0 |
| **Status** | Baseline (reflects `backend/src/routes/*` @ 2026-06-30) |
| **Auth** | Bearer JWT (self-signed) unless marked *public* |
| **Related** | [03-ARCHITECTURE](03-ARCHITECTURE.md) · [04-DATABASE](04-DATABASE.md) · [02-SRS](02-SRS.md) |

---

## Table of contents

1. [Conventions](#1-conventions)
2. [Authentication & authorization](#2-authentication--authorization)
3. [Rate limiting](#3-rate-limiting)
4. [Common errors](#4-common-error-responses)
5. [Endpoint index](#5-endpoint-index)
6. [Auth API](#6-auth-api-apiv1auth)
7. [Chat API](#7-chat-api-apiv1chat)
8. [Engineer & Knowledge API](#8-engineer--knowledge-api)
9. [Admin API](#9-admin-api-apiv1admin)
10. [Community API](#10-community-api-apiv1community)
11. [Push & Notifications API](#11-push--notifications-api)
12. [Health](#12-health)

---

## 1. Conventions

- All paths below are relative to the base path `/api/v1` unless noted.
- Request/response bodies are JSON (`Content-Type: application/json`), except file
  uploads which are `multipart/form-data`.
- Authenticated requests send `Authorization: Bearer <jwt>`.
- IDs are UUIDs. Timestamps are ISO-8601 (`timestamptz`).
- Role guards: **F** = farmer, **E** = engineer, **A** = admin, **public** = no auth,
  **auth** = any authenticated role.
- "Soft-degrade" endpoints return a flag (e.g. `unavailable: true`) instead of `500`
  when a backing table has not been migrated yet.
- **Pagination:** Endpoints returning lists (e.g. `/engineer/history`, `/admin/users`) accept `limit` and `offset` query parameters, and return a `total` field alongside the array to support frontend pagination.

---

## 2. Authentication & authorization

- **Token:** self-signed JWT carrying `{ userId, phone, role, name }`. Issued by the
  login/registration endpoints. Expiry: **7 days** (email accounts), **30 days** (phone
  accounts).
- **`verifyJWT`** rejects missing/expired tokens (`401`) and **locked accounts** (`401`,
  even if the token is still valid — via the in-memory denylist).
- **`requireRole(...)`** returns `403` when the role is not permitted.
- The backend talks to Postgres with the **service-role key**; per-resource ownership
  (IDOR) is enforced in handlers (e.g. only the owning farmer can read a chat session).

---

## 3. Rate limiting

| Scope | Window | Limit | Key | Applies to |
|-------|--------|-------|-----|------------|
| Chat | 60 s | 15 | `user:<id>` else IP | all `/chat/*` |
| Auth | 60 s | 30 | IP | all `/auth/*` |
| OTP | 60 s | 5 | IP | `/auth/request-otp`, `/auth/verify-otp` |
| PIN lockout | 10 min | 5 fails | phone | `/auth/login-phone` |

Exceeding a limit returns `429` with a friendly Vietnamese message.

---

## 4. Common error responses

| Status | Meaning | Example body |
|--------|---------|--------------|
| `400` | Validation error | `{ "error": "Vui lòng nhập câu hỏi." }` |
| `401` | Not authenticated / token expired / account locked | `{ "error": "Phiên đăng nhập đã hết hạn..." }` |
| `403` | Authenticated but not authorized (role / ownership) | `{ "error": "Không có quyền..." }` |
| `404` | Resource not found | `{ "error": "Không tìm thấy..." }` |
| `409` | Conflict (e.g. queue item already taken) | `{ "error": "Câu hỏi này đã được kỹ sư khác nhận." }` |
| `422` | Unprocessable (e.g. file has no text) | `{ "error": "Không đọc được nội dung file..." }` |
| `429` | Rate limited / Gemini quota | `{ "error": "Cò Con đang có nhiều người hỏi..." }` |
| `500` | Server error (generic, no internals leaked) | `{ "error": "Có lỗi xảy ra..." }` |

---

## 5. Endpoint index

| Method | Path | Role | Summary |
|--------|------|------|---------|
| POST | `/auth/request-otp` | public | Send SMS OTP |
| POST | `/auth/verify-otp` | public | Verify OTP → token |
| POST | `/auth/register-phone` | public | Farmer signup (phone + PIN) |
| POST | `/auth/login-phone` | public | Farmer login |
| POST | `/auth/login-email` | public | Staff login |
| POST | `/auth/register-email` | A | Create staff account (admin-only) |
| PATCH | `/auth/set-password` | auth | Set first password/PIN |
| PATCH | `/auth/change-password` | auth | Change password/PIN |
| GET | `/auth/me` | auth | Current profile |
| PATCH | `/auth/profile` | auth | Update profile |
| DELETE | `/auth/account` | auth | Self-delete (soft) |
| POST | `/chat/ask` | auth | Ask (text) via RAG |
| POST | `/chat/ask-with-image` | auth | Ask with pest photo |
| POST | `/chat/stt-fallback` | auth | Speech-to-text (audio) |
| POST | `/chat/escalate` | auth | Request engineer review |
| POST | `/chat/report-error` | auth | Report a bad answer (👎) |
| POST | `/chat/feedback` | auth | Mark answer helpful (👍) |
| POST | `/chat/bookmarks` | auth | Save an answer |
| DELETE | `/chat/bookmarks/:messageId` | auth | Unsave |
| GET | `/chat/bookmarks` | auth | List saved answers |
| GET | `/chat/sessions/:userId` | auth | List own sessions |
| GET | `/chat/messages/:sessionId` | auth/E/A | Messages in a session |
| GET | `/engineer/queue` | E/A | Pending questions |
| GET | `/engineer/queue/:id` | E/A | One queue item |
| PATCH | `/engineer/queue/:id/take` | E/A | Claim (atomic) |
| PATCH | `/engineer/queue/:id/answer` | E/A | Answer/resolve |
| DELETE | `/engineer/queue/:id` | E/A | Delete unanswered item |
| GET | `/engineer/history` | E/A | Own resolved history |
| GET | `/engineer/stats` | E/A | Personal stats |
| POST | `/knowledge/upload` | E/A | Upload KB document |
| POST | `/knowledge/qa` | E/A | Author curated Q&A |
| GET | `/knowledge/docs` | E/A | List documents |
| GET | `/knowledge/docs/:id` | E/A | Document detail |
| PATCH | `/knowledge/:id/approve` | E/A | Approve + embed |
| PATCH | `/knowledge/:id/archive` | E/A | Archive |
| DELETE | `/knowledge/:id` | E/A | Delete draft |
| GET | `/engineer/test-embed` | A | Embedding API diagnostics |
| POST | `/admin/engineers` | A | Create staff |
| GET | `/admin/stats` | A | Dashboard metrics |
| GET | `/admin/knowledge-gaps` | A | Low-confidence questions |
| GET | `/admin/ai-review` | A/E | AI answer quality review |
| POST | `/admin/knowledge-qa` | A/E | Curate a corrected QA |
| GET | `/admin/users` | A | List users |
| GET | `/admin/users/export` | A | CSV export |
| GET | `/admin/users/:id/activity` | A | User activity |
| GET | `/admin/audit` | A | Admin audit log |
| PATCH | `/admin/users/:id` | A | Lock/unlock/role |
| PATCH | `/admin/users/:id/reset-pin` | A | Reset farmer PIN |
| GET | `/admin/ai-errors` | A | List 👎 reports |
| POST | `/admin/ai-errors/:id/to-knowledge` | A | Fix → KB |
| PATCH | `/admin/ai-errors/:id` | A | Mark reviewed |
| GET | `/community/feed` | auth | Post feed |
| GET | `/community/posts/:id` | auth | One post |
| POST | `/community/posts` | auth | Create post |
| DELETE | `/community/posts/:id` | auth | Delete post |
| POST | `/community/posts/:id/like` | auth | Toggle like |
| GET | `/community/posts/:id/comments` | auth | List comments |
| POST | `/community/posts/:id/comments` | auth | Add comment |
| DELETE | `/community/comments/:id` | auth | Delete comment |
| POST | `/community/posts/:id/report` | auth | Report post |
| POST | `/community/comments/:id/report` | auth | Report comment |
| GET | `/community/reports` | A | Moderation queue |
| PATCH | `/community/reports/dismiss` | A | Dismiss report |
| POST | `/push/subscribe` | auth | Register push |
| DELETE | `/push/unsubscribe` | auth | Unregister push |
| POST | `/push/upload-image` | A | Notification image |
| POST | `/push/send` | A | Broadcast/schedule |
| GET | `/push/scheduled` | A | Scheduled (unsent) |
| DELETE | `/push/scheduled/:id` | A | Cancel scheduled |
| GET | `/push/drafts` | A | Weather-alert drafts |
| POST | `/push/drafts/:id/approve` | A | Approve & send draft |
| DELETE | `/push/drafts/:id` | A | Discard draft |
| GET | `/notifications/settings` | auth | Get notif settings |
| PATCH | `/notifications/settings` | auth | Save notif settings |
| GET | `/notifications/item/:id` | auth | One notification |
| GET | `/notifications/:userId` | auth | List notifications |
| PATCH | `/notifications/:id/read` | auth | Mark read |
| GET | `/health` | public | Liveness probe |

> **Dual mounts:** the knowledge/engineer router is served at both `/engineer/*` and
> `/knowledge/*`; the push/notifications router is served at both `/push/*` and
> `/notifications/*`. Either prefix works.

---

## 6. Auth API (`/api/v1/auth`)

### POST `/auth/request-otp` · public · OTP-limited
Send an SMS OTP (Twilio via Supabase Auth). Does **not** reveal whether the number is
registered (prevents account enumeration).
- **Body:** `{ "phone": "0901234567" }`
- **200:** `{ "success": true, "phone": "+84901234567" }`
- **Errors:** `400` invalid phone · `429` provider rate limit

### POST `/auth/verify-otp` · public · OTP-limited
Verify the OTP; creates a farmer account on first verification.
- **Body:** `{ "phone": "...", "otp": "123456" }`
- **200:** `{ "success": true, "token": "<jwt>", "user": { id, phone, role, name, village, crops, hasPassword }, "isNewUser": true }`
- **Errors:** `400` wrong/expired OTP · `403` account locked

### POST `/auth/register-phone` · public
Farmer signup with phone + 6-digit PIN. Token valid **30 days**.
- **Body:** `{ "phone": "...", "password": "123456" }` (PIN = exactly 6 digits)
- **200:** `{ "success": true, "token": "<jwt>", "user": {...}, "isNewUser": bool }`
- **Errors:** `400` invalid phone / PIN not 6 digits / already registered

### POST `/auth/login-phone` · public · PIN lockout
Farmer login. 5 wrong PINs → 10-minute lock for that phone.
- **Body:** `{ "phone": "...", "password": "123456" }`
- **200:** `{ "success": true, "token": "<jwt>", "user": {...}, "isNewUser": bool }`
- **Errors:** `401` not registered / wrong PIN / no PIN set · `403` locked · `429` too many failures

### POST `/auth/login-email` · public
Staff (engineer/admin) login with email + password. Token valid **7 days**.
- **Body:** `{ "email": "...", "password": "..." }`
- **200:** `{ "success": true, "token": "<jwt>", "user": { id, email, phone, role, name, hasPassword }, "isNewUser": bool }`
- **Errors:** `401` wrong credentials · `403` pending approval / locked

### POST `/auth/register-email` · admin
Create an engineer/admin account (admin-only path). New engineers start inactive
(`pending`) until approved; new admins are active.
- **Body:** `{ "email": "...", "password": "...(≥8)", "role": "engineer"|"admin" }`
- **200:** `{ "success": true, "pending": bool }`
- **Errors:** `400` missing fields / weak password / email taken / bad role

### PATCH `/auth/set-password` · auth
Set a password/PIN for the first time (account has none). Farmer ⇒ 6-digit PIN; staff ⇒
≥ 8 chars.
- **Body:** `{ "password": "..." }`
- **200:** `{ "success": true }` · **Errors:** `400` already has password / invalid

### PATCH `/auth/change-password` · auth
Change password/PIN (all roles). New value must differ and satisfy role strength.
- **Body:** `{ "currentPassword": "...", "newPassword": "..." }`
- **200:** `{ "success": true }` · **Errors:** `400` invalid · `401` wrong current

### GET `/auth/me` · auth
- **200:** `{ "user": { id, phone, email, role, name, village, crops, is_active, created_at, hasPassword } }`

### PATCH `/auth/profile` · auth
Update name/village/crops (crops filtered to the valid whitelist).
- **Body:** `{ "name": "...", "village": "...", "crops": ["rice","fruit"] }`
- **200:** `{ "success": true, "user": {...} }`

### DELETE `/auth/account` · auth
Soft-delete: disables account, nulls PII, deactivates push, removes uploaded images.
History is preserved (FKs intact).
- **200:** `{ "success": true }`

---

## 7. Chat API (`/api/v1/chat`)

All endpoints require auth and are chat-rate-limited.

### POST `/chat/ask` · auth
Ask a text question through the RAG pipeline. Persists the conversation and may escalate
to an engineer.
- **Body:** `{ "text": "lúa bị vàng lá trị sao", "cropType": "rice", "sessionId": "<uuid|null>", "testMode": false }`
  - `text` ≤ 1000 chars. `testMode` (engineer/admin only) runs RAG **without** persisting
    or notifying — for the Test-AI screen.
- **200:** `{ "answer": "...|null", "confidence": 0.83, "source": "rag", "sessionId": "<uuid>", "engineerQueued": false, "needEngineer": false, "messageId": "<uuid>" }`
  - When `needEngineer` is true, `answer` is null and the farmer-facing text is a
    "forwarded to engineer" message.
- **Errors:** `400` empty/too long · `403` not owner of `sessionId` · `429` Gemini quota

### POST `/chat/ask-with-image` · auth · multipart
Ask with a pest photo. Image is compressed (`sharp`), uploaded, then analyzed by Gemini
Vision; uncertain vision results escalate to an engineer; vision failure falls back to
text RAG.
- **Form fields:** `image` (file ≤ 10 MB, chỉ nhận `image/jpeg, image/png, image/webp`), `text`, `cropType`, `sessionId`
- **200:** `{ "answer", "confidence", "source": "vision"|"vision_low_conf"|"rag", "sessionId", "imageUrl", "engineerQueued", "needEngineer", "messageId" }`
- **Errors:** `400` non-image · `403` not owner · `429` quota

### POST `/chat/stt-fallback` · auth · multipart
Server-side speech-to-text (iOS Safari fallback). Uses `gemini-2.5-flash-lite`.
- **Form fields:** `audio` (file ≤ 15 MB)
- **200:** `{ "transcript": "..." }` · **Errors:** `400` no file · `500` recognition failed

### POST `/chat/escalate` · auth
Ask an engineer to review an already-answered question.
- **Body:** `{ "messageId": "<answer message uuid>" }`
- **200:** `{ "success": true, "already": bool? }`
- **Errors:** `400` missing · `403` not owner · `404` not found

### POST `/chat/report-error` · auth
Report a wrong/irrelevant/confusing AI answer (👎). Idempotent per user+message.
- **Body:** `{ "messageId": "...", "errorType": "wrong_info"|"irrelevant"|"hard_to_understand", "note": "..." }`
- **200:** `{ "success": true, "already": bool? }`
- **Errors:** `400` invalid type · `403` not owner · `404` not found

### POST `/chat/feedback` · auth
Mark an answer helpful (👍). Upsert (one vote per user+message).
- **Body:** `{ "messageId": "...", "helpful": true }`
- **200:** `{ "success": true }`

### POST `/chat/bookmarks` · auth · soft-degrade
Save an answer.
- **Body:** `{ "messageId": "..." }`
- **200:** `{ "success": true }` or `{ "success": false, "unavailable": true }` (table not migrated)
- **Errors:** `403` not owner · `404` not found

### DELETE `/chat/bookmarks/:messageId` · auth · soft-degrade
- **200:** `{ "success": true }` or `{ "success": false, "unavailable": true }`

### GET `/chat/bookmarks` · auth · soft-degrade
List saved answers (with original question), newest first (≤ 50).
- **200:** `{ "bookmarks": [ { messageId, sessionId, content, source, confidence, cropType, question, savedAt } ] }`

### GET `/chat/sessions/:userId` · auth
List own chat sessions (≤ 30). Only your own id is allowed.
- **200:** `{ "sessions": [ { id, crop_type, status, created_at, messageCount, preview, searchText } ] }`
- **Errors:** `403` other user's id

### GET `/chat/messages/:sessionId` · auth / E / A
Messages in a session. Owner can read; **staff can only read a session that was actually
escalated** to the queue.
- **200:** `{ "messages": [ {...} ] }` · **Errors:** `403` not owner / not escalated · `404` not found

---

## 8. Engineer & Knowledge API

Mounted at `/api/v1/engineer/*` and `/api/v1/knowledge/*`. All require engineer or admin
(except `test-embed` which is admin-only).

### Queue

#### GET `/engineer/queue` · E/A
- **Query:** `status` (default `pending`), `limit` (20), `offset` (0)
- **200:** `{ "queue": [ { id, status, created_at, resolved_at, assigned_to, answer, add_to_knowledge, assignee, messages{ content, image_url, confidence, chat_sessions{ crop_type, users{ name, village, phone } } }, waitMinutes } ], "total": n }`

#### GET `/engineer/queue/:id` · E/A
- **200:** `{ "item": {..., waitMinutes } }` · **Errors:** `404`

#### PATCH `/engineer/queue/:id/take` · E/A
Atomically claim a pending item (`pending → in_progress`).
- **200:** `{ "success": true, "item": {...} }`
- **Errors:** `404` not found · `409` already taken by another engineer

#### PATCH `/engineer/queue/:id/answer` · E/A
Answer (or edit) a question. Optionally add the QA to the knowledge base (background
embed). Engineers may only answer items assigned to them; admins may override.
- **Body:** `{ "answer": "...", "addToKnowledge": false }`
- **200:** `{ "success": true, "addedToKnowledge": bool, "updated": bool }`
- **Errors:** `400` empty answer · `403` assigned to another engineer · `404`

#### DELETE `/engineer/queue/:id` · E/A
Delete an unanswered (`pending`/`in_progress`) item and notify the farmer.
- **200:** `{ "success": true }` · **Errors:** `400` already resolved · `403` · `404`

#### GET `/engineer/history` · E/A
Own resolved questions, paginated, optional crop filter (DB-side inner join).
- **Query:** `crop` (or `all`), `limit` (20), `offset` (0)
- **200:** `{ "history": [...], "total": n }`

#### GET `/engineer/stats` · E/A
- **200:** `{ "totalResolved", "resolvedWeek", "avgResponseHours", "addedToKnowledge" }`

### Knowledge base

#### POST `/knowledge/upload` · E/A · multipart
Upload a PDF/DOCX/TXT (≤ 20 MB); text is extracted and stored as a `draft`.
- **Form fields:** `file`, `title`, `cropTags` (JSON array string), `source`
- **200:** `{ "success": true, "doc": { id, title, status, charCount, estimatedChunks } }`
- **Errors:** `400` no file / no title · `422` unreadable / empty text

#### POST `/knowledge/qa` · E/A
Author a curated Q&A; stored as `"Câu hỏi: ... Câu trả lời: ..."` and embedded in the
background (enables `qa_direct` serving).
- **Body:** `{ "question": "...", "answer": "...", "cropTags": ["rice"] }`
- **200:** `{ "success": true, "docId": "<uuid>" }` · **Errors:** `400` missing fields

#### GET `/knowledge/docs` · E/A
- **Query:** `status`, `crop` · **200:** `{ "docs": [ {..., chunkCount } ] }`

#### GET `/knowledge/docs/:id` · E/A
- **200:** `{ "doc": { id, title, source, crop_tags, status, content, created_at, updated_at } }` · **404**

#### PATCH `/knowledge/:id/approve` · E/A
Set `embedding` and embed in the background (chunks → vectors → `approved`).
- **200:** `{ "accepted": true, "docId": "...", "message": "Đang embed..." }` · **422** no content

#### PATCH `/knowledge/:id/archive` · E/A
- **200:** `{ "success": true }`

#### DELETE `/knowledge/:id` · E/A
Delete a `draft`/`embedding` doc (and its chunks). Approved docs must be archived instead.
- **200:** `{ "success": true }` · **400** not a draft · **404**

#### GET `/engineer/test-embed` · A
Diagnostics: lists Gemini embedding models and runs a probe embed.
- **200:** `{ listStatus, totalModels, embeddingModels, embedTest, listError }`

---

## 9. Admin API (`/api/v1/admin`)

All admin-only unless noted. Mutations are recorded in `admin_audit_log`.

### POST `/admin/engineers` · A
Create an engineer/admin (active immediately).
- **Body:** `{ "email", "password" (≥8), "name", "role": "engineer"|"admin" }`
- **200:** `{ "success": true, "user": { id, email, name, role, is_active, created_at } }`
- **Errors:** `400` missing / weak / email taken

### GET `/admin/stats` · A
Dashboard metrics.
- **200:** `{ totalUsers, totalSessions, totalMessages, pendingQueue, totalNotifs, errorReports, overdueQueue, avgResponseHours, topCrops[], ragRate, sessionsByDay[] }`

### GET `/admin/knowledge-gaps` · A
Recent AI answers with confidence < 0.5 (silent gaps to fill), with their questions.
- **200:** `{ "gaps": [ { question, confidence, created_at } ] }`

### GET `/admin/ai-review` · A/E
AI answer quality review.
- **Query:** `filter` = `all`|`low`|`mid`|`helpful` (default `all`), `limit` (40)
- **200:** `{ "items": [ { question, answer, confidence, source, helpfulCount, created_at } ] }`

### POST `/admin/knowledge-qa` · A/E
Curate a corrected Q&A from the review screen (background embed).
- **Body:** `{ "question", "answer" }` · **200:** `{ "success": true }`

### GET `/admin/users` · A
- **Query:** `role`, `search` (name/phone; injection-stripped), `limit` (50), `offset` (0)
- **200:** `{ "users": [ { id, phone, email, role, name, village, crops, is_active, created_at } ] }`

### GET `/admin/users/export` · A
CSV export (UTF-8 BOM; formula-injection neutralized).
- **Query:** `role` · **200:** `text/csv` attachment `cocon-users.csv`

### GET `/admin/users/:id/activity` · A
Drill-down for phone support: profile, recent sessions, recent questions.
- **200:** `{ user, totalSessions, sessions[], questions[] }` · **404**

### GET `/admin/audit` · A · soft-degrade
- **200:** `{ "logs": [ { admin_name, action, target_name, detail, created_at } ], "ready": bool }`

### PATCH `/admin/users/:id` · A
Lock/unlock or change role. **Admins cannot lock or demote themselves.** Updates the
denylist instantly.
- **Body:** `{ "is_active": bool, "role": "farmer"|"engineer"|"admin" }`
- **200:** `{ "success": true, "user": {...} }` · **400** self-target

### PATCH `/admin/users/:id/reset-pin` · A
Generate a new random 6-digit PIN for a **farmer** (returned so the admin can relay it).
- **200:** `{ "success": true, "pin": "482913", "user": {...} }` · **400** not a farmer · **404**

### GET `/admin/ai-errors` · A
List 👎 reports (with the original question).
- **Query:** `reviewed` (`true`/`false`), `limit` (30), `offset` (0)
- **200:** `{ "errors": [ { id, error_type, note, created_at, reviewed_by, messages{...}, users{ name, phone }, question } ] }`

### POST `/admin/ai-errors/:id/to-knowledge` · A
Rewrite a reported answer into a curated QA, mark the report reviewed, background embed.
- **Body:** `{ "question", "answer" }` · **200:** `{ "success": true }`

### PATCH `/admin/ai-errors/:id` · A
Mark a report reviewed.
- **200:** `{ "success": true }`

> `/admin/sentry-test` exists for error-tracking verification but is effectively
> unreachable (it lacks `verifyJWT`, so `requireRole` returns `401`).

---

## 10. Community API (`/api/v1/community`)

All require auth; report/moderation rules noted.

### GET `/community/feed` · auth
- **Query:** `limit` (20), `offset` (0), `crop`
- **200:** `{ "posts": [ { id, content, image_url, crop_tags, created_at, users{ id, name, village, role }, likeCount, commentCount, likedByMe } ] }`

### GET `/community/posts/:id` · auth
- **200:** `{ "post": {... likeCount, commentCount, likedByMe } }` · **404**

### POST `/community/posts` · auth · multipart
- **Form fields:** `content` (1–1000), `cropTags` (JSON array string), `image` (optional ≤ 10 MB)
- **200:** `{ "post": {... likeCount:0, commentCount:0, likedByMe:false } }` · **400** empty/too long

### DELETE `/community/posts/:id` · auth
Author or admin. Removes the image and related reports.
- **200:** `{ "success": true }` · **403** not author/admin · **404**

### POST `/community/posts/:id/like` · auth
Toggle like.
- **200:** `{ "liked": true|false }`

### GET `/community/posts/:id/comments` · auth
- **200:** `{ "comments": [ { id, content, created_at, users{ id, name, role } } ] }`

### POST `/community/posts/:id/comments` · auth
Add a comment (1–500). Notifies the post author.
- **Body:** `{ "content": "..." }` · **200:** `{ "comment": {...} }` · **400** empty/too long

### DELETE `/community/comments/:id` · auth
Author or admin.
- **200:** `{ "success": true }` · **403** · **404**

### POST `/community/posts/:id/report` · auth
### POST `/community/comments/:id/report` · auth
Report bad content (idempotent per reporter+item).
- **Body:** `{ "reason": "..." }` · **200:** `{ "success": true, "already": bool }` · **404**

### GET `/community/reports` · A
Moderation queue (grouped by content, with preview & report count).
- **200:** `{ "reports": [ { target_type, target_id, count, reasons[], content, author, postId, deleted } ] }`

### PATCH `/community/reports/dismiss` · A
Dismiss reports for an item (keep content).
- **Body:** `{ "targetType": "post"|"comment", "targetId": "..." }` · **200:** `{ "success": true }`

---

## 11. Push & Notifications API

Mounted at `/api/v1/push/*` and `/api/v1/notifications/*`.

### POST `/push/subscribe` · auth
Register a Web Push subscription (upsert by endpoint). Sends a one-time welcome push the
first time a user enables notifications.
- **Body:** `{ "subscription": { "endpoint": "...", "keys": { "p256dh": "...", "auth": "..." } } }`
- **200:** `{ "success": true }` · **400** missing fields

### DELETE `/push/unsubscribe` · auth
- **Body:** `{ "endpoint": "..." }` · **200:** `{ "success": true }`

### POST `/push/upload-image` · A · multipart
Upload a notification illustration → public URL.
- **Form fields:** `image` (≤ 10 MB) · **200:** `{ "url": "https://..." }`

### POST `/push/send` · A
Broadcast immediately or schedule. Targets by `type` opt-in, quiet hours, and crop.
- **Body:** `{ "title", "body", "type": "alert"|"promotion"|"weather", "imageUrl", "cropTags": [], "scheduleAt": "<ISO|null>" }`
- **200 (immediate):** `{ "success": true, "notificationId", "sent", "failed", "total", "message" }`
- **200 (scheduled):** `{ "success": true, "notificationId", "scheduled": true, "scheduledAt", "message" }`
- **400** empty title/body / bad schedule time

### GET `/push/scheduled` · A
Scheduled-but-unsent notifications.
- **200:** `{ "scheduled": [ { id, title, body, type, region, crop_tags, scheduled_at, created_at } ] }`

### DELETE `/push/scheduled/:id` · A
Cancel a scheduled notification (only if unsent).
- **200:** `{ "success": true }` · **400** already sent · **404**

### GET `/push/drafts` · A
System-generated weather-alert drafts awaiting approval.
- **200:** `{ "drafts": [ { id, title, body, type, crop_tags, created_at } ] }`

### POST `/push/drafts/:id/approve` · A
Approve and send a weather draft now.
- **200:** `{ "success": true, "sent", "total" }` · **400** already sent · **404**

### DELETE `/push/drafts/:id` · A
- **200:** `{ "success": true }` · **400** already sent · **404**

### GET `/notifications/settings` · auth
- **200:** `{ "notifTypes": ["alert","promotion","weather"], "quietStart": "22:00", "quietEnd": "06:00", "cropsFilter": [] }`

### PATCH `/notifications/settings` · auth
Per-device settings. If the device has no active subscription, returns a flag instead of
silently succeeding.
- **Body:** `{ "notifTypes": [...], "cropsFilter": [...], "quietStart": "22:00", "quietEnd": "06:00" }`
- **200:** `{ "success": true, "updatedDevices": n }` or `{ "success": false, "noSubscription": true, "error": "..." }`

### GET `/notifications/item/:id` · auth
One sent notification (deep-link / push tap).
- **200:** `{ "notification": {..., read_at, is_read } }` · **404**

### GET `/notifications/:userId` · auth
List notifications for a user (crop-filtered for farmers who chose crops; farmers can only
read their own id).
- **200:** `{ "notifications": [ {..., read_at, is_read } ] }` · **403** other farmer's id

### PATCH `/notifications/:id/read` · auth
Mark a notification read (upsert receipt).
- **200:** `{ "success": true }`

> ⚠️ Route ordering: the static paths `/notifications/settings` and
> `/notifications/item/:id` are declared **before** `/notifications/:userId` so they are
> not shadowed by the `:userId` parameter.

---

## 12. Health

### GET `/health` · public
Liveness/uptime probe (used by Railway healthcheck and external monitors).
- **200:** `{ "status": "ok", "timestamp": "<ISO>", "env": "production" }`

---

*Generated from the route handlers in `backend/src/routes/*`. When an endpoint changes,
update this file in the same change-set.*
