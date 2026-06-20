# Cò Con — Backlog rủi ro / bug / nâng cấp

Danh sách rà soát toàn bộ codebase (2026-06). Sửa lần lượt theo đợt, ưu tiên rủi ro/hạn chế trước.
Trạng thái: ⬜ chưa làm · 🔧 đang làm · ✅ xong.

| ID | Mức | Khu vực | Vấn đề | Hướng sửa | TT |
|----|-----|---------|--------|-----------|----|
| G1 | 🔴 Bug | sw.js | Push icon `/icon.png` không theo brand + bỏ qua `actions/badge/icon` từ payload | Đọc `data.icon/badge/actions`, mặc định `/cocon-icon-bg.png` | ✅ |
| G2 | 🔴 Bug | auth middleware | Khoá tài khoản không hiệu lực tới khi token hết hạn (7–30 ngày) | Denylist in-memory + poller 60s, chặn ngay trong `verifyJWT` | ✅ |
| G3 | 🔴 Bug | notifications | `crops_filter` lưu nhưng dispatch không dùng → lọc cây vô tác dụng | dispatch ưu tiên `crops_filter`, fallback `users.crops` | ✅ |
| G4 | 🔴 Bug | sw.js | Offline đã do vite-plugin-pwa lo; nhưng workbox ghi đè public/sw.js → **push handler mất ở production** (thông báo không hiện, G1/G5 vô hiệu) | Tách `push-sw.js` + `workbox.importScripts` để nạp vào SW prod | ✅ |
| G5 | 🟠 Bug | sw.js | Click notif chỉ `focus()`, không mở đúng `url` | `navigate(url)` rồi focus | ✅ |
| G6 | 🟠 Logic | chat /ask | Insert message không check lỗi → ghi nửa chừng, queue mất | Check `error` insert userMsg, throw nếu fail | ✅ |
| G7 | 🟠 Logic | chat vision | Vision hardcode `confidence 0.9`, không có lối thoát kỹ sư | Phát hiện câu trả lời không chắc → chuyển kỹ sư xem ảnh | ✅ |
| G8 | 🟠 Bảo mật | auth | `request-otp` lộ tồn tại số + vai trò (enumeration) | Bỏ `existingRole` + `isExistingUser` khỏi response | ✅ |
| G9 | 🟠 Hạ tầng | storage | Xóa post/account không xóa ảnh → rác bucket | Xóa file storage kèm post; dọn ảnh user khi xóa account | ✅ |
| G10 | 🟡 Quota | rag | Answer cache key chuỗi y hệt → miss nhiều, phí Gemini | Semantic cache theo embedding cosine ≥ 0.95 | ✅ |
| G11 | 🟡 UX | community | Comment không báo chủ bài | `notifyFarmer` khi có comment (mở đúng bài). Kiểm duyệt/báo cáo: ⏳ cần migration | 🔶 |
| G12 | 🟡 UX | chat | Chỉ có 👎 (report-error), thiếu 👍 + dedup báo lỗi | Dedup báo lỗi (idempotent). 👍 phản hồi tích cực: ⏳ cần bảng mới | 🔶 |
| G13 | 🟡 UX | engineer/admin | Hứa "trả lời trong 24h" nhưng không theo dõi quá hạn | ĐÃ CÓ SẴN: `overdueQueue` + StatCard "Chờ quá hạn 24h" | ✅ |
| G14 | 🟡 Bảo mật | rate-limit | Chat 15/phút theo IP → cả xã chung NAT bị chặn nhầm | Key theo `userId` (JWT) + `ipKeyGenerator` fallback | ✅ |
| G15 | 🟢 DX | repo | `knowledge.js` stub chết; không CI; không Sentry | Xóa stub + CI (vitest/lint/build) + fix eslint SW globals. Sentry: ⏳ cần DSN | 🔶 |
| G16 | 🟢 Nâng cấp | notifications | Đủ nguyên liệu cảnh báo thời tiết/mùa vụ tự động | Scheduler quét Open-Meteo (mưa/nắng/gió/rét) → tạo DRAFT cho admin duyệt rồi gửi | ✅ |

## Lộ trình theo đợt

- **Đợt 1** (bug nhỏ, chạm trực tiếp nông dân): G1 → G5 → G2 → G3
- **Đợt 2** (logic/an toàn dữ liệu): G6 → G7 → G8 → G9
- **Đợt 3** (trải nghiệm & quota): G4 → G10 → G11 → G12 → G13 → G14
- **Đợt 4** (DX & mở rộng): G15 → G16

## Follow-up cần migration DB (psql 17, hỏi user trước khi áp prod)

- **G11b** — Kiểm duyệt cộng đồng: bảng `post_reports`/`comment_reports` (hoặc cờ `reported`+`report_count`), endpoint báo cáo, hàng đợi duyệt cho admin.
- **G12b** — Phản hồi tích cực 👍: bảng `answer_feedback` (message_id, user_id, helpful) + nút ở `AIResult.jsx`; câu nhiều 👍 + confidence cao → gợi ý kỹ sư duyệt thành curated QA.
