import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../stores/authStore'
import { chatAPI } from '../../services/api'

const CROP_ICON  = { rice: 'grass', veggie: 'eco', fruit: 'forest', other: 'more_horiz' }
const CROP_LABEL = { rice: 'Lúa', veggie: 'Rau màu', fruit: 'Cây ăn trái', other: 'Khác' }

function formatDate(dateStr) {
  const d    = new Date(dateStr)
  const now  = new Date()
  const diff = now - d
  const days = Math.floor(diff / 86400000)

  if (days === 0) {
    return `Hôm nay, ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
  }
  if (days === 1) return 'Hôm qua'
  if (days < 7)   return `${days} ngày trước`
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function SessionCard({ session, onClick }) {
  const crop  = session.crop_type
  const icon  = CROP_ICON[crop]  || 'chat_bubble'
  const label = CROP_LABEL[crop] || 'Câu hỏi'

  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-3 bg-white border border-[#f0e0d0] rounded-[20px]
                 px-4 py-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] active:scale-[0.99] transition-transform
                 text-left"
    >
      {/* Icon cây trồng */}
      <div className="w-11 h-11 rounded-2xl bg-[#fdf6f0] flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="material-symbols-outlined text-[22px] text-[#4B230A] ms-fill">{icon}</span>
      </div>

      <div className="flex-1 min-w-0">
        {/* Dòng 1: loại cây + số tin nhắn */}
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-[15px] font-bold text-[#0b1c30]">{label}</span>
          <span className="text-[12px] text-[#94a3b8] flex items-center gap-1 flex-shrink-0">
            <span className="material-symbols-outlined text-[13px]">chat_bubble_outline</span>
            {session.messageCount}
          </span>
        </div>

        {/* Preview câu hỏi đầu tiên */}
        {session.preview ? (
          <p className="text-[13px] text-[#7a6358] leading-snug m-0 line-clamp-2">{session.preview}</p>
        ) : (
          <p className="text-[13px] text-[#c4a898] italic m-0">Phiên chat trống</p>
        )}

        {/* Ngày giờ */}
        <div className="flex items-center gap-1 mt-1.5 text-[11px] text-[#94a3b8]">
          <span className="material-symbols-outlined text-[12px]">schedule</span>
          {formatDate(session.created_at)}
        </div>
      </div>

      <span className="material-symbols-outlined text-[18px] text-[#c4a898] self-center flex-shrink-0">
        chevron_right
      </span>
    </button>
  )
}

export default function ChatHistory() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const { data, isLoading } = useQuery({
    queryKey:  ['chat-sessions', user?.id],
    queryFn:   () => chatAPI.getSessions(user.id).then(r => r.data.sessions),
    enabled:   !!user?.id,
    staleTime: 30_000,
  })

  const sessions = data || []

  function openSession(session) {
    navigate('/chat', { state: { sessionId: session.id } })
  }

  return (
    <div className="min-h-dvh flex flex-col bg-[#fdf8f5] max-w-[480px] mx-auto">

      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-2 px-4 py-3
                         bg-white border-b border-[#f1f5f9] shadow-[0_1px_6px_rgba(0,0,0,0.04)]">
        <button onClick={() => navigate('/chat')} aria-label="Quay lại"
          className="w-10 h-10 rounded-2xl flex items-center justify-center text-[#7a6358]">
          <span className="material-symbols-outlined text-[22px]">arrow_back</span>
        </button>
        <h1 className="flex-1 text-[18px] font-extrabold text-[#0b1c30] m-0">Lịch sử chat</h1>
        <button onClick={() => navigate('/chat', { state: {} })}
          className="flex items-center gap-1.5 h-9 px-4 bg-[#4B230A] text-white text-[13px]
                     font-bold rounded-full active:scale-95 transition-transform">
          <span className="material-symbols-outlined text-[16px]">add</span>
          Hỏi mới
        </button>
      </header>

      <main className="flex-1 flex flex-col gap-3 px-4 py-4">

        {isLoading && (
          <div className="flex flex-col items-center gap-2 pt-16 text-[#94a3b8]">
            <span className="material-symbols-outlined text-[40px] animate-spin">refresh</span>
            <p className="text-[14px]">Đang tải...</p>
          </div>
        )}

        {!isLoading && sessions.length === 0 && (
          <div className="flex flex-col items-center gap-4 pt-16 text-center">
            <span className="material-symbols-outlined text-[56px] text-[#e2e8f0]">chat_bubble_outline</span>
            <div>
              <p className="text-[16px] font-bold text-[#0b1c30]">Chưa có cuộc hội thoại nào</p>
              <p className="text-[13px] text-[#7a6358] mt-1">Hỏi Cò Con bất kỳ điều gì về cây trồng!</p>
            </div>
            <button onClick={() => navigate('/chat')}
              className="px-6 py-2.5 bg-[#4B230A] text-white text-[14px] font-bold rounded-full">
              Bắt đầu hỏi
            </button>
          </div>
        )}

        {sessions.map(session => (
          <SessionCard key={session.id} session={session} onClick={() => openSession(session)} />
        ))}

        {sessions.length > 0 && (
          <p className="text-center text-[12px] text-[#c4a898] pb-2 pt-1">
            Hiển thị {sessions.length} cuộc hội thoại gần nhất
          </p>
        )}
      </main>
    </div>
  )
}
