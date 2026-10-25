-- 2026-10-25 — Vá bảo mật từ đợt audit (Claude). Áp tay bằng psql / SQL Editor của
-- Supabase (máy dev không có mật khẩu Postgres). Chạy lại nhiều lần vẫn an toàn.
--
-- Bối cảnh: app KHÔNG dùng Supabase Auth session để đọc/ghi bảng — backend dùng
-- service_role (bỏ qua RLS) và JWT tự ký; frontend không truy vấn Supabase trực tiếp.
-- Vì vậy mọi policy cho anon/authenticated chỉ là bề mặt tấn công thừa.

BEGIN;

-- 1) Thu hồi token theo thời điểm (middleware/auth.js revokeTokens): token có iat
--    trước mốc này bị từ chối. NULL = chưa từng thu hồi.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS tokens_valid_after timestamptz;

-- 2) users_self là FOR ALL không có WITH CHECK → một phiên Supabase Auth bất kỳ (ai
--    cũng tự tạo được bằng anon key nếu bật signup) có thể INSERT/UPDATE dòng users
--    của chính uid mình với role='admin' + password_hash tự chọn, rồi đăng nhập
--    backend bằng /auth/login-email với quyền admin. Bỏ hẳn các policy client.
DROP POLICY IF EXISTS users_self            ON public.users;
DROP POLICY IF EXISTS sessions_owner        ON public.chat_sessions;
DROP POLICY IF EXISTS messages_owner        ON public.messages;
DROP POLICY IF EXISTS notif_read            ON public.notifications;
DROP POLICY IF EXISTS ai_error_insert       ON public.ai_error_reports;
DROP POLICY IF EXISTS ai_error_read_eng     ON public.ai_error_reports;
-- knowledge_farmer_read không có TO → anon đọc được toàn bộ tài liệu đã duyệt (kể cả
-- câu hỏi nguyên văn của nông dân trong tài liệu QA).
DROP POLICY IF EXISTS knowledge_farmer_read ON public.knowledge_docs;

-- RLS vẫn BẬT trên mọi bảng → không policy = anon/authenticated bị từ chối hết.

-- 3) Lớp chặn thứ hai: thu quyền ghi bảng public của anon/authenticated (service_role
--    không bị ảnh hưởng). Bảng tạo về sau cũng không tự cấp quyền ghi.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM anon, authenticated;

COMMIT;

-- ─── KIỂM TRA SAU KHI ÁP (chạy riêng, chỉ đọc) ───────────────────────────────
-- a) Không còn policy client nào trên public:
--      SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';
-- b) anon/authenticated không còn quyền ghi:
--      SELECT table_name, grantee, privilege_type FROM information_schema.role_table_grants
--       WHERE table_schema = 'public' AND grantee IN ('anon','authenticated')
--         AND privilege_type IN ('INSERT','UPDATE','DELETE');
-- c) Có dòng users nào bị chèn qua lỗ users_self không? (id trùng auth.users):
--      SELECT u.id, u.role, u.email, u.created_at FROM public.users u
--        JOIN auth.users a ON a.id = u.id;
--    Có kết quả → xem kỹ, đặc biệt role engineer/admin không do admin tạo.
-- d) Tài khoản có SĐT nhưng chưa đặt PIN (register-phone giờ trả 409, admin cấp PIN):
--      SELECT role, count(*) FROM public.users
--       WHERE phone IS NOT NULL AND password_hash IS NULL AND is_active GROUP BY role;
-- e) Storage (không có trong migration): kiểm policy bucket 'images':
--      SELECT policyname, roles, cmd FROM pg_policies WHERE schemaname='storage' AND tablename='objects';
--    Không nên có policy SELECT/INSERT/UPDATE/DELETE cho anon/authenticated trên bucket này.
