-- Bật RLS cho 2 bảng còn thiếu: push_subscriptions, notification_reads.
--
-- Lý do: anon key nằm public trong bundle frontend. Hai bảng này trước đây
-- KHÔNG bật RLS nên bất kỳ ai có anon key đều đọc/ghi trực tiếp được qua
-- PostgREST (lộ endpoint + keys Web Push, hoặc vô hiệu hoá/sửa subscription
-- của mọi user).
--
-- Backend luôn truy cập bằng service_role key (BYPASSRLS) nên luồng hợp lệ
-- KHÔNG đổi. Cố tình KHÔNG tạo policy nào → mặc định deny-all cho anon /
-- authenticated, giống cách 11 bảng còn lại đang được bảo vệ.

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_reads  ENABLE ROW LEVEL SECURITY;
