# OPERATIONS.md — Vận hành Cò Con (backup · monitoring · quota)

Runbook cho các việc "trưởng thành sản phẩm" mà backlog tính năng không cover. Hạ tầng
(2026-11): backend chuyển sang **Render** (Docker, `render.yaml`); Railway cũ (`laudable-happiness`)
hết hạn + dính sự cố lộ biến môi trường 2026-10-21 — có thể quay lại làm **máy dự phòng**.
DB **Supabase** (ref `mcloxncymnhiuubjzgbh`), frontend **Vercel** (`cocondubao.vercel.app`), lỗi app **Sentry**.

Health endpoint: `GET /health` → `{"status":"ok","env":"production"}`.

---

## 0. Deploy backend lên Render (thay Railway)

**Trước khi deploy — rotate MỌI secret** (sự cố Railway 2026-10-21 + `backend/.env` từng nằm
trong lịch sử git repo public). Tự sinh trên máy, không dán vào chat/AI:
```
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"   # JWT_SECRET
npx web-push generate-vapid-keys                                                  # VAPID_*
```
1. **Google**: tạo API key MỚI trong **cùng project** (giữ quyền dùng gemini-2.5-*), giới hạn
   key chỉ cho Generative Language API, xoá key cũ. Bật billing + budget alert + cap request/ngày.
2. **Supabase**: phục hồi project nếu đang pause; Settings → API Keys: tắt legacy JWT keys,
   tạo secret key mới; đổi mật khẩu DB; áp `supabase/migrations/20261025000000_security_hardening.sql`.
3. **Render**: Dashboard → New → **Blueprint** → chọn repo → Render đọc `render.yaml`, hỏi các
   biến `sync: false` → điền giá trị MỚI. Region Singapore. `FRONTEND_URL=https://cocondubao.vercel.app`.
4. Chờ build xong → mở `https://<tên-service>.onrender.com/health` thấy `status: ok`.
5. **Vercel**: Settings → Environment Variables: `VITE_API_URL=https://<tên-service>.onrender.com/api/v1`,
   `VITE_VAPID_PUBLIC_KEY=<khoá public mới>` → Redeploy. (Thiết bị tự đăng ký lại push theo khoá mới.)
6. Kiểm tra tay 5 phút: đăng nhập nông dân → hỏi 1 câu → kỹ sư trả lời → đổi PIN → đăng xuất/đăng nhập.

**Render free ngủ sau 15 phút không có request** (lần đầu sau đó chờ ~30–60s; job nền dừng khi
ngủ). Cho pilot: đặt monitor uptime ping `/health` mỗi ~10 phút (mục 2) để giữ thức — kiểm tra
điều khoản Render hiện hành; hoặc lên gói trả phí always-on (~5–7 USD/tháng) cho ổn định hẳn.

## 0b. Hai máy: chính + dự phòng (Render + Railway)

App thiết kế cho **1 bản chạy**: job nền (thông báo đặt lịch, nháp thời tiết, dọn ảnh), cache,
rate-limit, khoá dò PIN đều in-memory. Vì vậy:
- **Máy chính** (đang nhận traffic): `RUN_SCHEDULERS=true`.
- **Máy dự phòng**: cùng code + cùng secret, `RUN_SCHEDULERS=false` (vẫn phục vụ request, không chạy job nền).
- **Chuyển máy khi máy chính chết**: đổi `VITE_API_URL` trên Vercel → Redeploy; đặt
  `RUN_SCHEDULERS=true` ở máy dự phòng và `false` (hoặc tắt) máy cũ. KHÔNG để 2 máy cùng `true`.
- Railway có thể build cùng `backend/Dockerfile` (đổi builder sang Dockerfile) thay cho nixpacks.

---

## 1. Backup & khôi phục dữ liệu (Postgres)

Mất bảng `users`/`messages`/`knowledge_chunks` = mất toàn bộ. Hai lớp:

### 1a. PITR / backup tự động (Supabase) — **bật trên dashboard**
- Supabase → Project → **Database → Backups**. Free/Pro tier có **daily backup**; bật **Point-in-Time Recovery (PITR)** nếu lên Pro (khôi phục về từng giây trong N ngày).
- Kiểm tra định kỳ: backup gần nhất có **trong 24h** không. Không có backup = coi như chưa có.

### 1b. Snapshot thủ công định kỳ (không phụ thuộc tier)
Máy này có **psql/pg_dump 17** nhưng `.env` **không chứa mật khẩu Postgres** → user tự chạy.
Lấy connection string ở Supabase → **Project Settings → Database → Connection string → Session pooler**.

