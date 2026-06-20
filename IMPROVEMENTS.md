# Cò Con — Backlog rủi ro / bug / nâng cấp

Danh sách rà soát toàn bộ codebase (2026-06). Sửa lần lượt theo đợt, ưu tiên rủi ro/hạn chế trước.
Trạng thái: ⬜ chưa làm · 🔧 đang làm · ✅ xong.

| ID | Mức | Khu vực | Vấn đề | Hướng sửa | TT |
|----|-----|---------|--------|-----------|----|
| G1 | 🔴 Bug | sw.js | Push icon `/icon.png` không theo brand + bỏ qua `actions/badge/icon` từ payload | Đọc `data.icon/badge/actions`, mặc định `/cocon-icon-bg.png` | ✅ |
| G2 | 🔴 Bug | auth middleware | Khoá tài khoản không hiệu lực tới khi token hết hạn (7–30 ngày) | Denylist in-memory + poller 60s, chặn ngay trong `verifyJWT` | ✅ |
| G3 | 🔴 Bug | notifications | `crops_filter` lưu nhưng dispatch không dùng → lọc cây vô tác dụng | dispatch ưu tiên `crops_filter`, fallback `users.crops` | ✅ |
| G4 | 🔴 Bug | sw.js | Mất sóng = trắng màn hình; PWA không cache offline | `fetch` handler + precache app shell + cache câu trả lời | ⬜ |
| G5 | 🟠 Bug | sw.js | Click notif chỉ `focus()`, không mở đúng `url` | `navigate(url)` rồi focus | ✅ |
| G6 | 🟠 Logic | chat /ask | Insert message không check lỗi → ghi nửa chừng, queue mất | Check `error` từng bước / gộp giao dịch | ⬜ |
| G7 | 🟠 Logic | chat vision | Vision hardcode `confidence 0.9`, không có lối thoát kỹ sư | Luôn gợi ý hỏi kỹ sư cho câu ảnh / parse độ chắc | ⬜ |
| G8 | 🟠 Bảo mật | auth | `request-otp` lộ tồn tại số + vai trò (enumeration) | Bỏ `existingRole`, cân nhắc bỏ `isExistingUser` | ⬜ |
| G9 | 🟠 Hạ tầng | storage | Xóa post/comment/account không xóa ảnh → rác bucket | Xóa file storage kèm row | ⬜ |
| G10 | 🟡 Quota | rag | Answer cache key chuỗi y hệt → miss nhiều, phí Gemini | Semantic cache theo embedding sim ≥ 0.95 | ⬜ |
| G11 | 🟡 UX | community | Comment không báo chủ bài; không kiểm duyệt/báo cáo | `notifyFarmer` khi có comment + cờ báo cáo | ⬜ |
| G12 | 🟡 UX | chat | Chỉ có 👎 (report-error), thiếu 👍 + dedup báo lỗi | Thêm phản hồi tích cực + chặn spam | ⬜ |
| G13 | 🟡 UX | engineer/admin | Hứa "trả lời trong 24h" nhưng không theo dõi quá hạn | Dashboard hiện câu quá hạn | ⬜ |
| G14 | 🟡 Bảo mật | rate-limit | Chat 15/phút theo IP → cả xã chung NAT bị chặn nhầm | Key theo `userId` cho route đã auth | ⬜ |
| G15 | 🟢 DX | repo | `knowledge.js` stub chết; không CI; không Sentry | Xóa stub, thêm CI vitest+eslint, gắn Sentry | ⬜ |
| G16 | 🟢 Nâng cấp | notifications | Đủ nguyên liệu cảnh báo thời tiết/mùa vụ tự động | Scheduler sinh cảnh báo theo `useWeather`+crop | ⬜ |

## Lộ trình theo đợt

- **Đợt 1** (bug nhỏ, chạm trực tiếp nông dân): G1 → G5 → G2 → G3
- **Đợt 2** (logic/an toàn dữ liệu): G6 → G7 → G8 → G9
- **Đợt 3** (trải nghiệm & quota): G4 → G10 → G11 → G12 → G13 → G14
- **Đợt 4** (DX & mở rộng): G15 → G16
