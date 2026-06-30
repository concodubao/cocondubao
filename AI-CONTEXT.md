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
- **[⚠️ Lockfile]** — Sau khi thêm/đổi dependency: PHẢI chạy `npm install` để đồng bộ `package-lock.json` rồi commit nó. Railway dùng `npm ci` (nghiêm ngặt) — lockfile lệch/thiếu transitive dep → deploy crash `ERR_MODULE_NOT_FOUND` lúc chạy (đã dính với @sentry, commit `1f1a2eb`).

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

### Đã làm gần đây (2026-06-30)
- ✅ **Gate lạc đề — hạn chế đẩy kỹ sư** (Claude): SYSTEM_PROMPT đã xử câu lạc đề ở band confidence ≥ 0.5 (đi qua LLM → từ chối lịch sự, verify câu bóng đá sim 0.602 OK). NHƯNG câu lạc đề rơi **< 0.5** trước đó bị đẩy kỹ sư (phí công). Thêm `looksOffTopic()` ở nhánh `confidence < 0.5`: lạc đề rõ ràng (bóng đá/giải trí/chính trị...) → từ chối lịch sự (`source:'faq'` để frontend không gắn disclaimer/badge & không lọt knowledge-gaps), **0 quota** (token-match, KHÔNG gọi LLM). BẢO THỦ: chỉ từ chối khi khớp chủ đề ngoài NN **và** không có từ khoá NN nào → nghi ngờ vẫn đẩy kỹ sư. ⚠️ Dùng tokenize `\p{L}` chứ KHÔNG `\b` (chữ có dấu đ/ĩ/ố không phải word-char ASCII → `\b` trượt). Bỏ token mơ hồ 'quả' (trùng "kết quả"). +4 test (rag.test.js 142 pass), eval 8/8.
- ✅ **Rà "đạt chuẩn sản phẩm" 3 mảng** (Claude): (1) **Security review** toàn codebase — kết luận rất chắc (IDOR check khắp nơi, role-based, rate-limit nhiều tầng, bcrypt, denylist, PostgREST injection đã strip, 0 `dangerouslySetInnerHTML`). Vá **CSV formula injection** ở `/admin/users/export` (tên/ấp nông dân tự nhập, mở Excel chạy công thức → prefix `'`). Điểm nhỏ còn lại: route `/admin/sentry-test` thực ra unreachable (thiếu `verifyJWT` → 401), bucket `images` public-URL (ảnh sâu bệnh/cộng đồng ai có link đều xem được — path UUID khó đoán). (2) **Khung eval RAG** `backend/eval/` + `scripts/eval_rag.js` + `npm run eval`: chấm hành vi/từ khoá/LLM-judge, exit≠0 dưới ngưỡng (cổng regression). Dataset là MẪU — kỹ sư phải mở rộng `reference` + thêm case từ câu bị 👎. (3) **OPERATIONS.md** (runbook backup PITR/pg_dump + uptime monitor `/health` + quota Gemini) + thêm `healthcheckPath:/health` vào `railway.json`.
- ✅ **Verify thực tế** (Claude): migration `message_bookmarks` ĐÃ áp (PostgREST 200); `NODE_ENV=production` Railway ĐÃ set (`/health` trả env=production → Sentry backend bật). 2 file doc trước ghi "chưa áp/cần xác nhận" là CŨ — đã sửa.
- ✅ **Review + sửa lỗi đợt song song** (Claude rà code Antigravery thêm: quotaMonitor + e2e + integration test + consent Login): (1) `playwright.config.js` gây **4 lỗi lint `process` no-undef → CI frontend đỏ** → thêm block node-globals cho `*.config.js`+`tests/**` trong eslint flat config. (2) `tests/e2e/critical-path.spec.js` viết MÙ (endpoint bịa `/engineer/reply`, `/chat/transfer-engineer`; route `/engineer/chat/:id` sai; KHÔNG tick consent nên nút disabled) → **viết lại khớp code thật** (login-phone/login-email, route `/home`/`/engineer/queue`, tick `#consent`), `webServer` chỉ chạy frontend, **đã `npx playwright install chromium` + chạy thật: 3/3 PASS**. (3) `backend/test/integration/db_flow.test.js` GHI VÀO PROD (dùng `SUPABASE_SERVICE_KEY` prod) → đổi sang yêu cầu `RUN_DB_INTEGRATION=1`+`SUPABASE_TEST_URL/KEY` riêng, có chốt chặn nếu trùng URL prod → `npm test` giờ **skip an toàn** (138 pass + 2 skip). Thêm `test:e2e` script + gitignore rác Playwright.

### Đã làm gần đây (2026-06-29)
- ✅ **Realtime engineer queue → polling** (Claude): verify no-op (RLS chặn anon) rồi thay bằng polling ở Queue/Dashboard/WaitEngineer + gỡ helper chết. Lint 0 error, build OK.
- ✅ **Đợt hoàn thiện 5 phase** (Claude): (1) Nén ảnh client `utils/compressImage.js` (canvas ≤1280px JPEG, fallback file gốc) áp ImageUpload+Community. (2) Giảm bundle: `manualChunks` tách react/supabase/sentry/query + lazy-load trang nông dân phụ → entry **653KB→137KB** (gz 200→44). (3) **Test frontend** (vitest 4 + Testing Library, 12 test: compressImage/AnswerContent/WaitEngineer) + nối CI (`npm test`, node 22). (4) Security review: upload+auth đã chắc (userId từ JWT, isOwnSession, sharp re-encode); vá 2 lỗ high vite dev-server (`npm audit fix`, 0 vuln). (5) **Bookmark câu hữu ích** + **tìm sâu nội dung** lịch sử — xem mục Còn lại về migration.
- ✅ **MIGRATION ĐÃ ÁP** (verify 2026-06-30 qua PostgREST: `message_bookmarks` HTTP 200): `supabase/migrations/20260629000000_message_bookmarks.sql`. Nút "Lưu" (bookmark) hoạt động.

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
- ✅ **Realtime engineer queue** — ĐÃ VERIFY no-op + sửa (Claude, 2026-06-29): anon client (`auth.uid()`=NULL) + `engineer_queue` RLS bật không policy → Realtime bị chặn. Thay bằng polling (Queue 20s / Dashboard React Query 30s / WaitEngineer getMessages 12s, đều pause khi tab ẩn). Chi tiết ở IMPROVEMENTS.md.
- ⬜ **Dọn ảnh chat sâu bệnh cũ** — không tự xoá (chỉ khi user xoá account) → storage phình dần.

---

## 5. Quy ước khi AI cập nhật file này

1. Sau khi hoàn thành task quan trọng → thêm vào mục 4 ("Trạng thái hiện tại").
2. Nếu có quyết định kiến trúc mới → thêm vào mục 2 ("Memory items").
3. Giữ file ngắn gọn, tránh lặp lại nội dung đã có trong `CLAUDE.md` hoặc `IMPROVEMENTS.md`.
4. Ghi rõ AI nào thực hiện và ngày, ví dụ: `(Antigravity, 2026-06-28)`.