```bash
# Dump toàn bộ (schema + data) ra file nén, timestamp theo ngày
& "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" `
  "postgresql://postgres.mcloxncymnhiuubjzgbh:<MẬT_KHẨU>@aws-0-<region>.pooler.supabase.com:5432/postgres" `
  -Fc -f "cocon-backup-$(Get-Date -Format yyyyMMdd).dump"

# Khôi phục (vào DB trống / DB khác) khi cần
& "C:\Program Files\PostgreSQL\17\bin\pg_restore.exe" -d "<CONNECTION_STRING>" --clean --if-exists "cocon-backup-YYYYMMDD.dump"
```

> Khuyến nghị: chạy dump **trước mỗi lần áp migration tay** và lưu vài bản gần nhất ngoài máy (Drive). Schema nguồn sự thật vẫn là `supabase/migrations/`, nhưng *data* chỉ có ở đây.

---

## 2. Monitoring — biết khi backend chết / chậm

Sentry chỉ bắt **lỗi trong app**; nó KHÔNG báo khi process chết, OOM, hết quota, hay Railway sập.

### 2a. Uptime monitor ngoài (bắt buộc nên có)
- Dịch vụ miễn phí: **UptimeRobot** / **Better Stack** / **Cron-job.org**.
- Ping `GET /health` **mỗi 1–5 phút**, kỳ vọng `200` và body chứa `"status":"ok"`.
- Cảnh báo qua email/Telegram khi 2 lần liên tiếp fail.
- (Đã thêm) `railway.json` khai báo `healthcheckPath: /health` → Railway **chờ app healthy mới chuyển traffic** khi deploy, và tự restart khi health fail.

### 2b. Sentry — rà mỗi tuần
- Theo dõi **issue mới** + tần suất. Đã gate `NODE_ENV=production` (đã xác minh BẬT), sampling 0.1.
- Đặt **Alert rule**: >N lỗi/giờ → email. (Sentry → Alerts.)

### 2c. Frontend (Vercel)
- Bật **Vercel Analytics** (hoặc theo dõi Sentry frontend đã có) để thấy lỗi JS phía bà con.

---

## 3. Quota Gemini — nguồn lỗi 429 chính

Free tier tính **riêng từng model**, ~20 req/ngày/nhóm generate → cạn là 429 hàng loạt.
Hệ thống đã giảm tải tốt (FAQ → cache L1/L2 → semantic cache → qa_direct → mới gọi LLM) và
retry 429/503 có backoff. Nhưng **khi cạn quota, hiện không có cảnh báo chủ động** — bà con thấy
"Cò Con đang bận" còn vận hành thì không biết, tới khi có người báo.

### 3a. Cách triệt để
**Bật billing Gemini** (Google AI Studio / Cloud Billing) → quota tăng vọt, 429 gần như biến mất.
Mọi việc dưới chỉ là giảm nhẹ. (Việc của user — cần thẻ thanh toán.)

### 3b. Tăng khả năng quan sát (gợi ý, chưa làm — cần user duyệt vì chạm hot path)
- Trong `services/rag.js` (`invokeLLM`/`isRateLimit`) và `routes/chat.js`: khi gặp 429 dai dẳng,
  gọi `Sentry.captureMessage('Gemini quota exhausted', 'warning')` (throttle 1 lần/giờ) →
  có dấu vết trên Sentry + bật được Alert rule, thay vì lỗi 429 bị "nuốt" êm.
- Hoặc đếm số lần gọi LLM/embed trong ngày (in-memory) và phơi qua `/health` để uptime monitor đọc.

### 3c. Khi đang bị 429 (xử lý nhanh)
- Kiểm tra log Railway xem model nào cạn. Vision + RAG answer **chung bucket** `gemini-2.5-flash`.
- Cache đã đỡ phần lớn câu lặp; câu mới vẫn cần quota → chỉ billing mới hết hẳn.

---

## Checklist "đạt chuẩn vận hành"

- [ ] Supabase backup/PITR đang chạy & kiểm tra hàng tuần
- [ ] Có 1 bản pg_dump thủ công gần đây lưu ngoài máy
- [ ] Uptime monitor ping `/health` + cảnh báo khi down
- [ ] Sentry Alert rule cho lỗi tăng đột biến
- [ ] (Khuyến nghị) Billing Gemini để dứt điểm 429
- [ ] Bộ `backend/eval/` được kỹ sư mở rộng & chạy `npm run eval` trước mỗi lần đổi prompt/model
