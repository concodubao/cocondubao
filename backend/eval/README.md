# Eval RAG — đo chất lượng câu trả lời

Trả lời tư vấn nông nghiệp **sai liều thuốc / sai bệnh là nguy hiểm**. Bộ eval này biến
"thử vài câu bằng tay" thành phép đo lặp lại được: mỗi khi đổi `SYSTEM_PROMPT`, đổi model,
chỉnh threshold trong `rag.js` → chạy lại để biết NGAY có làm tệ đi câu nào không.

## Chạy

```bash
cd backend
npm run eval                      # hành vi + từ khoá (rẻ, ít quota)
npm run eval -- --judge           # thêm LLM-judge (Gemini chấm độ đúng, tốn quota)
npm run eval -- --case rice-brown-planthopper
npm run eval -- --threshold 0.9   # exit≠0 nếu tỉ lệ đậu < 90% (dùng làm cổng CI/regression)
npm run eval -- --json > result.json
```

Cần `backend/.env` đầy đủ (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `GOOGLE_API_KEY`) như khi chạy app.

## Cách chấm (3 tín hiệu)

1. **Hành vi** — đúng tầng chưa: `faq` (xã giao) / `engineer` (phải chuyển kỹ sư) / `answer` (AI tự trả).
2. **Từ khoá** — `expectKeywords` phải xuất hiện, `forbidKeywords` không được xuất hiện (so khớp bỏ dấu, không phân biệt hoa/thường).
3. **LLM-judge** *(tuỳ chọn)* — Gemini chấm câu trả lời so với `reference` trên thang 0–5; ≥3 là đạt.

Một case **đậu** khi: không lỗi, hành vi đúng, đủ từ khoá, không dính từ cấm, và (nếu bật judge) điểm ≥3.

## Mở rộng bộ test — **việc của kỹ sư nông nghiệp**

`dataset.json` hiện chỉ là **mẫu khởi tạo**. Để eval có giá trị thật, kỹ sư nên:

- Thêm các câu hỏi **thực tế bà con hay hỏi** (lấy từ `/admin/ai-review`, `/admin/knowledge-gaps`, hàng đợi kỹ sư).
- Viết `reference` = câu trả lời ĐÚNG theo chuyên môn (đây là "đáp án" để judge chấm).
- Thêm case cho **mọi câu từng bị báo lỗi** (👎) → chống tái phát (regression).

> Gợi ý: mỗi lần kỹ sư duyệt một QA mới hoặc sửa một câu AI trả sai, thêm luôn 1 case vào đây.

## Lưu ý quota

Mỗi case (trừ FAQ) gọi 1 lần embed; case đi qua LLM tốn thêm 1 lần generate; bật `--judge`
tốn thêm 1 lần generate/câu. Free tier Gemini rất thấp → chạy cả bộ nhiều lần trong ngày có thể 429.
Có `--delay` (mặc định 800ms) giãn nhịp; chạy `--judge` nên để dành hoặc bật billing.
