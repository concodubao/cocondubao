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
| G15 | 🟢 DX | repo | `knowledge.js` stub chết; không CI; không Sentry | Xóa stub + CI + fix eslint SW globals. **Sentry ✅** (instrument.js ESM, gate prod, sampling 0.1, bỏ Replay) | ✅ |
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

- **Sentry** (G15): ✅ — backend (instrument.js) + frontend, gate production, sampling 0.1, bỏ Replay. ⚠️ Railway cần `NODE_ENV=production`.
- **G12b mở rộng** ✅ — tab "👍 Được khen" ở màn Soát AI: liệt kê câu nhiều 👍, nút "Duyệt thành QA" điền sẵn (`add85bd`).
- **G11b mở rộng** ✅ — nút báo cáo ở feed Community (`add85bd`).

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

- **G23** ✅ 🟠 — `SendNotif`: Đã thêm UI `cropTags` lọc thật và gỡ bỏ giao diện chọn vùng/ấp không cần thiết.
- **G24** ✅ 🟠 — `NotifDetail`: Đã sử dụng API lấy chi tiết 1 thông báo theo ID (`pushAPI.getNotification`).
- **Nhỏ** ✅ — `Profile`: Lỗi text toast đã được khắc phục đúng logic ("Đặt mật khẩu thành công!").
- **OTP** — mọi vấn đề liên quan để mở rộng sau (Twilio không hỗ trợ tốt ở VN, sẽ đổi provider).

## Đợt 2026-06-28 (bảo mật + UX field + LLM stack + RAG hội thoại)

| ID | Mức | Khu vực | Vấn đề | Hướng sửa | TT |
|----|-----|---------|--------|-----------|----|
| H1 | 🟠 Bảo mật | chat | IDOR: `getOrCreateSession` không kiểm chủ phiên → chèn tin nhắn vào phiên người khác qua `sessionId` | `isOwnSession` check ở `/ask` + `/ask-with-image` | ✅ |
| H2 | 🟡 Bảo mật | auth | Đổi mật khẩu hạ được xuống 6 ký tự (tạo tài khoản yêu cầu ≥8) | `validateSecret` theo vai trò (farmer PIN 6 số / staff ≥8) | ✅ |
| H3 | 🟡 UX | rate-limit | Auth 10/phút/IP → cả xã chung NAT bị chặn nhầm | Nâng 30/phút (đã có chống dò PIN + otpLimiter) | ✅ |
| H4 | 🟡 UX | weather | Hero/thẻ luôn 1 màu xanh + nhãn "giờ xấu nhất" → tưởng cả ngày mưa | Màu theo điều kiện + tổng hợp ban ngày + nhãn "giông chiều" | ✅ |
| H5 | 🔴 Bug | push | Spam welcome push mỗi lần mở app (Home auto-subscribe + churn endpoint) | usePush tái dùng sub; welcome chỉ khi user chưa có sub active; bỏ auto-subscribe | ✅ |
| H6 | 🔴 Bug | layout | Weather/NotifList tràn ngang màn hẹp (flex item `mx-auto` co theo nội dung) | `width:100%` ở gốc trang (verify Playwright @360px) | ✅ |
| H7 | 🟡 UX | TTS | Giọng vi-VN đọc sai viết tắt EN (NPK, pH, kg, AI...) | `normalizeForSpeech`: bóc markdown + phiên âm + đánh vần | ✅ |
| H8 | 🟡 UX | notifications | Nông dân không tự xóa được thông báo | Ẩn theo thiết bị (localStorage) + nút thùng rác | ✅ |
| H9 | 🟢 Nâng cấp | knowledge | Soạn QA chỉ từ màn Soát AI | Nút "Soạn Hỏi–Đáp" trong Kho tri thức (`POST /knowledge/qa`) | ✅ |
| H10 | 🟡 Quota | rag | Cache in-memory mất mỗi deploy | L2 DB `answer_cache` (cần migration, degrade mềm) | ✅ |
| H11 | 🟡 UX | font-scale | CSS `zoom` cả trang gây vỡ layout Android/iOS | Biến `--read-scale` chỉ phóng nội dung đọc (AnswerContent + NotifDetail) | ✅ |
| H12 | 🟢 Nâng cấp | LLM | Langchain khoá bản cũ, thinking ăn quota/chậm | Gỡ langchain → `@google/genai` + tắt thinking (~1.8s) — xem AI-CONTEXT mục 3 | ✅ |
| H13 | 🔴 Bug | rag | Câu nối/câu đế ("còn cách khác", "vậy hả") mất ngữ cảnh → trả lời lạc đề | `checkFAQ` bắt câu đế + `contextualizeQuery` ghép chủ đề trước embed | ✅ |
| H14 | 🟢 Nâng cấp | rag | Triệu chứng mơ hồ ("vàng lá") → AI xổ list bệnh, bà con rối | SYSTEM_PROMPT: triệu chứng chung chung → HỎI NGƯỢC 1 câu / XÚI CHỤP ẢNH; câu rõ → trả thẳng. Verify API thật | ✅ |
| H15 | 🟢 Hạ tầng | storage | Ảnh chat sâu bệnh lưu vĩnh viễn → bucket phình, tốn tiền | `storageCleanup.js`: cron 24h xóa `pest-images/` > 30 ngày + null `image_url`. KHÔNG đụng `community/` | ✅ |

## Đợt 2026-06-29 (hoàn thiện: ảnh/bundle/test/security/bookmark)

