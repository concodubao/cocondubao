import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { engineerAPI } from '../../services/api'
import { useAuthStore } from '../../stores/authStore'
import { supabase } from '../../services/supabase'

const CROP_LABEL = { rice: 'Lúa', veggie: 'Rau màu', fruit: 'Cây ăn trái', other: 'Khác' }
const CROP_ICON  = { rice: 'grass', veggie: 'eco', fruit: 'forest', other: 'more_horiz' }

function WaitBadge({ minutes }) {
  const urgent = minutes > 60
  const warn   = minutes > 30
  return (
    <span className={`inline-flex items-center gap-1 text-[12px] font-semibold px-2.5 py-0.5 rounded-full
      ${urgent ? 'bg-[#fef2f2] text-[#ef4444]' : warn ? 'bg-[#fffbeb] text-[#f59e0b]' : 'bg-[#fdf6f0] text-[#4B230A]'}`}>
      <span className="material-symbols-outlined text-[13px]">schedule</span>
      {minutes < 60 ? `${minutes} phút` : `${Math.round(minutes / 60)} giờ`} chờ
    </span>
  )
}

function QueueCard({ item, onTake, onDelete, currentUserId, deleting }) {
  const msg          = item.messages
  const user         = msg?.chat_sessions?.users
  const crop         = msg?.chat_sessions?.crop_type
  const isMyItem     = item.status === 'in_progress' && item.assigned_to === currentUserId
  const isOthersItem = item.status === 'in_progress' && item.assigned_to !== currentUserId
  const isDeleting   = deleting === item.id

  return (
    <div className="bg-white border border-[#f0e0d0] rounded-[20px] p-4 flex flex-col gap-3
                    shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
      {/* Card head */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#fdf6f0] flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-[18px] text-[#4B230A] ms-fill">person</span>
          </div>
          <div>
            <div className="text-[15px] font-bold text-[#0b1c30] leading-tight">
              {user?.name || 'Nông dân'}
            </div>
            {user?.village && (
              <div className="text-[12px] text-[#7a6358]">{user.village}</div>
            )}
          </div>
        </div>
        <WaitBadge minutes={item.waitMinutes} />
      </div>

      {/* Question */}
      <p className="text-[16px] text-[#0b1c30] leading-relaxed m-0 line-clamp-3">{msg?.content}</p>

      {/* Image thumbnail */}
      {msg?.image_url && (
        <img src={msg.image_url} alt="Ảnh sâu bệnh"
          className="w-full max-h-40 object-cover rounded-xl border border-[#f0e0d0]" />
      )}

      {/* Meta tags */}
      <div className="flex items-center gap-2 flex-wrap">
        {crop && (
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold
                           bg-[#fdf6f0] text-[#4B230A] px-2.5 py-0.5 rounded-full">
            <span className="material-symbols-outlined text-[13px] ms-fill">
              {CROP_ICON[crop] || 'grass'}
            </span>
            {CROP_LABEL[crop] || crop}
          </span>
        )}
        {msg?.confidence != null && (
          <span className="text-[12px] bg-[#fffbeb] text-[#d97706] px-2.5 py-0.5 rounded-full font-semibold">
            AI tin cậy {Math.round(msg.confidence * 100)}%
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 items-center">
        {isOthersItem ? (
          <div className="flex-1 h-[48px] bg-[#fdf8f5] text-[#7a6358] text-[14px] font-medium
                          rounded-2xl flex items-center justify-center">
            Kỹ sư khác đang xử lý
          </div>
        ) : (
          <button
            onClick={() => onTake(item)}
            className="flex-1 h-[54px] bg-[#4B230A] text-white text-[16px] font-bold
                       rounded-2xl active:scale-95 transition-transform"
          >
            {isMyItem ? 'Tiếp tục trả lời →' : 'Nhận & Trả lời →'}
          </button>
        )}
        {!isOthersItem && (
          <button
            onClick={() => onDelete(item.id)}
            disabled={isDeleting}
            aria-label="Xóa câu hỏi"
            className="w-[54px] h-[54px] flex items-center justify-center rounded-2xl
                       border border-[#fecaca] text-[#ef4444] bg-white
                       disabled:opacity-50 active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-[20px]">delete</span>
          </button>
        )}
      </div>
    </div>
  )
}

export default function Queue() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [queue,    setQueue]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [tab,      setTab]      = useState('pending')
  const [deleting, setDeleting] = useState(null)

  async function loadQueue() {
    setLoading(true)
    try {
      const res = await engineerAPI.getQueue(tab)
      setQueue(res.data.queue || [])
    } catch (err) {
      console.error('[QUEUE] load error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadQueue() }, [tab])

  useEffect(() => {
    const channel = supabase.channel('engineer-queue-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'engineer_queue' }, () => loadQueue())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [tab])

  async function handleTake(item) {
    if (item.status === 'in_progress' && item.assigned_to === user?.id) {
      navigate(`/engineer/answer/${item.id}`, { state: { queueItem: item } })
      return
    }
    try {
      await engineerAPI.take(item.id)
      navigate(`/engineer/answer/${item.id}`, { state: { queueItem: item } })
    } catch (err) {
      alert(err.response?.data?.error || 'Không thể nhận câu hỏi này.')
      loadQueue()
    }
  }

  async function handleDelete(id) {
    if (!confirm('Xóa câu hỏi này khỏi hàng đợi? Nông dân sẽ không nhận được câu trả lời.')) return
    setDeleting(id)
    try {
      await engineerAPI.deleteQueueItem(id)
      setQueue(prev => prev.filter(q => q.id !== id))
    } catch (err) {
      alert(err.response?.data?.error || 'Không thể xóa. Thử lại nhé.')
    } finally {
      setDeleting(null)
    }
  }

  const TABS = [
    { key: 'pending',     label: 'Chờ trả lời' },
    { key: 'in_progress', label: 'Đang xử lý'  },
  ]

  return (
    <div className="min-h-dvh flex flex-col bg-[#fdf8f5] max-w-[480px] mx-auto">

      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-2 px-4 py-3
                         bg-white border-b border-[#f1f5f9] shadow-[0_1px_6px_rgba(0,0,0,0.04)]">
        <button onClick={() => navigate('/home')} aria-label="Quay lại"
          className="w-10 h-10 rounded-2xl flex items-center justify-center text-[#7a6358]">
          <span className="material-symbols-outlined text-[22px]">arrow_back</span>
        </button>
        <h1 className="flex-1 text-[18px] font-extrabold text-[#0b1c30] m-0">Hàng đợi câu hỏi</h1>
        <button onClick={() => navigate('/engineer/history')} aria-label="Lịch sử"
          className="w-10 h-10 rounded-2xl flex items-center justify-center text-[#7a6358]">
          <span className="material-symbols-outlined text-[22px]">history</span>
        </button>
        <button onClick={loadQueue} aria-label="Tải lại"
          className="w-10 h-10 rounded-2xl flex items-center justify-center text-[#7a6358]">
          <span className="material-symbols-outlined text-[22px]">refresh</span>
        </button>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 px-4 py-3 bg-white border-b border-[#f1f5f9]" role="tablist">
        {TABS.map(t => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-full text-[14px] font-bold transition-all
              ${tab === t.key
                ? 'bg-[#4B230A] text-white shadow-sm'
                : 'bg-[#fdf6f0] text-[#7a6358]'
              }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <main className="flex-1 p-4 flex flex-col gap-3" aria-live="polite">
        {loading ? (
          <div className="flex-1 flex flex-col gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton h-40 rounded-[20px]" />
            ))}
          </div>
        ) : queue.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-16">
            <div className="w-20 h-20 rounded-[24px] bg-[#fdf6f0] flex items-center justify-center">
              <span className="material-symbols-outlined text-[44px] text-[#f5d5b0] ms-fill">check_circle</span>
            </div>
            <p className="text-[16px] text-[#7a6358] text-center m-0">
              {tab === 'pending' ? 'Không có câu hỏi nào đang chờ.' : 'Không có câu hỏi đang xử lý.'}
            </p>
          </div>
        ) : (
          queue.map(item => (
            <QueueCard
              key={item.id}
              item={item}
              onTake={handleTake}
              onDelete={handleDelete}
              currentUserId={user?.id}
              deleting={deleting}
            />
          ))
        )}
      </main>
    </div>
  )
}
