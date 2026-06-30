# OPERATIONS.md — Vận hành Cò Con (backup · monitoring · quota)

Runbook cho 3 việc "trưởng thành sản phẩm" mà backlog tính năng không cover. Hạ tầng hiện tại:
backend trên **Railway** (`laudable-happiness`, 1 replica), DB **Supabase** (ref `mcloxncymnhiuubjzgbh`),
frontend **Vercel** (`cocondubao.vercel.app`), lỗi app đã có **Sentry**.

URL backend production: `https://laudable-happiness-production-cdfb.up.railway.app`
Health endpoint: `GET /health` → `{"status":"ok","env":"production"}`.

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