| ID | Mức | Khu vực | Vấn đề | Hướng sửa | TT |
|----|-----|---------|--------|-----------|----|
| I1 | 🟢 Hạ tầng | realtime | Realtime engineer_queue no-op (RLS chặn anon, auth.uid()=NULL) | Verify + thay bằng polling (Queue 20s/Dashboard 30s/WaitEngineer 12s, pause khi tab ẩn) | ✅ |
| I2 | 🟡 UX/quota | upload | Ảnh camera 3–8MB → upload lâu, phình bucket, tốn token vision | `utils/compressImage.js` (canvas ≤1280px JPEG, fallback gốc) ở ImageUpload+Community | ✅ |
| I3 | 🟢 Perf | bundle | 1 chunk ~653KB, trang nông dân import thẳng | manualChunks tách vendor + lazy-load trang phụ → entry 137KB (gz 44) | ✅ |
| I4 | 🟢 DX | test | Frontend 0 test | vitest 4 + Testing Library, 12 test critical-path + nối CI (node 22) | ✅ |
| I5 | 🟢 Bảo mật | deps | 2 lỗ high vite (dev-server) | `npm audit fix` → 0 vuln; upload/auth rà thủ công đã chắc | ✅ |
| I6 | 🟢 UX | history | Thiếu lưu câu hữu ích; search chỉ khớp preview | Bookmark (`message_bookmarks`) + tab "Đã lưu" + getSessions trả `searchText` tìm sâu | ✅ |

✅ **I6 migration đã áp** `20260629000000_message_bookmarks.sql` (verify 2026-06-30 qua PostgREST: bảng `message_bookmarks` trả HTTP 200).

## Đợt 2026-06-30 (đạt chuẩn sản phẩm: security review + eval RAG + vận hành)

| ID | Mức | Khu vực | Vấn đề | Hướng sửa | TT |
|----|-----|---------|--------|-----------|----|
| J1 | 🟠 Bảo mật | admin export | CSV formula injection: tên/ấp nông dân tự nhập bắt đầu `= + - @` → Excel chạy như công thức | `esc()` prefix `'` để ép text | ✅ |
| J2 | 🟢 DX/chất lượng | rag | Không có cách đo chất lượng trả lời → đổi prompt/model "mù" | Khung eval `backend/eval/` + `scripts/eval_rag.js` + `npm run eval` (hành vi + từ khoá + LLM-judge, exit≠0 dưới ngưỡng) | ✅ |
| J3 | 🟢 Hạ tầng | ops | Thiếu runbook backup/monitoring/quota; Railway không healthcheck | `OPERATIONS.md` + `healthcheckPath:/health` trong `railway.json` | ✅ |

**Security review kết luận:** codebase rất chắc. Còn lại (chấp nhận/để ý, chưa cần sửa gấp): `/admin/sentry-test` unreachable (thiếu `verifyJWT`); bucket `images` dùng public URL (path UUID khó đoán nhưng ai có link đều xem); JWT nông dân 30 ngày (denylist + poller 60s đã chặn khoá tức thì). Prompt injection: blast radius hẹp (chat của chính mình, không lộ dữ liệu riêng).

**eval RAG — việc tiếp của kỹ sư:** `dataset.json` mới là mẫu khởi tạo; phải mở rộng `reference` theo chuyên môn + thêm case từ mọi câu bị 👎 (chống tái phát). Chạy `npm run eval` trước mỗi lần đổi SYSTEM_PROMPT/model/threshold.

## Đợt 2026-10-25 (rà toàn bộ codebase: deps + bảo mật + logic) — Claude

Rà lại toàn bộ backend + frontend sau ~3.5 tháng không đụng. Tests backend 142 → **158 pass** (+16 test mới), frontend 12 pass, lint 0, build OK.

