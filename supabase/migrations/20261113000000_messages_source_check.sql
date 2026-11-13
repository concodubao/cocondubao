-- Gỡ CHECK lỗi thời trên messages.source.
--
-- CHECK cũ chỉ nhận 'rag' | 'llm' | 'engineer', nhưng backend ghi thêm: 'faq', 'qa_direct',
-- 'rag_low_conf', 'vision', 'vision_low_conf' và các hậu tố cache '_cached' / '_dbcached' /
-- '_semcached'. Mọi câu trả lời có source ngoài 3 giá trị trên bị DB từ chối, backend bỏ qua
-- lỗi → câu trả lời không được lưu: mất khỏi lịch sử chat, và "Hỏi lại kỹ sư" / "Báo lỗi" /
-- "Lưu" trên câu đó hỏng (không có messageId). Phát hiện 2026-11-13 khi quay video demo.
--
-- source chỉ là nhãn phân tích (đến từ tầng nào của pipeline), không cần ràng buộc cứng —
-- thêm tầng mới không được làm mất câu trả lời của nông dân nữa.
--
-- Backend (routes/chat.js insertAnswerMessage) đã tự lưu lại với source=null khi gặp CHECK,
-- nên áp migration này để GIỮ được nhãn source cho thống kê.

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_source_check;

-- Kiểm tra: không còn CHECK nào trên cột source (kỳ vọng 0 dòng)
-- SELECT conname FROM pg_constraint
--  WHERE conrelid = 'public.messages'::regclass AND conname = 'messages_source_check';
