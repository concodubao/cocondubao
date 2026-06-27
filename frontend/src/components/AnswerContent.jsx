// Hiển thị câu trả lời của Cò Con cho dễ đọc:
//  - **đậm** → in đậm (bỏ dấu ** thô)
//  - xuống dòng giữ nguyên; dòng bắt đầu bằng "1." / "-" / "*" → mục danh sách
//  - tự gắn dòng "Thông tin tham khảo..." cho câu trả lời kỹ thuật (showDisclaimer)
// Màu lấy từ bảng màu thương hiệu: secondary #855300 (dấu mục), muted #6b7280 (ghi chú).

const DISCLAIMER = 'Thông tin mang tính tham khảo, nên xác nhận thêm với kỹ sư địa phương.'

// Bỏ phần ghi chú mà LLM có thể đã tự thêm vào nội dung (ta hiển thị riêng cho đồng nhất)
function stripDisclaimer(text = '') {
  return text
    .replace(/_?\(\s*⚠️[^)]*\)_?/g, '')                          // dạng _(⚠️ ...)_
    .replace(/⚠️?\s*Thông tin mang tính tham khảo[^\n]*/gi, '')   // dạng chữ thường
    .trim()
}

// Render **đậm** trong 1 dòng
function renderInline(text, prefix) {
  return text.split(/(\*\*[^*]+?\*\*)/g).map((part, i) => {
    const m = /^\*\*([^*]+?)\*\*$/.exec(part)
    if (m) return <strong key={`${prefix}-${i}`}>{m[1]}</strong>
    return <span key={`${prefix}-${i}`}>{part}</span>
  })
}

export default function AnswerContent({ content = '', showDisclaimer = false, style }) {
  const lines = stripDisclaimer(content).split('\n').map(l => l.trim()).filter(Boolean)

  // Cỡ chữ đọc co giãn theo --read-scale (cài đặt của nông dân). Lấy fontSize cha
  // làm gốc (mặc định 1em = thừa kế) rồi nhân biến → chữ trả lời to/nhỏ theo ý.
  const base = style?.fontSize != null
    ? (typeof style.fontSize === 'number' ? `${style.fontSize}px` : style.fontSize)
    : '1em'
  const rootStyle = { ...style, fontSize: `calc(${base} * var(--read-scale, 1))` }

  return (
    <div style={rootStyle}>
      {lines.map((line, i) => {
        const li = /^(\d+\.|[-*])\s+(.*)$/.exec(line)
        if (li) {
          const marker = /^\d+\./.test(li[1]) ? li[1] : '•'
          return (
            <div key={i} style={{ display: 'flex', gap: 8, margin: '3px 0', alignItems: 'flex-start' }}>
              <span style={{ color: '#855300', fontWeight: 700, flexShrink: 0 }}>{marker}</span>
              <span>{renderInline(li[2], i)}</span>
            </div>
          )
        }
        return <p key={i} style={{ margin: '0 0 7px' }}>{renderInline(line, i)}</p>
      })}

      {showDisclaimer && (
        <p style={{
          marginTop: 10, marginBottom: 0, fontSize: 12.5, fontStyle: 'italic',
          color: '#6b7280', display: 'flex', gap: 6, alignItems: 'flex-start',
          borderTop: '1px solid #f0e0d0', paddingTop: 8,
        }}>
          <span style={{ flexShrink: 0 }}>⚠️</span>
          <span>{DISCLAIMER}</span>
        </p>
      )}
    </div>
  )
}
