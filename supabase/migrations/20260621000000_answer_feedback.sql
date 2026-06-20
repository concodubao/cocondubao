-- G12b — Phản hồi tích cực 👍 cho câu trả lời AI.
-- Bổ sung tín hiệu "hữu ích" (report-error đã lo tín hiệu tiêu cực 👎). Câu nhiều
-- 👍 + confidence cao → gợi ý kỹ sư duyệt thành QA biên soạn.
--
-- RLS: bật, KHÔNG tạo policy → deny-all cho anon/authenticated; backend dùng
-- service_role (BYPASSRLS) như các bảng khác. Toàn bộ truy cập qua API backend.

CREATE TABLE public.answer_feedback (
    id         uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    user_id    uuid NOT NULL,
    helpful    boolean NOT NULL,                       -- true = 👍 (hiện chỉ dùng 👍)
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT answer_feedback_pkey PRIMARY KEY (id),
    CONSTRAINT answer_feedback_message_fkey FOREIGN KEY (message_id)
        REFERENCES public.messages(id) ON DELETE CASCADE,
    CONSTRAINT answer_feedback_user_fkey FOREIGN KEY (user_id)
        REFERENCES public.users(id) ON DELETE CASCADE,
    -- 1 nông dân chỉ 1 phản hồi / 1 câu trả lời (cho phép đổi bằng upsert)
    CONSTRAINT answer_feedback_unique UNIQUE (message_id, user_id)
);

ALTER TABLE public.answer_feedback ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_answer_feedback_message ON public.answer_feedback (message_id);
