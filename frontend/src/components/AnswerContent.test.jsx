import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AnswerContent from './AnswerContent'

const DISCLAIMER_RE = /Thông tin mang tính tham khảo/i

describe('AnswerContent', () => {
  it('render **đậm** thành <strong>', () => {
    render(<AnswerContent content="Bón **đạm** vào sáng sớm" />)
    const strong = screen.getByText('đạm')
    expect(strong.tagName).toBe('STRONG')
  })

  it('dòng bắt đầu bằng số/gạch đầu dòng → mục danh sách', () => {
    render(<AnswerContent content={'1. Tưới nước\n- Bón phân'} />)
    expect(screen.getByText('1.')).toBeInTheDocument()
    expect(screen.getByText('•')).toBeInTheDocument() // '-' chuẩn hoá thành bullet
  })

  it('showDisclaimer=true → hiện dòng tham khảo kỹ sư', () => {
    render(<AnswerContent content="Phun thuốc X" showDisclaimer />)
    expect(screen.getByText(DISCLAIMER_RE)).toBeInTheDocument()
  })

  it('showDisclaimer=false (mặc định) → KHÔNG hiện disclaimer', () => {
    render(<AnswerContent content="Xin chào bà con" />)
    expect(screen.queryByText(DISCLAIMER_RE)).not.toBeInTheDocument()
  })

  it('gỡ disclaimer mà LLM tự thêm để tránh lặp khi showDisclaimer=true', () => {
    const content = 'Trị bệnh đạo ôn bằng thuốc Y.\n_(⚠️ Thông tin mang tính tham khảo, hỏi thêm kỹ sư)_'
    render(<AnswerContent content={content} showDisclaimer />)
    // Chỉ còn ĐÚNG 1 disclaimer (của component), không phải 2.
    expect(screen.getAllByText(DISCLAIMER_RE)).toHaveLength(1)
  })
})
