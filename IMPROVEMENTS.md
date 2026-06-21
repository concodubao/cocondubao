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
| G11 | 🟡 UX | community | Comment không báo chủ bài + không kiểm duyệt | notify comment + báo cáo post/comment + trang admin duyệt (bảng `content_reports`) | ✅ |
| G12 | 🟡 UX | chat | Chỉ có 👎 (report-error), thiếu 👍 + dedup báo lỗi | Dedup báo lỗi + nút 👍 (bảng `answer_feedback`) | ✅ |
| G13 | 🟡 UX | engineer/admin | Hứa "trả lời trong 24h" nhưng không theo dõi quá hạn | ĐÃ CÓ SẴN: `overdueQueue` + StatCard "Chờ quá hạn 24h" | ✅ |
| G14 | 🟡 Bảo mật | rate-limit | Chat 15/phút theo IP → cả xã chung NAT bị chặn nhầm | Key theo `userId` (JWT) + `ipKeyGenerator` fallback | ✅ |
| G15 | 🟢 DX | repo | `knowledge.js` stub chết; không CI; không Sentry | Xóa stub + CI (vitest/lint/build) + fix eslint SW globals. Sentry: ⏳ cần DSN | 🔶 |
| G16 | 🟢 Nâng cấp | notifications | Đủ nguyên liệu cảnh báo thời tiết/mùa vụ tự động | Scheduler quét Open-Meteo (mưa/nắng/gió/rét) → tạo DRAFT cho admin duyệt rồi gửi | ✅ |

## Lộ trình theo đợt

- **Đợt 1** (bug nhỏ, chạm trực tiếp nông dân): G1 → G5 → G2 → G3
- **Đợt 2** (logic/an toàn dữ liệu): G6 → G7 → G8 → G9
- **Đợt 3** (trải nghiệm & quota): G4 → G10 → G11 → G12 → G13 → G14
- **Đợt 4** (DX & mở rộng): G15 → G16

## Đã làm xong (migration đã áp prod 2026-06-21)

- **G11b** ✅ — `content_reports` (báo cáo post/comment, polymorphic, unique chống spam). Endpoint báo cáo + dọn khi xoá + trang admin `/admin/community-reports`.
- **G12b** ✅ — `answer_feedback` (👍). Endpoint `POST /chat/feedback` + nút "Hữu ích" ở AIResult.

## Follow-up còn lại

- **Sentry** (G15): cần DSN của user (tạo project Node ở sentry.io) → wire vào backend.
- **G12b mở rộng** (tuỳ chọn): trang admin xem câu nhiều 👍 + confidence cao → gợi ý kỹ sư duyệt thành curated QA.
- **G11b mở rộng** (tuỳ chọn): nút báo cáo ở feed Community (hiện mới có ở PostDetail).

## Đợt rà soát 2026-06-22 (luồng kỹ sư + cài đặt thông báo)

Rà toàn bộ backend + các trang frontend chính. Đã sửa & push (`de2c543..0a8e265`).

| ID | Mức | Khu vực | Vấn đề | Hướng sửa | TT |
|----|-----|---------|--------|-----------|----|
| G17 | 🟠 UX | engineer/admin | Câu hỏi chuyển kỹ sư không rõ ai nhận (pool chung, UI chỉ ghi "kỹ sư khác") | Join `assigned_to→users`, hiện tên KS ở thẻ queue + dashboard admin | ✅ |
| G18 | 🔴 Bug | push settings | Lưu cài đặt thông báo khi chưa bật push → trúng 0 dòng nhưng vẫn báo "đã lưu" (mất sạch). Quiet-hours hứa "gửi sau" nhưng thực ra rớt | Trả cờ `noSubscription` + UI báo rõ; sửa text quiet-hours đúng thực tế | ✅ |
| G19 | 🟠 UX | notifications | Nông dân chưa chọn cây bị giấu cảnh báo gắn cây (vd sâu bệnh lúa) | Chưa chọn cây = xem tất cả; đã chọn = lọc như cũ | ✅ |
| G20 | 🟠 Logic | weatherAlerts | Draft cảnh báo đông cứng ngày (dedup `wx:<kind>`) → admin duyệt muộn gửi sai ngày | Dedup gồm ngày (`wx:kind:date`) + dọn draft đã qua ngày | ✅ |
| G21 | 🟠 UX | engineer queue | Xóa câu hỏi khỏi hàng đợi → nông dân chờ vô vọng 24h, không được báo | Chèn system message + push báo nông dân hỏi lại | ✅ |
| G22 | 🟡 UX | chat/AIResult | Badge tin cậy chỉ hiện với `source==='rag'` (bỏ qa_direct/vision/bản cache); qa_direct bị disclaimer thừa | Chuẩn hoá baseSource, hiện tin cậy mọi nguồn AI, qa_direct = "Kỹ sư biên soạn" | ✅ |

### Tồn đọng từ rà soát frontend (chưa sửa)

- **G23** ⬜ 🟠 — `SendNotif`: ô "Gửi đến ai? (vùng/ấp)" KHÔNG lọc thật — `dispatchNotification` bỏ qua `region`; admin gõ vùng tưởng nhắm vùng nhưng gửi cho **tất cả**. Cũng thiếu UI chọn `crop_tags` (backend hỗ trợ). → cần làm region/crop lọc thật hoặc bỏ ô gây hiểu nhầm.
- **G24** ⬜ 🟠 — `NotifDetail` vỡ khi F5 / mở deep-link (phụ thuộc hoàn toàn `location.state`, không có API lấy 1 thông báo theo id như PostDetail/Answer đã có).
- **Nhỏ** ⬜ — `Profile`: lần đầu **đặt** mật khẩu hiện toast "Đổi mật khẩu thành công" thay vì "Đặt".
- **OTP** — mọi vấn đề liên quan để mở rộng sau (Twilio không hỗ trợ tốt ở VN, sẽ đổi provider).