| ID | Mức | Khu vực | Vấn đề | Hướng sửa | TT |
|----|-----|---------|--------|-----------|----|
| K1 | 🔴 Bảo mật | deps | Backend 16 lỗ (1 critical, 10 high: multer DoS, body-parser, xmldom, ip-address SSRF, sharp/libvips CVE…), frontend 17 (vite, zod…) | `npm update` trong semver + sharp 0.34→0.35.5 (ảnh user upload đi qua libvips). Cả 2: **0 vuln**. Verify npm 10 `npm install --legacy-peer-deps` (Railway) + `npm ci` (CI) chạy được lockfile mới | ✅ |
| K2 | 🔴 Bảo mật | push | SSRF: `/push/subscribe` nhận endpoint bất kỳ, server POST tới đó ngay (welcome) → user nào cũng bắn được request vào mạng nội bộ/metadata cloud | Whitelist https + host push service thật (FCM/Mozilla/Apple/WNS), không cổng lạ | ✅ |
| K3 | 🔴 Bảo mật | auth | Hạ vai trò (admin→farmer) không có hiệu lực tới khi JWT hết hạn (7–30 ngày) | Map vai trò staff in-memory (poller 60s + `setUserRole` tức thì) → token staff sai vai trò = 401 | ✅ |
| K4 | 🟠 Bảo mật | auth | `register-phone` set `is_active:true` → tài khoản bị khoá (chưa có PIN) tự "mở khoá" bằng cách đăng ký | Tài khoản bị khoá → 403, không đụng `is_active` | ✅ |
| K5 | 🟠 Bảo mật | auth | Đăng nhập email (staff/admin) không có khoá dò mật khẩu; Map khoá dò PIN phình vô hạn | Khoá chung 5 sai/10 phút cho cả SĐT + email, cửa sổ quên 30 phút, trần 10k entry | ✅ |
| K6 | 🟠 Riêng tư | auth | Tự xoá tài khoản giữ lại SĐT/email/hash (PII) + không đăng ký lại được số đó | Xoá cả phone/email/password_hash + denylist ngay; đăng ký lại = tài khoản mới, không kéo lịch sử cũ | ✅ |
| K7 | 🔴 Bug | rag | Mọi QA biên soạn (crop_tags rỗng) **vô hình** với nông dân đã chọn cây (RPC lọc `= ANY(crop_tags)`; ChatMain mặc định cây đầu trong hồ sơ) → câu đã có QA vẫn bị đẩy kỹ sư/LLM | `searchChunks`: RPC không lọc, lọc ở JS — tags rỗng = mọi cây. Không cần migration | ✅ |
| K8 | 🔴 Bug | rag | Câu nối ("còn cách khác") bị cache theo chuỗi → người sau hỏi cùng chuỗi về bệnh khác nhận câu trả lời của người trước | Câu nối bỏ qua mọi tầng cache (L1/L2/semantic) cả đọc lẫn ghi | ✅ |
| K9 | 🟠 Logic | rag | Kỹ sư sửa/lưu trữ tài liệu sai nhưng câu sai đã cache vẫn trả thêm tới 1h | `invalidateAnswerCaches()` khi embed xong/lưu trữ | ✅ |
| K10 | 🟠 Logic | rag | LLM trả rỗng → lưu message null (bong bóng trống); retry 429 có thể chờ quá timeout 45s của client | Rỗng → chuyển kỹ sư; trần tổng retry 30s | ✅ |
| K11 | 🔴 Bug | notifications | Giờ yên tĩnh tính theo `getHours()` = **UTC** trên Railway → khung 22:00–06:00 chặn 05:00–13:00 giờ VN và GỬI lúc nửa đêm | Tính theo giờ VN (UTC+7); test đặt giờ UTC tường minh | ✅ |
| K12 | 🔴 Bug | notifications | Danh sách thông báo embed lượt đọc của MỌI user → 1 người đọc là hiện "đã đọc" với tất cả | Lọc `notification_reads.user_id` | ✅ |
| K13 | 🟠 UX | notifications | Push gắn cây không gửi cho người chưa chọn cây (danh sách trong app thì hiện, G19) → lỡ cảnh báo | Chưa chọn cây = nhận tất cả (khớp G19) | ✅ |
| K14 | 🟠 Logic | chat/engineer | Insert `engineer_queue` / message trả lời của kỹ sư không kiểm lỗi → báo "đã chuyển kỹ sư"/"đã trả lời" nhưng thực ra mất | Kiểm lỗi (`enqueueForEngineer`), kỹ sư trả lời câu chưa nhận thì gán `assigned_to` (hiện trong lịch sử/thống kê) | ✅ |
| K15 | 🟡 UX | ảnh | sharp bỏ EXIF mà không `rotate()` → ảnh chụp dọc (khi client không nén được) bị nằm ngang | `.rotate()` ở chat/community/push | ✅ |
| K16 | 🟡 Hạ tầng | API | Lỗi multer/JSON rơi vào handler HTML mặc định của Express; body JSON 10MB | Error handler JSON (413/400/500 chung) + body 1MB; fail-fast khi thiếu `JWT_SECRET` | ✅ |
| K17 | 🟡 Logic | admin | Thống kê theo ngày dùng ngày UTC; PIN reset bằng `Math.random`; limit/offset không chặn; `/admin/sentry-test` thiếu `verifyJWT` | timeZone VN, `crypto.randomInt`, `pageParams`, thêm verifyJWT | ✅ |
| K18 | 🟡 Validate | nhiều route | cropType/crop_tags/note/cài đặt thông báo không validate (rác vào DB, JSON lạ → 500, giờ hỏng làm scheduler parse lỗi) | Whitelist cây, giới hạn độ dài, regex HH:MM(:SS) | ✅ |
| K19 | 🟡 Bug | frontend STT | Mỗi lần ghi âm rò 1 `AudioContext` (Chrome giới hạn ~6) → hỏi vài câu là visualizer hỏng; rời trang khi đang ghi vẫn upload | Đóng context khi dừng; unmount bỏ upload + tắt mic | ✅ |
| K20 | 🟢 Bảo mật | Vercel | Frontend không có security header | `vercel.json`: nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, HSTS; SW/manifest no-cache | ✅ |
| K21 | 🟢 DX | CI | CI backend Node 20, Railway Node 22 | CI → Node 22 | ✅ |

**Chưa làm (cần quyết định/việc của user):** OTP provider; billing Gemini; Scale (Redis…); `match_knowledge_chunks` vẫn còn tham số `filter_crop` (giờ code luôn truyền null — để nguyên, không cần migration). JWT_SECRET prod chưa kiểm được độ dài (server chỉ cảnh báo nếu < 32 ký tự). Playwright e2e chưa chạy lại đợt này.

## Đợt 2026-10-26 (sửa theo security audit — Claude)

Audit bằng skill `cloudflare/security-audit-skill` (cài ở `.claude/skills/security-audit`, profile quick, output `~/security-audit-skill/cocon-du-bao/run-1/`). Dừng sau Phase 2 (hunting) theo quyết định chủ dự án → **15 lead chưa được verifier độc lập xác nhận** (máy không có sandbox nên mọi lead đều `needs_validation`). Sửa thẳng các lead sửa được bằng code; backend tests 158 → **168 pass**.

