# PROGRESS — nhật ký tiến độ chung (Claude Code ⟷ Antigravity)

> File CHUNG để 2 AI (Claude Code và Antigravity) và người dùng cùng nắm tiến độ.
> **Quy ước:** sau mỗi đợt việc, cập nhật (1) "Trạng thái hiện tại" nếu có gì đổi
> về kiến trúc, và (2) thêm 1 dòng vào "Nhật ký thay đổi" (mới nhất ở trên, ghi rõ
> ngày + ai làm + làm gì). Giữ ngắn gọn, chỉ ghi điều NGƯỜI SAU cần biết.
> Tài liệu kiến trúc đầy đủ vẫn ở `CLAUDE.md` — file này là *trạng thái + việc còn lại*.

---

## Trạng thái hiện tại (cập nhật 2026-06-28)

**LLM stack**
- SDK: **`@google/genai` ^2.10.0** — đã GỠ HẲN langchain (kể cả splitter, tự viết `splitTextRecursive` trong `rag.js`).
- Generate: `gemini-2.5-flash`, **thinking TẮT** (`thinkingConfig:{ thinkingBudget:0 }`, `maxOutputTokens:512`) → ~1.8s (trước ~6s). ⚠️ Cú pháp tắt phải là `thinkingBudget` (không phải `thinkingBudgetTokens`); và phải dùng `@google/genai` — SDK cũ `@google/generative-ai` v0.24.1 set thinkingConfig là **lỗi 400 prod**.
- Embed: `gemini-embedding-001`, 1536 chiều, `taskType` RETRIEVAL_DOCUMENT/QUERY. Parse `result.embeddings[0].values` (shape genai). **Đổi SDK KHÔNG cần re-embed** (giữ model+dims+taskType).
- Vision + STT (`chat.js`): `ai.models.generateContent` với `inlineData` base64, parse `result.text`.

**RAG pipeline (`services/rag.js > askRAG`)**
FAQ → cache L1 (in-memory) → cache L2 (DB `answer_cache`, bền qua deploy) → **contextualizeQuery** (ghép chủ đề cho câu nối) → embed → semantic cache (cosine ≥0.95) → pgvector top-5 → qa_direct (sim≥0.80) → LLM. checkFAQ bắt cả câu đế ngắn ("vậy hả", "ờ"...).

**Hạ tầng**
- Deploy auto qua `git push origin master`: Railway (backend) + Vercel (frontend).
- DB migration: máy KHÔNG có PG password trong `.env` → áp bằng **Supabase SQL Editor** hoặc psql 17 thủ công (không dùng `supabase db push`).
- **State in-memory = trần 1 replica**: cache L1, rate-limit, login-lockout, 3 scheduler `setInterval`. Scale >1 replica phải Redis + leader-election. L2 `answer_cache` đã sẵn cross-replica.

---

## Việc còn lại / ý tưởng (chưa làm)

- [ ] **A — Soạn QA "differential"** cho triệu chứng mơ hồ (vàng lá, héo, đốm lá, lép hạt...): mỗi cái liệt kê *nguyên nhân + dấu hiệu phân biệt + cách trị từng loại*. Việc kỹ sư, dùng nút "Soạn Hỏi–Đáp".
- [ ] **B — SYSTEM_PROMPT**: ép khi 1 triệu chứng nhiều bệnh thì PHẢI liệt kê kèm dấu hiệu phân biệt + gợi ý gửi ảnh, KHÔNG chốt 1 bệnh. (User: "để đó".)
- [ ] **Scale**: Redis (cache/rate-limit/lockout) + leader-election scheduler (advisory lock PG) + bật billing Gemini + index pgvector (ivfflat/hnsw).
- [ ] **Realtime engineer queue** (`subscribeEngineerQueue`) nghi là no-op (RLS + anon `auth.uid()`=NULL) → verify hoặc bỏ, dựa polling.
- [ ] **Dọn ảnh chat sâu bệnh cũ** — hiện không tự xoá (chỉ xoá khi user xoá account) → storage phình dần.

## Gotchas (2 AI nên nhớ)
- **PWA SW cache + SPA**: deploy mới KHÔNG tới session đang chạy tới khi reload thật. "Vẫn bị" thường = code cũ. (đã thêm auto-reload `controllerchange` ở `main.jsx`.)
- **sharp** là native module → test phải `vi.mock('sharp', ...)` kẻo CI linux fail.
- **Font-scale**: app dùng 623 chỗ px cứng (0 rem). KHÔNG dùng CSS `zoom` cả trang (vỡ layout). Chỉ phóng nội dung đọc qua biến `--read-scale`.
- **Layout**: `#root` là flex column → trang con cần `width:100%` kẻo `mx-auto` co theo nội dung → tràn ngang trên màn hẹp.

---

## Nhật ký thay đổi (mới nhất ở trên)

- **2026-06-28 · Claude** — RAG hiểu câu nối/câu đế: `checkFAQ` bắt "vậy hả"/"ờ"; `contextualizeQuery` ghép chủ đề trước khi embed (fix Q "còn cách khác"/"vậy hả" lạc đề). +5 test (`db181d6`).
- **2026-06-28 · Antigravity** — migrate `@google/genai` + tắt thinking (1.8s) + fix luân phiên user/model; mock sharp cho CI (`3fcda0b`→`8ffcdd3`).
- **2026-06-28 · Claude** — admin tải ảnh thông báo trực tiếp (`66d90c5`); khép vòng 👍→QA + báo cáo bài ở feed (`add85bd`); answer cache L2 DB (`a087535`); phóng cỡ chữ đọc `--read-scale` (`d56cb31`); G23 lọc cây / G24 thông báo theo id; fix tràn Weather/Notif (`5383c53`); chặn spam push + auto-reload SW (`f667c17`).
- **2026-06-28 · Antigravity** — re-embed an toàn khi 429 + giảm nhiễu cảnh báo mưa (`8e41f79`).
