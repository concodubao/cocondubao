import { useNavigate } from 'react-router-dom'
import { useQuery }    from '@tanstack/react-query'
import { adminAPI, engineerAPI } from '../../services/api'
import { useAuthStore } from '../../stores/authStore'
import { toast }       from '../../stores/toastStore'
import { Users, Send, BookOpen, AlertTriangle, Clock, ChevronRight, ShieldCheck, ScrollText } from 'lucide-react'

function BarChart({ data }) {
  if (!data?.length) return null
  const max  = Math.max(...data.map(d => d.count), 1)
  const W    = 320
  const H    = 80
  const barW = Math.floor(W / data.length) - 4

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + 20}`} aria-label="Biểu đồ phiên chat 7 ngày">
      {data.map((d, i) => {
        const barH = Math.max(4, Math.round((d.count / max) * H))
        const x    = i * (barW + 4) + 2
        const y    = H - barH
        return (
          <g key={d.date}>
            <rect x={x} y={y} width={barW} height={barH} rx="3" fill="#4B230A" fillOpacity="0.7" />
            <text x={x + barW / 2} y={H + 14} textAnchor="middle" fontSize="9" fill="#64748b">{d.date}</text>
            {d.count > 0 && <text x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize="10" fill="#4B230A" fontWeight="600">{d.count}</text>}
          </g>
        )
      })}
    </svg>
  )
}

function StatCard({ label, value, sub, color = '#0f172a', onClick }) {
  return (
    <div onClick={onClick} style={{ ...s.statCard, cursor: onClick ? 'pointer' : 'default' }}>
      <span style={{ fontSize: 24, fontWeight: 700, color }}>{value ?? '–'}</span>
      <span style={s.statLabel}>{label}</span>
      {sub && <span style={s.statSub}>{sub}</span>}
    </div>
  )
}

// Tên kỹ sư đang phụ trách câu hỏi (assigned_to). Để admin giám sát ai nhận câu nào.
function assigneeName(item) {
  const a = item.assignee
  if (!a) return null
  return a.name?.trim() || a.email?.split('@')[0] || 'Kỹ sư'
}

function WaitBadge({ minutes }) {
  const urgent = minutes > 60
  const warn   = minutes > 30
  return (
    <span style={{
      fontSize: 11, padding: '2px 7px', borderRadius: 99, fontWeight: 600,
      display: 'inline-flex', alignItems: 'center', gap: 3,
      background: urgent ? '#fef2f2' : warn ? '#fffbeb' : '#fdf6f0',
      color:      urgent ? '#ef4444' : warn ? '#f59e0b' : '#4B230A',
    }}>
      <Clock size={9} strokeWidth={2} />
      {minutes < 60 ? `${minutes}p` : `${Math.round(minutes / 60)}h`}
    </span>
  )
}

function QueueSection({ navigate, currentUserId }) {
  // refetchInterval 30s: tự cập nhật hàng đợi. (Realtime Supabase bị RLS chặn với anon
  // client — engineer_queue bật RLS không policy, auth.uid()=NULL — nên dùng polling.)
  const { data: pendingData }    = useQuery({ queryKey: ['queue-pending'],     queryFn: () => engineerAPI.getQueue('pending').then(r => r.data),     refetchInterval: 30_000 })
  const { data: inProgressData } = useQuery({ queryKey: ['queue-inprogress'], queryFn: () => engineerAPI.getQueue('in_progress').then(r => r.data), refetchInterval: 30_000 })

  const pending    = pendingData?.queue     || []
  const inProgress = inProgressData?.queue  || []
  const all        = [...pending, ...inProgress]

  async function handleTake(item) {
    if (item.status === 'in_progress' && item.assigned_to === currentUserId) {
      navigate(`/engineer/answer/${item.id}`, { state: { queueItem: item } })
      return
    }
    try {
      await engineerAPI.take(item.id)
      navigate(`/engineer/answer/${item.id}`, { state: { queueItem: item } })
    } catch (err) {
      toast.error(err.response?.data?.error || 'Không thể nhận câu hỏi này.')
    }
  }

  return (
    <div style={s.card}>
      <div style={s.cardHead}>
        <span style={s.cardTitle}>Hàng đợi câu hỏi</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {pending.length > 0 && (
            <span style={{ fontSize: 12, background: '#fef2f2', color: '#ef4444', padding: '2px 8px', borderRadius: 99, fontWeight: 700 }}>
              {pending.length} chờ
            </span>
          )}
          <button onClick={() => navigate('/engineer/queue')} style={s.viewAllBtn}>
            Xem tất cả <ChevronRight size={13} strokeWidth={2} />
          </button>
        </div>
      </div>

      {all.length === 0 ? (
        <p style={{ fontSize: 14, color: '#64748b', textAlign: 'center', padding: '12px 0', margin: 0 }}>
          Không có câu hỏi nào đang chờ
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {all.map(item => {
            const msg          = item.messages
            const farmer       = msg?.chat_sessions?.users
            const isMyItem     = item.status === 'in_progress' && item.assigned_to === currentUserId
            const isOthersItem = item.status === 'in_progress' && !isMyItem
            const handler      = assigneeName(item)
            const handlerLabel = isMyItem ? 'Bạn' : (handler ? `KS. ${handler}` : 'Kỹ sư')
            return (
              <div key={item.id} style={s.queueRow}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{farmer?.name || 'Nông dân'}</span>
                    <WaitBadge minutes={item.waitMinutes} />
                    {item.status === 'in_progress' && (
                      <span style={{ fontSize: 11, color: '#00628d', fontWeight: 600 }}>· {handlerLabel} đang xử lý</span>
                    )}
                  </div>
                  <p style={{ fontSize: 13, color: '#475569', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {msg?.content || '—'}
                  </p>
                </div>
                {isOthersItem ? (
                  <span style={s.processingTag}>{handler ? `KS. ${handler}` : 'Đang xử lý'}</span>
                ) : (
                  <button onClick={() => handleTake(item)} style={s.takeBtn}>
                    {isMyItem ? 'Tiếp tục' : 'Nhận'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function KnowledgeGapsSection({ navigate }) {
  const { data } = useQuery({
    queryKey: ['knowledge-gaps'],
    queryFn:  () => adminAPI.getKnowledgeGaps().then(r => r.data.gaps),
    refetchInterval: 60_000,
  })
  const gaps = data || []
  if (gaps.length === 0) return null

  return (
    <div style={s.card}>
      <div style={s.cardHead}>
        <span style={s.cardTitle}>AI trả lời yếu gần đây</span>
        <button onClick={() => navigate('/engineer/knowledge')} style={s.viewAllBtn}>
          Bổ sung tài liệu <ChevronRight size={13} strokeWidth={2} />
        </button>
      </div>
      <p style={s.cardSub}>Câu hỏi AI trả lời với độ tin cậy thấp — nên thêm tài liệu để cải thiện.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {gaps.map((g, i) => (
          <div key={i} style={s.gapRow}>
            <p style={{ fontSize: 13, color: '#475569', margin: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {g.question}
            </p>
            <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: '#ef4444', background: '#fef2f2', padding: '2px 8px', borderRadius: 99 }}>
              {Math.round(g.confidence * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { data, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn:  () => adminAPI.getStats().then(r => r.data),
    refetchInterval: 60_000,
  })

  return (
    <div style={s.page}>
      <header style={s.header}>
        <h1 style={s.title}>Dashboard</h1>
        <button onClick={() => navigate('/admin/users')} style={s.iconBtn} aria-label="Quản lý tài khoản">
          <Users size={20} />
        </button>
      </header>

      <main style={s.main}>
        {isLoading ? (
          <p style={{ textAlign: 'center', color: '#64748b', padding: 32 }}>Đang tải...</p>
        ) : (
          <>
            <div style={s.grid4}>
              <StatCard label="Người dùng" value={data?.totalUsers}   onClick={() => navigate('/admin/users')} />
              <StatCard label="Phiên chat" value={data?.totalSessions} />
              <StatCard label="Chờ KS"    value={data?.pendingQueue}  color={data?.pendingQueue > 5 ? '#ef4444' : '#0f172a'} onClick={() => navigate('/engineer/queue')} />
              <StatCard label="Lỗi AI"    value={data?.errorReports}  color={data?.errorReports > 10 ? '#f59e0b' : '#0f172a'} onClick={() => navigate('/admin/ai-errors')} />
            </div>

            <div style={s.grid2}>
              <StatCard label="Chờ quá hạn 24h" value={data?.overdueQueue ?? 0}
                color={(data?.overdueQueue || 0) > 0 ? '#ef4444' : '#0f172a'}
                onClick={() => navigate('/engineer/queue')} />
              <StatCard label="Phản hồi TB (kỹ sư)"
                value={data?.avgResponseHours != null ? `${data.avgResponseHours}h` : '–'}
                sub="30 ngày gần nhất" />
            </div>

            <div style={s.card}>
              <div style={s.cardHead}>
                <span style={s.cardTitle}>AI tự trả lời</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: (data?.ragRate || 0) >= 70 ? '#4B230A' : '#f59e0b' }}>
                  {data?.ragRate ?? 0}%
                </span>
              </div>
              <div style={s.progressBg}>
                <div style={{ height: '100%', borderRadius: 99, width: `${data?.ragRate || 0}%`, background: (data?.ragRate || 0) >= 70 ? '#4B230A' : '#f59e0b', transition: 'width 0.5s' }} />
              </div>
              <p style={s.cardSub}>
                {(data?.ragRate || 0) >= 70 ? 'Đạt mục tiêu ≥70% — AI đang hoạt động tốt' : 'Chưa đạt mục tiêu 70% — cần upload thêm tài liệu RAG'}
              </p>
            </div>

            <div style={s.card}>
              <p style={s.cardTitle}>Phiên chat 7 ngày gần nhất</p>
              <BarChart data={data?.sessionsByDay} />
            </div>

            {data?.topCrops?.length > 0 && (
              <div style={s.card}>
                <p style={s.cardTitle}>Cây trồng được hỏi nhiều (30 ngày)</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {data.topCrops.map(c => {
                    const max = data.topCrops[0].count || 1
                    return (
                      <div key={c.crop} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 13, color: '#475569', width: 92, flexShrink: 0 }}>{c.label}</span>
                        <div style={{ flex: 1, height: 8, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.round(c.count / max * 100)}%`, background: '#4B230A', borderRadius: 99 }} />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', width: 32, textAlign: 'right' }}>{c.count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <QueueSection navigate={navigate} currentUserId={user?.id} />

            <KnowledgeGapsSection navigate={navigate} />

            <div style={s.grid2}>
              <button onClick={() => navigate('/admin/notifications/send')} style={s.actionBtn}>
                <Send size={20} color="#4B230A" strokeWidth={1.5} />
                <span>Gửi thông báo</span>
              </button>
              <button onClick={() => navigate('/engineer/knowledge')} style={s.actionBtn}>
                <BookOpen size={20} color="#4B230A" strokeWidth={1.5} />
                <span>Kho tri thức</span>
              </button>
              <button onClick={() => navigate('/admin/ai-errors')} style={s.actionBtn}>
                <AlertTriangle size={20} color="#f59e0b" strokeWidth={1.5} />
                <span>Báo lỗi AI</span>
              </button>
              <button onClick={() => navigate('/admin/ai-review')} style={s.actionBtn}>
                <ShieldCheck size={20} color="#4B230A" strokeWidth={1.5} />
                <span>Soát chất lượng AI</span>
              </button>
              <button onClick={() => navigate('/admin/users')} style={s.actionBtn}>
                <Users size={20} color="#3b82f6" strokeWidth={1.5} />
                <span>Quản lý tài khoản</span>
              </button>
              <button onClick={() => navigate('/admin/audit')} style={s.actionBtn}>
                <ScrollText size={20} color="#7c3aed" strokeWidth={1.5} />
                <span>Nhật ký thao tác</span>
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

