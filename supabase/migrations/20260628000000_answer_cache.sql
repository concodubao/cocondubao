-- Answer cache BỀN (sống qua mỗi lần deploy/restart) để giảm gọi Gemini cho câu
-- hỏi lặp lại. Cache in-memory trong rag.js mất sạch mỗi lần Railway redeploy (rất
-- thường xuyên) → câu phổ biến phải gọi LLM lại từ đầu, tốn quota free tier (nguồn
-- lỗi 429 chính). Bảng này giữ câu trả lời tin cậy cao + QA-direct qua các lần deploy.
--
-- Chỉ backend (service key) đụng tới: bật RLS + KHÔNG policy = chặn anon đọc/ghi.
-- rag.js xử lý mềm khi bảng chưa tồn tại (try/catch) nên deploy code trước khi áp
-- migration cũng không vỡ — cache chỉ đơn giản là chưa hoạt động.

CREATE TABLE IF NOT EXISTS public.answer_cache (
  cache_key   text PRIMARY KEY,         -- chuẩn hoá: "<crop|*>::<câu hỏi thường hoá>"
  crop_type   text,
  question    text,
  answer      text NOT NULL,
  confidence  real,
  source      text,                     -- 'rag' | 'qa_direct'
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS answer_cache_expires_idx ON public.answer_cache (expires_at);

ALTER TABLE public.answer_cache ENABLE ROW LEVEL SECURITY;
