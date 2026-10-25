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

**Ghi chú audit (chưa xử lý, rủi ro thấp/thiết kế):** staff đọc toàn bộ phiên chat một khi đã escalate; `knowledge_docs` phê duyệt 1 người (không 4-mắt); dọn ảnh khi xoá account chỉ lấy 100 file/thư mục (storage list mặc định); orphan ảnh khi insert post lỗi.

### Còn mở (ngoài Sentry/OTP)
- ⬜ **A** — soạn QA *differential* cho triệu chứng mơ hồ (vàng lá/héo/đốm lá): nguyên nhân + dấu hiệu phân biệt + cách trị. ⚠️ B (prompt, H14) chỉ tác động câu qua LLM; câu có curated QA (qa_direct) thì serve thẳng QA → sửa hành vi phải sửa QA (việc kỹ sư).
- ⬜ **Scale** — Redis + leader-election scheduler + billing Gemini + index pgvector (trần 1 replica). (H15 cron cũng cần leader-election khi >1 replica.)
- ✅ **Realtime engineer queue** — ĐÃ VERIFY là no-op (2026-06-29): client chỉ có anon key (app dùng JWT tự ký, không Supabase Auth → `auth.uid()`=NULL), `engineer_queue` bật RLS **không có policy nào** → Realtime bị RLS chặn SELECT → 0 event. Cả 3 subscription (Queue/Dashboard/WaitEngineer) đều chết. **Đã thay bằng polling:** Queue 20s + pause khi tab ẩn; Dashboard đã sẵn React Query 30s (gỡ realtime chết); WaitEngineer poll `getMessages` 12s phát hiện message `role:'engineer'` mới → tự nhảy về chat. Gỡ helper chết `subscribeEngineerQueue`. (Không mở RLS `USING(true)` vì lộ câu hỏi nông dân cho anon key.)