| ID | Mức | Khu vực | Vấn đề | Hướng sửa | TT |
|----|-----|---------|--------|-----------|----|
| L1 | 🔴 Bảo mật | auth | `register-phone` gán PIN cho tài khoản CÓ SẴN chưa có PIN mà không chứng minh sở hữu SĐT → chiếm tài khoản (cả role staff nếu đã nâng quyền) | Số đã có tài khoản → 409, nhờ admin "Đặt lại PIN" | ✅ |
| L2 | 🔴 Bảo mật | DB/RLS | `users_self` FOR ALL không WITH CHECK → phiên Supabase Auth tự chèn dòng users role admin rồi login-email | Migration `20261025000000_security_hardening.sql`: drop mọi policy client + revoke quyền ghi anon/authenticated | ⬜ **cần user áp** |
| L3 | 🔴 Bảo mật | secrets | `backend/.env` thật nằm trong lịch sử git (repo PUBLIC): service_role JWT legacy (hết hạn 2036), VAPID private key (chưa đổi) | Supabase: tắt legacy API keys / rotate JWT secret; tạo cặp VAPID mới | ⬜ **việc của user** |
| L4 | 🟠 Bảo mật | auth | Đổi PIN / admin đặt lại PIN không thu hồi token cũ (30 ngày); mở khoá hồi sinh token cũ | `users.tokens_valid_after` + `revokeTokens()` (đổi PIN, reset-pin, khoá); đổi PIN trả token mới. Degrade mềm khi chưa áp migration | ✅ (đủ hiệu lực sau migration) |
| L5 | 🟠 Bảo mật | rag | Cache dùng chung lưu câu trả lời sinh KÈM lịch sử phiên của 1 nông dân → phát cho người khác | Chỉ ghi cache khi sinh không có lịch sử (đọc vẫn được) | ✅ |
| L6 | 🟠 Bảo mật | rag | Câu hỏi nông dân chứa "Câu trả lời:" → `extractCuratedAnswer` trả chữ nông dân như QA kỹ sư duyệt | `buildQaContent()` vô hiệu dấu phân cách trong câu hỏi (4 chỗ tạo QA) | ✅ |
| L7 | 🟠 Riêng tư | frontend | Đăng xuất không huỷ push + không xoá Workbox `api-cache` → máy dùng chung lộ /auth/me, bookmark, thông báo riêng của người trước | `utils/clearSession.js`: logout huỷ push (server+trình duyệt) + xoá api-cache; xoá cache cả khi 401 và khi login | ✅ |
| L8 | 🟠 Availability | backend | Express 4 không bắt reject của handler async → body dị dạng (phone là số…) làm treo request / sập process khi không có Sentry | `middleware/asyncErrors.js` (như express-async-errors) + `unhandledRejection` logger + `requestTimeout`; type-check `normalizePhone`, community | ✅ |
| L9 | 🟠 Availability | upload | DOCX zip bomb bung toàn bộ trong heap; nội dung không giới hạn → hàng chục nghìn lệnh embed; Duyệt 2 lần → 2 vòng embed | Bung thử có `maxOutputLength` (60MB) trước mammoth; `MAX_DOC_CHARS` 400k; approve chuyển trạng thái có điều kiện (409); pdftotext timeout 60s | ✅ |
| L10 | 🟡 Abuse | community/push | Không rate-limit ghi: đăng ảnh vô hạn (bucket không dọn), spam bình luận → spam push chủ bài | `writeLimiter` 20 ghi/phút/user cho community/push/knowledge (GET không tính) | ✅ |
| L11 | 🟡 Bảo mật | admin CSV | Chống formula injection chỉ xét ký tự đầu → `x;=1+1` thành ô công thức trong Excel vi-VN (phân cách `;`) | Vô hiệu `= + - @` sau mọi dấu phân cách + luôn bọc ngoặc kép | ✅ |
| L12 | 🟡 UX/Bảo mật | auth | Sai mật khẩu cũ khi đổi trả 401 → interceptor đá ra màn login | Trả 400 | ✅ |
| L13 | 🟢 Hardening | nhiều nơi | push-sw điều hướng URL bất kỳ trong payload; engineer queue không chặn limit; cropTags upload không whitelist; client Supabase thừa ở frontend | SW chỉ nhận path `/...`; `pageParams`; whitelist cây; gỡ `services/supabase.js` + dependency | ✅ |
| L14 | 🟡 Riêng tư | storage | Ảnh chat sâu bệnh ở bucket public, URL vĩnh viễn, prefix theo userId (lộ qua feed) | Chuyển bucket private + signed URL ngắn hạn (cần backend chạy để làm & test) | ⬜ |

### Rà lại bản vá L (2026-10-31, 4 reviewer độc lập, guidance mode, `~/security-audit-skill/cocon-du-bao/diff-review-1/`)

Xác nhận đúng: bản vá Express async (phủ cả route handler, giữ Sentry, không double-next), chặn chiếm tài khoản register-phone, vô hiệu marker QA, cổng DOCX dùng chung JSZip với mammoth, migration không đụng service_role/RPC. Lỗi/hồi quy tìm thấy và đã sửa:

