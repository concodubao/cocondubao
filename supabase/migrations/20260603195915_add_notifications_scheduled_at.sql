-- Thêm cột scheduled_at cho thông báo đặt lịch.
-- Trước đây /push/send nhận scheduleAt nhưng không có cột nào để lưu → không gửi được.
-- Quy ước: notif đặt lịch có sent_at = NULL và scheduled_at = thời điểm cần gửi.
--          Scheduler quét các dòng sent_at IS NULL AND scheduled_at <= now() để gửi.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS scheduled_at timestamp with time zone;

-- Hỗ trợ scheduler tìm nhanh các notif tới hạn chưa gửi
CREATE INDEX IF NOT EXISTS idx_notifications_pending_schedule
  ON public.notifications (scheduled_at)
  WHERE sent_at IS NULL;
