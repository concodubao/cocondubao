import { useState } from 'react'
import { useNavigate, useParams, useLocation, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { engineerAPI } from '../../services/api'

// ─── Image Lightbox ───────────────────────────────────────────────────────────
function ImageLightbox({ src, alt, onClose }) {
  return (
    <div
      className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
      role="dialog" aria-modal="true" aria-label="Phóng to ảnh"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <button
        onClick={onClose} aria-label="Đóng"
        className="absolute top-4 right-4 w-11 h-11 bg-white/15 rounded-full
                   flex items-center justify-center"
      >
        <span className="material-symbols-outlined text-white text-[22px]">close</span>
      </button>
      <img src={src} alt={alt}
        className="max-w-full max-h-[90vh] rounded-xl object-contain" />
    </div>
  )
}

const TEMPLATES = [
  { label: 'Sâu bệnh',  text: 'Cây bạn bị [tên bệnh]. Nguyên nhân là [lý do].\n\nCách xử lý:\n1. [Bước 1]\n2. [Bước 2]\n3. [Bước 3]\n\nLưu ý: [lưu ý quan trọng]' },
  { label: 'Bón phân',  text: 'Đối với [loại cây], nên bón phân theo lịch sau:\n- Lần 1 (tuần X): [loại phân, liều lượng]\n- Lần 2 (tuần Y): [loại phân, liều lượng]\n\nLưu ý: Không bón khi [điều kiện].' },
  { label: 'Phòng trị', text: 'Để phòng [tên dịch bệnh], bạn cần:\n1. [Biện pháp phòng]\n2. [Biện pháp phòng]\n\nNếu đã bị: Phun [tên thuốc] liều [X ml/8L nước], phun vào [thời điểm].' },
  { label: 'Thời vụ',   text: 'Vụ [tên vụ] nên xuống giống vào tháng [X].\nThời gian sinh trưởng khoảng [N] ngày.\nThu hoạch khi [dấu hiệu].' },
]

// ─── Answer page ──────────────────────────────────────────────────────────────
export default function Answer() {
  const navigate  = useNavigate()
  const { id }    = useParams()
  const location  = useLocation()
  const stateItem = location.state?.queueItem

  // Ưu tiên item từ navigation state (vào từ queue/history). Nếu thiếu (F5 / mở
  // link trực tiếp) thì gọi API — không còn bị đá về queue và mất câu đang soạn.
  const { data: item, isLoading } = useQuery({
    queryKey:    ['queue-item', id],
    queryFn:     () => engineerAPI.getQueueItem(id).then(r => r.data.item),
    initialData: stateItem,
    enabled:     !stateItem,
    staleTime:   30_000,
  })

  // draft = null → hiển thị câu trả lời đã có (khi chỉnh sửa); gõ vào mới ghi đè.
  const [draft,          setDraft]          = useState(null)
  const [addToKnowledge, setAddToKnowledge] = useState(false)
  const [loading,        setLoading]        = useState(false)
  const [error,          setError]          = useState('')
  const [lightbox,       setLightbox]       = useState(false)

  const answer    = draft ?? (item?.answer || '')
  const msg       = item?.messages
  const user      = msg?.chat_sessions?.users
  const isEditing = item?.status === 'resolved'

  async function handleSubmit() {
    if (!answer.trim())            return setError('Vui lòng nhập câu trả lời.')
    if (answer.trim().length < 20) return setError('Câu trả lời quá ngắn (tối thiểu 20 ký tự).')
    setLoading(true)
    setError('')
    try {
      await engineerAPI.answer(id, { answer: answer.trim(), addToKnowledge })
      navigate(isEditing ? '/engineer/history' : '/engineer/queue')
    } catch (err) {
      setError(err.response?.data?.error || 'Không lưu được câu trả lời.')
    } finally {
      setLoading(false)
    }
  }

  // Hooks đã chạy xong ở trên → giờ mới được return có điều kiện (rules-of-hooks)
  if (!item) {
    return isLoading
      ? <div className="min-h-dvh flex items-center justify-center text-[#7a6358]">Đang tải câu hỏi...</div>
      : <Navigate to="/engineer/queue" replace />
  }

  return (
    <div className="min-h-dvh flex flex-col bg-[#fdf8f5] max-w-[760px] mx-auto w-full">

      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-2 px-4 py-3
                         bg-white border-b border-[#f1f5f9] shadow-[0_1px_6px_rgba(0,0,0,0.04)]">
        <button onClick={() => navigate('/engineer/queue')} aria-label="Quay lại"
          className="w-10 h-10 rounded-2xl flex items-center justify-center text-[#7a6358]">
          <span className="material-symbols-outlined text-[22px]">arrow_back</span>
        </button>
        <h1 className="flex-1 text-[18px] font-extrabold text-[#0b1c30] m-0">
          {isEditing ? 'Chỉnh sửa câu trả lời' : 'Trả lời & Kiểm duyệt'}
        </h1>
      </header>

      <main className="flex-1 flex flex-col gap-4 p-4"
            style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>

        {/* Câu hỏi từ nông dân */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#fdf6f0] flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-[16px] text-[#4B230A] ms-fill">person</span>
            </div>
            <span className="text-[13px] font-bold text-[#7a6358] uppercase tracking-wider">
              CÂU HỎI TỪ NÔNG DÂN
            </span>
          </div>

          <div className="bg-[#fdf6f0] border border-[#f5d5b0] rounded-[20px] p-4 flex flex-col gap-3">
            <div>
              <div className="text-[15px] font-bold text-[#4B230A]">
                {user?.name || 'Nông dân'}{user?.village ? ` · ${user.village}` : ''}
              </div>
              <p className="text-[16px] text-[#0b1c30] leading-relaxed mt-1 m-0">{msg?.content}</p>
            </div>
            {msg?.image_url && (
              <div className="relative">
                <img
                  src={msg.image_url} alt="Ảnh sâu bệnh"
                  className="w-full max-h-56 object-cover rounded-xl border border-[#f5d5b0] cursor-zoom-in"
                  onClick={() => setLightbox(true)}
                />
                <button
                  onClick={() => setLightbox(true)} aria-label="Phóng to ảnh"
                  className="absolute bottom-2 right-2 w-8 h-8 bg-black/50 rounded-lg
                             flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-white text-[16px]">zoom_in</span>
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Mẫu trả lời nhanh */}
        <section className="flex flex-col gap-2">
          <p className="text-[13px] font-bold text-[#7a6358] uppercase tracking-wider m-0">Mẫu nhanh</p>
          <div className="flex gap-2 flex-wrap">
            {TEMPLATES.map(t => (
              <button
                key={t.label}
                onClick={() => setDraft(t.text)}
                className="px-3 py-1.5 text-[13px] font-semibold bg-white border border-[#f0e0d0]
                           rounded-full text-[#4B230A] active:scale-95 transition-transform"
              >
                {t.label}
              </button>
            ))}
          </div>
        </section>

        {/* Textarea trả lời */}
        <section className="flex flex-col gap-2">
          <label htmlFor="answer-textarea"
            className="text-[13px] font-bold text-[#7a6358] uppercase tracking-wider">
            Câu trả lời
            <span className="normal-case font-normal text-[#d4b8a8] ml-1">
              ({answer.trim().length} ký tự)
            </span>
          </label>
          <textarea
            id="answer-textarea"
            value={answer}
            onChange={e => setDraft(e.target.value)}
            placeholder="Soạn câu trả lời chi tiết, dễ hiểu cho nông dân..."
            rows={8}
            aria-required="true"
            className="w-full px-4 py-3 text-[16px] text-[#0b1c30] bg-white
                       border-2 border-[#f0e0d0] rounded-[20px] resize-none leading-relaxed
                       focus:border-[#4B230A] focus:ring-2 focus:ring-[#4B230A]/10 outline-none
                       transition-colors min-h-[180px]"
          />
          {error && (
            <div role="alert"
              className="flex items-start gap-2 bg-[#fef2f2] border-l-4 border-[#EF4444]
                         px-4 py-3 rounded-xl text-[#b91c1c] text-[14px]">
              <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">error</span>
              {error}
            </div>
          )}
        </section>

        {/* Thêm vào kho tri thức */}
        <label htmlFor="trust-toggle"
          className="flex items-start gap-3 bg-white border border-[#f0e0d0] rounded-[20px] p-4 cursor-pointer">
          <input
            id="trust-toggle" type="checkbox"
            checked={addToKnowledge}
            onChange={e => setAddToKnowledge(e.target.checked)}
            className="w-5 h-5 mt-0.5 cursor-pointer accent-[#4B230A] flex-shrink-0"
          />
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[16px] text-[#4B230A] ms-fill">verified</span>
              <span className="text-[15px] font-bold text-[#0b1c30]">
                Đánh dấu "Tin cậy" — thêm vào kho tri thức RAG
              </span>
            </div>
            <p className="text-[13px] text-[#7a6358] m-0 leading-snug">
              Câu trả lời sẽ được embed vào pgvector để AI dùng lần sau. Chỉ tích khi câu trả lời chính xác và dùng được nhiều lần.
            </p>
          </div>
        </label>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading || !answer.trim()}
          aria-busy={loading}
          className="w-full h-[54px] bg-[#4B230A] text-white text-[17px] font-bold rounded-2xl
                     flex items-center justify-center gap-2
                     shadow-[0_4px_12px_rgba(75,35,10,0.3)]
                     disabled:opacity-50 disabled:cursor-not-allowed
                     active:scale-95 transition-all"
        >
          {loading
            ? <><span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Đang gửi...</>
            : <><span className="material-symbols-outlined text-[20px] ms-fill">send</span> Gửi câu trả lời cho nông dân</>
          }
        </button>
        <p className="text-[13px] text-[#7a6358] text-center m-0">
          Nông dân sẽ nhận thông báo ngay sau khi bạn gửi.
        </p>
      </main>

      {/* Lightbox */}
      {lightbox && msg?.image_url && (
        <ImageLightbox src={msg.image_url} alt="Ảnh sâu bệnh" onClose={() => setLightbox(false)} />
      )}
    </div>
  )
}
