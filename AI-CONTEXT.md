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

## 3. Kế hoạch bỏ Langchain & tắt thinking

### Lộ trình
| Pha | Nội dung | Trạng thái |
|-----|----------|------------|
| **Pha 0** | Validate tốc độ: tắt thinking + bỏ langchain bọc ngoài giảm 6s → ~1.9s | ✅ Done |
| **Pha 1** | Thay `ChatGoogleGenerativeAI` bằng SDK native `@google/generative-ai` trong `rag.js` | ✅ Done (Antigravity, 2026-06-28) |
| **Pha 2** | Gỡ `@langchain/google-genai`, `@langchain/core`, `@langchain/community` khỏi `package.json` | ✅ Done (Antigravity, 2026-06-28) |
| **Pha 3** | Tự viết `splitTextRecursive` thay `langchain/text_splitter`, gỡ meta `langchain` | ✅ Done (Antigravity, 2026-06-28) |

### Lưu ý kỹ thuật
- SDK `@google/generative-ai` hiện là **v0.24.1**. Chưa có TypeScript type cho `thinkingConfig` nhưng REST API nhận bình thường.
- `@langchain/google-genai` là bản **0.1.3** (chỉ wrapper gọi Gemini). Lõi langchain là **0.3.37**. Comment cũ trong code ghi "langchain 0.1.3" là nhầm.
- Đã cấu hình `thinkingConfig: { thinkingBudgetTokens: 0 }` + giảm `maxOutputTokens` từ 2048 xuống **500**.
- `SYSTEM_PROMPT` chuyển vào `systemInstruction` của model config (thay vì message system).
- Format messages: đổi từ `{ role, content }` (Langchain) sang `{ role: 'user'|'model', parts: [{ text }] }` (Gemini native).

---

## 4. Trạng thái hiện tại của codebase

### Đã hoàn thành gần đây (2026-06-28)
- ✅ G23 (SendNotif cropTags), G24 (NotifDetail fetch by ID), Nhỏ (Profile toast) — đánh dấu done trong IMPROVEMENTS.md.
- ✅ Loại bỏ biến `region` thừa trong `push.js`.
- ✅ Pha 1 bỏ Langchain: `rag.js` giờ dùng native SDK.
- ✅ Pha 2: Gỡ 4 package langchain khỏi dependencies (−141 packages).
- ✅ Pha 3: Thay `RecursiveCharacterTextSplitter` bằng hàm `splitTextRecursive` tự viết. **Không còn bất kỳ dependency langchain nào.**
- Tests 130/130 pass.

### Còn lại
- ⬜ **Sentry** (G15): cần user tạo project trên sentry.io, cung cấp DSN.
- ⬜ **OTP**: đổi provider (Twilio kém ở VN), giữ nguyên code hiện tại.

---

## 5. Quy ước khi AI cập nhật file này

1. Sau khi hoàn thành task quan trọng → thêm vào mục 4 ("Trạng thái hiện tại").
2. Nếu có quyết định kiến trúc mới → thêm vào mục 2 ("Memory items").
3. Giữ file ngắn gọn, tránh lặp lại nội dung đã có trong `CLAUDE.md` hoặc `IMPROVEMENTS.md`.
4. Ghi rõ AI nào thực hiện và ngày, ví dụ: `(Antigravity, 2026-06-28)`.
