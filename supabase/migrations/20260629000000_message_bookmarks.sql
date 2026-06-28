-- #6 — Lưu câu trả lời hữu ích (bookmark).
-- Nông dân hay hỏi lại câu cũ → cho phép "ghim" câu trả lời để xem nhanh trong
-- mục "Đã lưu" của Lịch sử chat.
--
-- RLS: bật, KHÔNG tạo policy → deny-all cho anon/authenticated; backend dùng
-- service_role (BYPASSRLS) như các bảng khác. Toàn bộ truy cập qua API backend.
-- Backend degrade mềm nếu bảng chưa được áp (xem isMissingTable trong chat.js).

CREATE TABLE public.message_bookmarks (
    id         uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    user_id    uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT message_bookmarks_pkey PRIMARY KEY (id),
    CONSTRAINT message_bookmarks_message_fkey FOREIGN KEY (message_id)
        REFERENCES public.messages(id) ON DELETE CASCADE,
    CONSTRAINT message_bookmarks_user_fkey FOREIGN KEY (user_id)
        REFERENCES public.users(id) ON DELETE CASCADE,
    -- 1 nông dân chỉ ghim 1 lần / 1 câu trả lời
    CONSTRAINT message_bookmarks_unique UNIQUE (message_id, user_id)
);

ALTER TABLE public.message_bookmarks ENABLE ROW LEVEL SECURITY;

-- Liệt kê câu đã lưu của 1 nông dân, mới nhất trước.
CREATE INDEX idx_message_bookmarks_user ON public.message_bookmarks (user_id, created_at DESC);