| ID | Loại | Vấn đề | Sửa |
|----|------|--------|-----|
| M1 | Hồi quy | Đăng xuất huỷ push trình duyệt → kỹ sư âm thầm mất thông báo hàng đợi (trang staff không dùng usePush); nông dân nhận lại welcome mỗi lần login | `resyncDevicePush` ở App.jsx (mọi vai trò, không hỏi lại quyền) + cờ opt-out theo user khi chủ động tắt; welcome chỉ khi user CHƯA TỪNG có subscription |
| M2 | Bảo mật | Phiên kết thúc do 401 (hết hạn/thu hồi) không dọn push → thông báo riêng của người trước vẫn tới máy | Interceptor 401 dọn push trình duyệt + cache (có timeout) trước khi rời trang |
| M3 | Hồi quy | Đổi PIN: request bay bằng token cũ / tab khác 401 → xoá token MỚI, đá ra login | Chỉ kết thúc phiên khi token của request lỗi = token đang lưu |
| M4 | Bảo mật | Hạ quyền rồi nâng lại / mở khoá tài khoản khoá từ trước → hồi sinh token cũ; xoá account không thu hồi | `revokeTokens` cả khi khoá, mở khoá, đổi vai trò, tự xoá tài khoản |
| M5 | Bảo mật | Poller: khối lỗi `return` sớm bỏ qua khối sau; mốc thu hồi có thể vượt trần 1000 dòng PostgREST | Khối độc lập; chỉ nạp mốc 31 ngày gần nhất, phân trang |
| M6 | Hồi quy | 1 bucket 20 ghi/phút dùng chung push/notifications/engineer/community → đọc ~7 thông báo là bị 429 | Bỏ giới hạn ở push/notifications (ghi idempotent); community 20/phút, staff 60/phút, bộ đếm riêng |
| M7 | Bảo mật | Cổng DOCX 60MB vẫn cho XML ~60MB → mammoth dựng DOM nhiều GB | word/*.xml ≤ 8MB, tổng ≤ 30MB, fail-closed khi JSZip đổi nội bộ, phân biệt "hỏng"/"quá lớn" |
| M8 | Hồi quy | Tài liệu kẹt 'embedding' (sập giữa chừng) không bao giờ Duyệt lại được (409) | Cho Duyệt lại khi kẹt > 30 phút |
| M9 | Bảo mật | Chặn URL ở push-sw bị vượt bằng `/\host`, `/<TAB>/host` | So origin bằng `new URL()` |
| M10 | Hardening | reject giá trị falsy lọt sang route sau; error handler không kiểm headersSent; headersTimeout > requestTimeout (vô hiệu) | Sửa cả 3 + `server.timeout` 150s; migration: default privileges `FOR ROLE postgres`, thu quyền EXECUTE RPC vector của anon |

Còn lại (thấp, có chủ ý chưa làm): race login đọc hash cũ trùng giây đổi PIN; chat limiter key tin token chưa kiểm thu hồi; cache vẫn có thể bị "mớm" ngay trong câu hỏi đầu (không lịch sử) — phạm vi hẹp, có từ trước.

**Ghi chú audit (chưa xử lý, rủi ro thấp/thiết kế):** staff đọc toàn bộ phiên chat một khi đã escalate; `knowledge_docs` phê duyệt 1 người (không 4-mắt); dọn ảnh khi xoá account chỉ lấy 100 file/thư mục (storage list mặc định); orphan ảnh khi insert post lỗi.

### Còn mở (ngoài Sentry/OTP)
- ⬜ **A** — soạn QA *differential* cho triệu chứng mơ hồ (vàng lá/héo/đốm lá): nguyên nhân + dấu hiệu phân biệt + cách trị. ⚠️ B (prompt, H14) chỉ tác động câu qua LLM; câu có curated QA (qa_direct) thì serve thẳng QA → sửa hành vi phải sửa QA (việc kỹ sư).
- ⬜ **Scale** — Redis + leader-election scheduler + billing Gemini + index pgvector (trần 1 replica). (H15 cron cũng cần leader-election khi >1 replica.)
- ✅ **Realtime engineer queue** — ĐÃ VERIFY là no-op (2026-06-29): client chỉ có anon key (app dùng JWT tự ký, không Supabase Auth → `auth.uid()`=NULL), `engineer_queue` bật RLS **không có policy nào** → Realtime bị RLS chặn SELECT → 0 event. Cả 3 subscription (Queue/Dashboard/WaitEngineer) đều chết. **Đã thay bằng polling:** Queue 20s + pause khi tab ẩn; Dashboard đã sẵn React Query 30s (gỡ realtime chết); WaitEngineer poll `getMessages` 12s phát hiện message `role:'engineer'` mới → tự nhảy về chat. Gỡ helper chết `subscribeEngineerQueue`. (Không mở RLS `USING(true)` vì lộ câu hỏi nông dân cho anon key.)

## Đợt 2026-11-12 (rà toàn bộ codebase — Claude) — ghi nhận N1–N25, mới sửa N1 + N2

**Đã sửa (2026-11-12, Claude; chưa commit/deploy):**
- **N1** — `checkFAQ` viết lại (`rag.js`): lời xã giao chỉ khớp khi CẢ câu là xã giao (`faqWhole`); câu hỏi về Cò Con phải gọi tên Cò Con/bạn hoặc đứng một mình và bị bỏ qua nếu có từ khoá nông nghiệp (`botDirected`); ranh giới từ bằng `\p{L}\p{N}` thay `\b`; chuẩn hoá NFC. +5 test (`rag.test.js`). Hệ quả cần biết: câu tán gẫu không khớp FAQ và không có từ khoá lạc đề giờ đi vào RAG (có thể tới hàng đợi kỹ sư) thay vì nhận câu chào — chấp nhận, vì nuốt câu hỏi thật tệ hơn.
- **N2** — `SendNotif.jsx` gửi ISO có múi giờ, `min` theo giờ máy, màn kết quả hiện "Sẽ gửi lúc …"; `push.js` thêm `parseScheduleAt()` coi chuỗi thiếu múi giờ là UTC+7 (đỡ cho bản PWA cũ còn trong cache). +5 test (`push.scheduled.test.js`). Thông báo đã lên lịch TRƯỚC bản vá vẫn lệch 7 tiếng trong DB → huỷ và tạo lại.
- Backend 184 pass, frontend lint 0 / 12 test pass / build OK.

**Đã sửa (2026-11-13, Claude — phát hiện khi quay video demo trên production):**
- **N3 (XÁC NHẬN trên prod)** — prod CÒN `messages_source_check`: phiên chat demo chỉ có câu hỏi, câu trả lời `qa_direct` không được lưu → "Hỏi lại kỹ sư" 404, hàng đợi trống. `chat.js` thêm `insertAnswerMessage()` (2 chỗ: `/ask` + `/ask-image`): log lỗi, gặp 23514 thì lưu lại với `source=null` (hết mất câu trả lời ngay khi deploy). Migration `20261113000000_messages_source_check.sql` gỡ constraint — **user áp bằng psql** để giữ nhãn source. +4 test (`chat.access.test.js`).
- **N24 (phần reload)** — `main.jsx`: `controllerchange` chỉ reload khi trước đó ĐÃ có SW điều khiển (cập nhật thật); lần đầu mở app không reload nữa (trước đây xoá chữ/câu hỏi người mới đang gõ).
- Công cụ quay demo: `frontend/demo/record-demo.mjs` (Playwright + Chrome cài sẵn; người dùng tự đăng nhập, script không đụng mật khẩu; output `frontend/demo/out/`, đã gitignore).
- Backend 188 pass.

Đọc toàn bộ backend (routes, services, middleware, migrations, deploy) + các luồng chính frontend. Backend test 174 pass, `npm audit`: backend 0, frontend 1 high (`follow-redirects`, chỉ dùng ở Node, `npm audit fix`). Cột "Kiểm": **chạy** = đã chạy code thật để xác nhận; **đọc** = suy ra từ code; **chưa** = cần truy vấn DB/production (truy vấn prod bị chặn trong phiên này, SQL kiểm ở cuối bảng).

| ID | Mức | Khu vực | Vấn đề | Hướng sửa | Kiểm |
|----|-----|---------|--------|-----------|------|
| N1 | Cao | rag / FAQ | `checkFAQ` nuốt câu hỏi nông nghiệp thật, trả câu xã giao (conf 1.0, source `faq` → không disclaimer, không lọt màn soát). Pattern không neo (`/cảm ơn/`, `/có đúng không/`, `/tin được không/`, `/giúp (được )?gì/`, `/hỗ trợ gì/`) + `\b` sau chữ ASCII khớp cả "Hiện/Hiệu/Hiểu…" (`^hi\b`). Ví dụ bị nuốt: "Hiện tại lúa bị sâu cuốn lá…", "Chào Cò Con, lúa vàng lá phun gì?", "Bón đạm lúc lúa trổ có đúng không?", "Ok vậy đạo ôn thì phun gì" | Chỉ coi là FAQ khi CẢ câu là xã giao ngắn (neo `^…$` hoặc ≤ 4–5 từ) VÀ `mentionsAgri()` = false; dùng ranh giới unicode như `looksOffTopic`; thêm test | chạy |
| N2 | Cao | thông báo đặt lịch | Gửi trễ 7 tiếng: `SendNotif.jsx` gửi chuỗi `datetime-local` không múi giờ, server UTC `new Date()` hiểu là UTC (chọn 08:00 → gửi 15:00 VN). `min` của ô nhập cũng tính theo UTC | Frontend gửi `new Date(scheduleAt).toISOString()`; `min` theo giờ máy | chạy |
| N3 | Cao | DB / chat | Migration (nguồn sự thật) có `messages_source_check` chỉ cho `rag/llm/engineer`, code ghi `faq/qa_direct/vision/rag_low_conf/*_cached…` và KHÔNG kiểm lỗi insert câu trả lời (`chat.js` 2 chỗ). Hoặc prod còn constraint → câu trả lời không được lưu (mất lịch sử, `messageId` rỗng → 👍/lưu/báo lỗi/hỏi lại kỹ sư hỏng, luồng ảnh không hiện câu trả lời); hoặc prod đã sửa tay → dựng DB từ migration sẽ vỡ âm thầm. `docs/04-DATABASE.md` ghi "source được chuẩn hoá" — code không làm vậy | Migration bỏ/nới constraint; kiểm lỗi insert câu trả lời; sửa doc | **chạy — ĐÃ SỬA 2026-11-13** (code; migration chờ áp) |
| N4 | Cao | admin thống kê | "Lỗ hổng tri thức" và tab "Tin cậy thấp" LUÔN rỗng: lọc `role='assistant' AND confidence<0.5` nhưng câu < 0.5 luôn được lưu `role='system'`. `ragRate` bị thổi phồng: tính cả FAQ (1.0), từ chối lạc đề (1.0), vision (0.9 gán cứng) và bỏ hẳn câu chuyển kỹ sư khỏi mẫu số | Gaps = câu `needEngineer` (system + source rag) và dải 0.5–0.7; ragRate = câu AI tự trả lời có căn cứ / tổng câu hỏi | đọc |
| N5 | Vừa | pgvector | Index `ivfflat (lists=100)` + `probes` mặc định 1 trên kho nhỏ → recall thấp, chunk/QA đúng có thể không được trả (câu đã có QA vẫn bị đẩy kỹ sư, trông như "ngẫu nhiên") | Kho < ~10k chunk: bỏ index (quét chính xác) hoặc đổi HNSW | chưa |
| N6 | Vừa | push settings | Cài đặt thông báo (giờ yên tĩnh, loại, lọc cây) lưu theo dòng endpoint; đăng xuất/đăng nhập, trình duyệt đổi endpoint, đổi VAPID (vừa làm 2026-11-12) đều tạo endpoint mới → cài đặt về mặc định (22:00–06:00, mọi loại) | Lưu cài đặt theo user (bảng `users` hoặc copy từ subscription gần nhất khi subscribe) | đọc |
| N7 | Vừa | weatherAlerts | Dedup nháp chỉ xét nháp ĐANG CHỜ → admin duyệt/bỏ xong, lượt quét sau (6h, và MỖI lần boot — Render free thức dậy nhiều lần/ngày) tạo lại đúng nháp đó → dễ gửi trùng | Dedup theo `region` bất kể đã gửi/đã bỏ (đánh dấu thay vì xoá khi bỏ) | đọc |
| N8 | Vừa | scheduler | (a) Gửi rồi MỚI ghi `sent_at` → update lỗi/sập giữa chừng = gửi lại mỗi 60s; đường duyệt nháp thì ghi trước nhưng không nguyên tử (bấm đúp gửi 2 lần). (b) Render free ngủ → job dừng; thông báo tới hạn lúc ngủ được gửi khi thức, nếu rơi vào giờ yên tĩnh thì bị BỎ hẳn (không gửi bù), kể cả cảnh báo khẩn | Claim nguyên tử `UPDATE … WHERE sent_at IS NULL RETURNING`; gói always-on hoặc ping giữ thức; cân nhắc hoãn thay vì bỏ trong giờ yên tĩnh | đọc |
| N9 | Vừa | engineer answer | Sửa câu đã trả lời: (a) tìm message cũ bằng `eq('content', <câu cũ>)` trên URL → câu dài có thể quá giới hạn URL → chèn thêm câu thứ 2; (b) câu cũ đã "thêm vào tri thức" thì QA SAI vẫn approved và tiếp tục được trả qua `qa_direct`; tick lại tạo QA trùng | Lưu `answer_message_id` + `knowledge_doc_id` trên `engineer_queue`; sửa thì cập nhật/lưu trữ QA cũ | đọc |
| N10 | Vừa | auth | (a) `login-phone`/`register-phone` lộ số nào đã đăng ký / chưa có PIN (trái G8). (b) PIN 6 số + lộ số + không chặn PIN yếu → dò rải (123456, 000000…) qua nhiều số không bị khoá theo tài khoản chặn. (c) Khoá dò in-memory mất khi restart; `reset-pin` không xoá khoá dù thông báo bảo "nhờ quản trị viên đặt lại". (d) Nông dân được nâng lên staff vẫn đăng nhập bằng PIN 6 số, token 30 ngày. (e) `reset-pin` đặt `is_active:true` → âm thầm mở khoá tài khoản đang bị khoá/đã tự xoá. (f) Admin cuối cùng tự xoá được qua `DELETE /auth/account` (trái chú thích "luôn còn 1 admin"). (g) `/request-otp`, `/verify-otp` vẫn mở dù UI không dùng → tốn SMS (pumping). (h) Poller denylist không phân trang: > 1000 tài khoản inactive thì `clear()` + nạp thiếu → người bị khoá được mở lại | Thông báo chung; denylist PIN yếu; xoá khoá khi reset; `login-phone` chỉ cho farmer; reset-pin không đụng `is_active`; chặn admin cuối; cờ env tắt OTP (giữ code); phân trang như mốc thu hồi | đọc |
| N11 | Vừa | rate-limit | `trust proxy = 1` viết cho Railway; Render đứng sau Cloudflare → `req.ip` có thể là IP edge → cả xã chung bucket auth 30/phút | Log `req.ip` + `x-forwarded-for` 1 lần trên Render rồi chỉnh số hop | chưa |
| N12 | Vừa | rag embed | Bước embed câu hỏi không có trần retry (tới 5 lần, mỗi lần chờ theo "retry in Ns") → vượt timeout 45s của client; K10 chỉ chặn ở LLM. Không retry 503 | Dùng chung ngân sách thời gian với `invokeLLM` cho đường chat | đọc |
| N13 | Vừa | vision | Trả lời ảnh không dựa kho tri thức, không `SYSTEM_PROMPT`, không tắt thinking, confidence gán cứng 0.9 (G7 ghi "xong" nhưng hằng số còn), không tính vào quota monitor; chốt an toàn duy nhất là regex "không chắc" | Dùng chung prompt/cấu hình; gắn nhãn riêng thay vì 0.9; cân nhắc đưa chẩn đoán ảnh qua RAG | đọc |
| N14 | Vừa | push | `/push/send` không giới hạn độ dài tiêu đề/nội dung → payload > ~4KB thì MỌI thiết bị gửi lỗi ("0/N"); không whitelist `type`/`cropTags` (K18 bỏ sót), `imageUrl` tuỳ ý | Cắt body trong payload push (giữ đủ trong DB), validate type/cropTags | đọc |
| N15 | Vừa | PWA offline | Workbox `api-cache` vẫn khớp `*.railway.app` → từ khi sang Render, cache API offline không còn hoạt động | Khớp theo `VITE_API_URL` | đọc |
| N16 | Thấp | frontend | Bỏ qua `engineerQueued:false` → vẫn báo "Đã gửi cho kỹ sư!" khi không vào được hàng đợi. Hậu tố `_dbcached` không được gỡ (ChatMain/AIResult/TestAI) → `qa_direct_dbcached` hiện disclaimer + mất nhãn "Kỹ sư biên soạn" | Kiểm `engineerQueued`; regex `/_(sem\|db)?cached$/` | đọc |
| N17 | Thấp | xoá tài khoản | Xoá file ảnh `community/<uid>` nhưng giữ bài đăng + `image_url` → ảnh vỡ trên feed; `messages.image_url` cũng treo; `list()` mặc định 100 file | Xoá/ẩn bài hoặc null `image_url`; phân trang | đọc |
| N18 | Thấp | giới hạn 1000 dòng PostgREST | Cắt âm thầm ở: lịch sử chat (sắp tăng dần → phiên MỚI NHẤT mất preview/tìm kiếm), thống kê admin, xuất CSV user, danh sách thiết bị nhận push (> 1000 thiết bị không nhận), dọn ảnh, thống kê kỹ sư | Phân trang / đếm ở DB | đọc |
| N19 | Thấp | rag lạc đề | `cá độ`, `cá cược`… không bao giờ bị coi là lạc đề vì `cá` thuộc AGRI_WORDS; `isWrongRefusal` đẩy cả lời từ chối ĐÚNG sang kỹ sư khi câu có từ thường gặp (bệnh, thuốc, đất, cây, mùa); `FOLLOWUP_RE` với "thế"/"thì" không bao giờ khớp (`\b` sau chữ có dấu) | Xét cụm lạc đề trước từ đơn; ranh giới unicode | chạy |
| N20 | Thấp | quota monitor | Mặc định 15 RPM/1500 RPD (`.env.example` ghi 200, thực tế free ~20/ngày/model), 1 bộ đếm chung mọi model, không đếm vision/STT → cảnh báo vô nghĩa | Đếm theo model, ngưỡng đúng | đọc |
| N21 | Thấp | lỗi API | Nhiều route trả `error.message` của DB cho client (chat sessions/messages, community, push, engineer, admin) — trái quy ước `serverError()` ở auth | Thông báo chung + log server | đọc |
| N22 | Thấp | rate-limit chat | 15/phút đếm MỌI request `/chat` kể cả GET (WaitEngineer poll 5/phút, lịch sử, đã lưu, STT) → có thể dính "hỏi quá nhiều" dù chưa hỏi | Chỉ đếm `/ask*` + `/stt-fallback` | đọc |
| N23 | Thấp | riêng tư | Sentry frontend nhận SĐT (`authStore.js`) nhưng Chính sách không nêu Sentry; Chính sách ghi "xoá qua email" trong khi app có tự xoá; ảnh sâu bệnh vẫn bucket public (L14); Gemini free tier có thể dùng dữ liệu để cải thiện sản phẩm | Bỏ phone khỏi `Sentry.setUser`; cập nhật Chính sách | đọc |
| N24 | Thấp | lặt vặt | `maxOutputTokens 512` có thể cắt câu trả lời 200 từ tiếng Việt, không kiểm `finishReason`, bản cắt vẫn bị cache; reload do `controllerchange` ở lần đầu/khi deploy làm mất chữ đang gõ; `user-scalable=no`; icon manifest `/icon.png` + `cocon-icon.png` còn sót (trái quy ước thương hiệu); `answer_cache` không dọn dòng hết hạn; `engineer_queue.message_id` không unique (escalate đúp); `report-error` không kiểm lỗi insert; `/knowledge/qa` + QA admin vượt `MAX_DOC_CHARS`; `test-embed` để API key trên URL; `/login` đưa staff về `/home`; `userOrIpKey` không ghim `algorithms` | — | đọc |
| N25 | Thấp | tài liệu lệch code | CLAUDE.md: "auth 10/phút" (code 30), "Railway watch backend" (đã sang Render); chú thích đầu `push.js` ghi sai đường dẫn; `.env.example` 2 bên còn Railway; `estimatedChunks` chia 500 trong khi chunk 1000 | Sửa khi đụng tới | đọc |

**SQL kiểm 3 mục "chưa" (chạy trên Supabase SQL Editor):**
```sql
-- N3: constraint còn không + thực tế đang lưu source nào
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
 WHERE conrelid = 'public.messages'::regclass AND contype = 'c';
SELECT role, source, count(*) FROM public.messages GROUP BY 1, 2 ORDER BY 3 DESC;
-- N5: số dòng RPC trả về phải = min(200, số chunk của tài liệu approved); ít hơn = index làm rớt kết quả
SELECT count(*) FROM public.match_knowledge_chunks((SELECT embedding FROM public.knowledge_chunks LIMIT 1), -1, 200, NULL);
SELECT count(*) FROM public.knowledge_chunks kc JOIN public.knowledge_docs kd ON kd.id = kc.doc_id WHERE kd.status = 'approved';
-- L2/L4: migration hardening đã áp chưa
SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'tokens_valid_after';
SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';
```
