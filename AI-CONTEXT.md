# AI-CONTEXT.md — Bộ nhớ chia sẻ giữa Claude & Antigravity

File này giúp đồng bộ context khi user chuyển đổi giữa các AI assistant.
Cả Claude và Antigravity đều nên **đọc file này đầu tiên** khi bắt đầu session mới.
Khi hoàn thành một thay đổi quan trọng, AI nào thực hiện nên **cập nhật lại file này**.

---

## 1. Tổng quan dự án

**Cò Con Dự Báo** — PWA tư vấn nông nghiệp cho nông dân xã Trường Khánh, Sóc Trăng.
- Monorepo: `frontend/` (React + Vite) + `backend/` (Express ESM) + `supabase/migrations/`.
- 3 vai trò: `farmer`, `engineer`, `admin`.
- Triết lý thiết kế: "Nông dân lớn tuổi, dùng điện thoại ngoài đồng, nắng chói, một tay".

---

## 2. Memory items (từ Claude)

Danh sách các quyết định và kiến thức đã ghi nhận:

- **[Lộ trình Cò Con]** — Ưu tiên xử lý rủi ro/hạn chế trước, mở rộng tính năng sau.
- **[OTP Twilio giữ tạm]** — Đừng gỡ code OTP; Twilio kém ở VN, sẽ đổi provider sau.
- **[Backlog cải thiện]** — G1–G24 trong IMPROVEMENTS.md, sửa lần lượt theo đợt. Xem IMPROVEMENTS.md cho trạng thái chi tiết.
- **[PWA SW cache + reload]** — Deploy mới không tới session đang chạy tới khi reload thật; "vẫn bị" thường là code cũ.
- **[Migration cần psql của user]** — .env không có mật khẩu Postgres; viết code degrade mềm, user tự áp migration bằng psql.
- **[Phóng cỡ chữ = --read-scale]** — KHÔNG dùng CSS zoom cả trang; chỉ scale nội dung đọc.
- **[Plan bỏ langchain + tắt thinking]** — Xem mục 3 bên dưới.

---

## 3. LLM stack — đã gỡ Langchain & TẮT thinking (DONE, verify API thật)

Hiện dùng **`@google/genai` ^2.10.0** (SDK hợp nhất MỚI của Google), KHÔNG còn langchain (kể cả splitter — tự viết `splitTextRecursive` trong `rag.js`).

| Việc | Trạng thái |
|-----|------------|
| Gỡ langchain (generate + splitter) | ✅ (Antigravity, 2026-06-28) `3fcda0b` |
| Native SDK → đi tiếp lên **`@google/genai`** (KHÔNG dừng ở `@google/generative-ai`) | ✅ `d736363` |
| Tắt thinking → `thinkingConfig:{ thinkingBudget:0 }`, `maxOutputTokens:512` → **~1.8s** (trước ~6s) | ✅ `6b1f0d6` |

### ⚠️ Lưu ý kỹ thuật (ĐỪNG làm sai lại)
- **thinkingConfig CHỈ chạy trên `@google/genai`.** SDK cũ `@google/generative-ai` v0.24.1 set thinkingConfig → **LỖI 400 TRÊN PROD** (dù test local có vẻ ok) → chính là lý do phải lên `@google/genai`. Đã verify GỌI API THẬT trên genai: không 400, ~1.8s, `thoughtsTokenCount` mất, chất lượng giữ.
- Cú pháp tắt đúng: **`thinkingConfig: { thinkingBudget: 0 }`** (KHÔNG phải `thinkingBudgetTokens`).
- **Embed:** `ai.models.embedContent({ model:'gemini-embedding-001', contents, config:{ taskType, outputDimensionality:1536 } })` → parse **`result.embeddings[0].values`**. Giữ model/dims/taskType → **đổi SDK KHÔNG cần re-embed**.
- **Generate:** `ai.models.generateContent({ model:'gemini-2.5-flash', contents, config:{ systemInstruction, temperature, maxOutputTokens:512, thinkingConfig:{thinkingBudget:0} } })` → parse **`result.text`** (property, KHÔNG `.text()`).
- **Vision + STT** (chat.js): cũng `ai.models.generateContent` với `inlineData` base64.
- Messages: `{ role:'user'|'model', parts:[{text}] }`, **bắt buộc luân phiên user/model** (gộp message liền cùng role — `fedd39c`).

