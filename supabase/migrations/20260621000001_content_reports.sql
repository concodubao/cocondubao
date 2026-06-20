-- G11b — Kiểm duyệt cộng đồng: nông dân báo cáo bài/bình luận xấu, admin xét duyệt.
--
-- target_id là POLYMORPHIC (trỏ post hoặc comment) → không đặt FK tới 1 bảng.
-- Khi xoá post/comment, code backend tự dọn report liên quan (orphan-safe).
--
-- RLS: bật, KHÔNG tạo policy → deny-all cho anon; backend service_role bypass.

CREATE TABLE public.content_reports (
    id          uuid DEFAULT gen_random_uuid() NOT NULL,
    target_type text NOT NULL,                          -- 'post' | 'comment'
    target_id   uuid NOT NULL,
    reporter_id uuid NOT NULL,
    reason      text,                                   -- lý do (tuỳ chọn)
    status      text DEFAULT 'pending' NOT NULL,        -- 'pending' | 'reviewed' | 'dismissed'
    created_at  timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    CONSTRAINT content_reports_pkey PRIMARY KEY (id),
    CONSTRAINT content_reports_target_type_check
        CHECK (target_type = ANY (ARRAY['post'::text, 'comment'::text])),
    CONSTRAINT content_reports_status_check
        CHECK (status = ANY (ARRAY['pending'::text, 'reviewed'::text, 'dismissed'::text])),
    CONSTRAINT content_reports_reporter_fkey FOREIGN KEY (reporter_id)
        REFERENCES public.users(id) ON DELETE CASCADE,
    -- 1 nông dân chỉ báo cáo 1 lần / 1 nội dung
    CONSTRAINT content_reports_unique UNIQUE (target_type, target_id, reporter_id)
);

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

-- Index cho hàng đợi duyệt của admin (chỉ các báo cáo đang chờ)
CREATE INDEX idx_content_reports_pending
    ON public.content_reports (created_at)
    WHERE status = 'pending';
