-- knowledge_docs: bổ sung cột error_message + trạng thái 'embedding'
-- Lý do: code (services/rag.js, routes/engineer.js) ghi error_message khi
-- embed lỗi và đặt status='embedding' trong lúc đang xử lý, nhưng schema gốc
-- chưa có cột này và CHECK chưa cho phép 'embedding' → mọi UPDATE liên quan
-- fail âm thầm, tài liệu không bao giờ lên 'approved'.

-- 1) Cột lưu thông báo lỗi embed để UI hiển thị banner
ALTER TABLE public.knowledge_docs
  ADD COLUMN IF NOT EXISTS error_message text;

-- 2) Cho phép trạng thái trung gian 'embedding' (đang embed)
ALTER TABLE public.knowledge_docs
  DROP CONSTRAINT IF EXISTS knowledge_docs_status_check;

ALTER TABLE public.knowledge_docs
  ADD CONSTRAINT knowledge_docs_status_check
  CHECK (status = ANY (ARRAY['draft'::text, 'embedding'::text, 'approved'::text, 'archived'::text]));
