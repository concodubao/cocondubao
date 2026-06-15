import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { engineerAPI } from '../../services/api'
import { useIsDesktop } from '../../hooks/useIsDesktop'

const CROP_LABEL = { rice: 'Lúa', veggie: 'Rau màu', fruit: 'Cây ăn trái', other: 'Khác' }
const CROP_ICON  = { rice: 'grass', veggie: 'eco', fruit: 'forest', other: 'more_horiz' }

const FILTERS = [
  { key: 'all',    label: 'Tất cả',       icon: 'grid_view' },
  { key: 'rice',   label: 'Lúa',          icon: 'grass' },
  { key: 'fruit',  label: 'Cây ăn trái', icon: 'forest' },
  { key: 'veggie', label: 'Rau màu',      icon: 'eco' },
]

function HistoryCard({ item, onEdit }) {
  const msg  = item.messages
  const user = msg?.chat_sessions?.users
  const crop = msg?.chat_sessions?.crop_type

  const resolvedAt = item.resolved_at
    ? new Date(item.resolved_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : ''

  return (
    <div className="bg-white border border-[#f0e0d0] rounded-[20px] p-4 flex flex-col gap-3
                    shadow-[0_4px_12px_rgba(0,0,0,0.04)]">

      {/* Head: farmer info + status */}
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

        <div className="flex flex-col items-end gap-1">
          <span className="inline-flex items-center gap-1 text-[11px] font-bold
                           bg-[#fdf6f0] text-[#4B230A] px-2 py-0.5 rounded-full">
            <span className="material-symbols-outlined text-[12px] ms-fill">check_circle</span>
            Đã gửi
          </span>
          {item.add_to_knowledge && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold
                             bg-[#f0e0d0] text-[#00628d] px-2 py-0.5 rounded-full">
              <span className="material-symbols-outlined text-[12px] ms-fill">verified</span>
              Đã cập nhật RAG
            </span>
          )}
        </div>
      </div>

      {/* Crop + timestamp */}
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
        {resolvedAt && (
          <span className="text-[12px] text-[#7a6358]">
            <span className="material-symbols-outlined text-[13px] align-middle mr-0.5">calendar_today</span>
            {resolvedAt}
          </span>
        )}
      </div>

      {/* Question preview */}
      <div>
        <p className="text-[12px] text-[#7a6358] font-semibold uppercase tracking-wide mb-1 m-0">Câu hỏi</p>
        <p className="text-[15px] text-[#0b1c30] leading-snug line-clamp-2 m-0">
          "{msg?.content}"
        </p>
      </div>

      {/* Answer preview */}
      {item.answer && (
        <div className="bg-[#fdf8f5] border border-[#f0e0d0] rounded-xl p-3">
          <p className="text-[12px] text-[#7a6358] font-semibold uppercase tracking-wide mb-1 m-0">Câu trả lời</p>
          <p className="text-[14px] text-[#0b1c30] leading-snug line-clamp-2 m-0">{item.answer}</p>
        </div>
      )}

      {/* Action */}
      <button
        onClick={() => onEdit(item)}
        className="w-full h-[48px] bg-white border-2 border-[#4B230A] text-[#4B230A]
                   text-[15px] font-bold rounded-2xl flex items-center justify-center gap-2
                   active:scale-95 transition-transform"
      >
        <span className="material-symbols-outlined text-[18px]">edit</span>
        Xem & Chỉnh sửa
      </button>
    </div>
  )
}

export default function History() {
  const navigate = useNavigate()
  const isDesktop = useIsDesktop()
  const [history,  setHistory]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState('all')
  const [search,   setSearch]   = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await engineerAPI.getHistory({
          crop: filter !== 'all' ? filter : undefined,
          limit: 50,
        })
        setHistory(res.data.history || [])
      } catch (err) {
        console.error('[HISTORY] load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [filter])

  // Client-side search filter
  const filtered = search.trim()
    ? history.filter(item => {
        const q = item.messages?.content?.toLowerCase() || ''
        const a = item.answer?.toLowerCase() || ''
        const n = item.messages?.chat_sessions?.users?.name?.toLowerCase() || ''
        const s = search.toLowerCase()
        return q.includes(s) || a.includes(s) || n.includes(s)
      })
    : history

  function handleEdit(item) {
    // Navigate to answer page with the item as state (reuse Answer page)
    navigate(`/engineer/answer/${item.id}`, { state: { queueItem: item } })
  }

  return (
    <div className="min-h-dvh flex flex-col bg-[#fdf8f5] max-w-[1080px] mx-auto w-full">

      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-[#f1f5f9]
                         shadow-[0_1px_6px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-2 px-4 py-3">
          {!isDesktop && (
            <button onClick={() => navigate('/engineer/queue')} aria-label="Quay lại"
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-[#7a6358]">
              <span className="material-symbols-outlined text-[22px]">arrow_back</span>
            </button>
          )}
          <div className="flex-1">
            <h1 className="text-[18px] font-extrabold text-[#0b1c30] m-0 leading-tight">
              Lịch sử trả lời
            </h1>
            <p className="text-[12px] text-[#7a6358] m-0">Kỹ sư Cò Con</p>
          </div>
          <button onClick={() => navigate('/engineer/queue')} aria-label="Hàng đợi"
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-[#7a6358]">
            <span className="material-symbols-outlined text-[22px]">assignment</span>
          </button>
        </div>

        {/* Search bar */}
        <div className="px-4 pb-3">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2
                             text-[20px] text-[#7a6358]">search</span>
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm câu hỏi, câu trả lời..."
              className="w-full h-[48px] pl-11 pr-4 bg-[#fdf8f5] border border-[#f0e0d0]
                         rounded-2xl text-[15px] text-[#0b1c30] placeholder-[#d4b8a8]
                         focus:border-[#4B230A] focus:ring-2 focus:ring-[#4B230A]/10 outline-none"
            />
          </div>
        </div>
      </header>

      {/* Filter chips */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-none">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2
                        text-[13px] font-bold rounded-full transition-all
                        ${filter === f.key
                          ? 'bg-[#4B230A] text-white border-2 border-[#4B230A]'
                          : 'bg-white text-[#7a6358] border-2 border-[#f0e0d0]'
                        }`}
          >
            <span className={`material-symbols-outlined text-[15px]
              ${filter === f.key ? 'ms-fill' : ''}`}>
              {f.icon}
            </span>
            {f.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <main className="flex-1 px-4 pb-6 flex flex-col gap-3" aria-live="polite">
        {loading ? (
          <>
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton h-52 rounded-[20px]" />
            ))}
          </>
        ) : filtered.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-16">
            <div className="w-20 h-20 rounded-[24px] bg-[#fdf6f0] flex items-center justify-center">
              <span className="material-symbols-outlined text-[44px] text-[#f5d5b0] ms-fill">history</span>
            </div>
            <p className="text-[16px] text-[#7a6358] text-center m-0">
              {search
                ? 'Không tìm thấy kết quả phù hợp.'
                : 'Chưa có lịch sử trả lời nào.\nHãy bắt đầu tư vấn cho nông dân ngay!'
              }
            </p>
            {!search && (
              <button
                onClick={() => navigate('/engineer/queue')}
                className="h-[54px] px-8 bg-[#4B230A] text-white text-[16px] font-bold
                           rounded-2xl shadow-[0_4px_12px_rgba(75,35,10,0.3)]
                           active:scale-95 transition-transform"
              >
                Đến hàng đợi câu hỏi
              </button>
            )}
          </div>
        ) : (
          <>
            <p className="text-[13px] text-[#7a6358] m-0">
              {filtered.length} câu hỏi{search ? ' tìm thấy' : ' đã trả lời'}
            </p>
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(320px,1fr))] items-start">
              {filtered.map(item => (
                <HistoryCard key={item.id} item={item} onEdit={handleEdit} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