---

## 4. Trạng thái hiện tại của codebase

### Đã làm gần đây (2026-06-28)
- ✅ Migrate `@google/genai` + TẮT thinking (~1.8s), verify API thật — `d736363`, `6b1f0d6`.
- ✅ Gỡ HẲN langchain (generate + splitter tự viết `splitTextRecursive`) — `3fcda0b`.
- ✅ RAG hiểu câu nối/câu đế: `checkFAQ` bắt "vậy hả"/"ờ"; `contextualizeQuery` ghép chủ đề trước khi embed (fix lạc đề) — `db181d6`.
- ✅ Answer cache L2 DB (`answer_cache`, bền qua deploy, giảm 429) — `a087535`.
- ✅ Admin tải ảnh thông báo trực tiếp — `66d90c5`. Khép vòng 👍→QA + báo cáo bài ở feed — `add85bd`.
- ✅ Phóng cỡ chữ đọc `--read-scale` (không zoom cả trang) — `d56cb31`. Fix tràn Weather/Notif — `5383c53`. Chặn spam push + auto-reload SW — `f667c17`.
- ✅ G23/G24/Profile-toast; re-embed an toàn khi 429 + giảm nhiễu cảnh báo mưa — `8e41f79`.
- ✅ **B — Kỹ năng chẩn đoán**: SYSTEM_PROMPT ép HỎI NGƯỢC 1 câu / XÚI CHỤP ẢNH khi triệu chứng mơ hồ (vàng lá...), trả thẳng khi câu rõ. Verify API thật: mơ hồ→xúi ảnh, cụ thể→trả thuốc+liều.
- ✅ **Cron dọn ảnh**: `services/storageCleanup.js` xóa `pest-images/` > 30 ngày (mỗi 24h) + null `image_url` message tương ứng. KHÔNG đụng `community/`.
- ✅ **Sentry** (G15): backend `instrument.js` (init ĐẦU TIÊN — ESM hoist), frontend `main.jsx`. Gate production (`NODE_ENV==='production'` / `import.meta.env.PROD`), sampling 0.1, bỏ Replay. DSN qua `SENTRY_DSN`/`VITE_SENTRY_DSN` (fallback hardcode). ⚠️ Railway cần `NODE_ENV=production` thì backend mới bật.
- Tests **138/138 pass**.

### Còn lại
- ⬜ **OTP**: đổi provider (Twilio kém ở VN), giữ code hiện tại.
- ⬜ **A — QA differential** cho triệu chứng mơ hồ: nguyên nhân + dấu hiệu phân biệt + cách trị. ⚠️ LƯU Ý: prompt (B) chỉ tác động câu đi qua LLM; câu đã có **curated QA (qa_direct, sim≥0.80)** thì serve thẳng QA → muốn đổi hành vi phải SỬA QA đó (việc kỹ sư, nút "Soạn Hỏi–Đáp").
- ⬜ **Scale** (trần 1 replica): Redis (cache L1/rate-limit/lockout) + leader-election scheduler (advisory lock PG) + billing Gemini + index pgvector. L2 `answer_cache` đã sẵn cross-replica.
- ⬜ **Realtime engineer queue** nghi no-op (RLS + anon `auth.uid()`=NULL) → verify hoặc dựa polling.
- ⬜ **Dọn ảnh chat sâu bệnh cũ** — không tự xoá (chỉ khi user xoá account) → storage phình dần.

---

## 5. Quy ước khi AI cập nhật file này

1. Sau khi hoàn thành task quan trọng → thêm vào mục 4 ("Trạng thái hiện tại").
2. Nếu có quyết định kiến trúc mới → thêm vào mục 2 ("Memory items").
3. Giữ file ngắn gọn, tránh lặp lại nội dung đã có trong `CLAUDE.md` hoặc `IMPROVEMENTS.md`.
4. Ghi rõ AI nào thực hiện và ngày, ví dụ: `(Antigravity, 2026-06-28)`.