const s = {
  page:      { minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#fdf8f5', fontFamily: "'Noto Sans', sans-serif", maxWidth: 1000, margin: '0 auto', width: '100%' },
  header:    { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: '#fff', borderBottom: '1px solid #f1f5f9', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.04)' },
  iconBtn:   { width: 40, height: 40, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  title:     { flex: 1, fontSize: 18, fontWeight: 800, color: '#0b1c30', margin: 0 },
  // Desktop: card tự xếp 2 cột (auto-fit); hàng chỉ số & nút thao tác trải full
  main:      { flex: 1, padding: '14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 12, alignContent: 'start' },
  grid4:     { gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 },
  grid2:     { gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 },
  statCard:  { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  statLabel: { fontSize: 11, color: '#64748b', textAlign: 'center' },
  statSub:   { fontSize: 10, color: '#94a3b8' },
  card:      { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 },
  cardHead:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 },
  cardSub:   { fontSize: 12, color: '#64748b', margin: 0 },
  progressBg:{ height: 6, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' },
  actionBtn:    { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#0f172a' },
  viewAllBtn:   { display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 12, color: '#4B230A', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 },
  queueRow:     { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#fdf8f5', borderRadius: 10, border: '1px solid #e2e8f0' },
  gapRow:       { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: '#fdf8f5', borderRadius: 10, border: '1px solid #e2e8f0' },
  takeBtn:      { flexShrink: 0, padding: '6px 14px', background: '#4B230A', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  processingTag:{ flexShrink: 0, padding: '5px 10px', background: '#f1f5f9', color: '#64748b', borderRadius: 8, fontSize: 12, fontWeight: 500 },
}
