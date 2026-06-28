import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'

// Mock react-router + API trước khi import component.
const navigateSpy = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateSpy,
  useLocation: () => ({ state: { sessionId: 'sess-1' } }),
}))

const getMessages = vi.fn()
vi.mock('../../services/api', () => ({
  chatAPI: { getMessages: (...a) => getMessages(...a) },
}))

import WaitEngineer from './WaitEngineer'

const userMsg = { role: 'user', content: 'lúa bị vàng lá', created_at: '2026-06-29T01:00:00Z' }
const engMsg  = { role: 'engineer', content: 'bón kali', created_at: '2026-06-29T02:00:00Z' }

describe('WaitEngineer — polling phát hiện trả lời kỹ sư', () => {
  beforeEach(() => {
    navigateSpy.mockClear()
    getMessages.mockReset()
    vi.useFakeTimers()
  })
  afterEach(() => { vi.useRealTimers() })

  it('chưa có câu trả lời mới → không điều hướng', async () => {
    getMessages.mockResolvedValue({ data: { messages: [userMsg] } })
    render(<WaitEngineer />)
    await vi.advanceTimersByTimeAsync(0)        // check() lúc mount → set baseline
    await vi.advanceTimersByTimeAsync(12_000)   // 1 chu kỳ poll, vẫn chưa có engineer
    expect(navigateSpy).not.toHaveBeenCalled()
  })

  it('xuất hiện message engineer mới → nhảy về /chat', async () => {
    // Lần đầu (mount): chưa có câu trả lời → baseline. Sau đó: có engineer mới hơn.
    getMessages
      .mockResolvedValueOnce({ data: { messages: [userMsg] } })
      .mockResolvedValue({ data: { messages: [userMsg, engMsg] } })

    render(<WaitEngineer />)
    await vi.advanceTimersByTimeAsync(0)
    expect(navigateSpy).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(12_000)
    expect(navigateSpy).toHaveBeenCalledWith(
      '/chat',
      expect.objectContaining({ state: expect.objectContaining({ sessionId: 'sess-1' }) }),
    )
  })
})
