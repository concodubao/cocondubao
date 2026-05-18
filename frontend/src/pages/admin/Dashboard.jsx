import { useNavigate } from 'react-router-dom'
import { useQuery }    from '@tanstack/react-query'
import { adminAPI }    from '../../services/api'
import { ChevronLeft, Users, Send, BookOpen, AlertTriangle, ClipboardList } from 'lucide-react'

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
            <rect x={x} y={y} width={barW} height={barH} rx="3" fill="#16a34a" fillOpacity="0.7" />
            <text x={x + barW / 2} y={H + 14} textAnchor="middle" fontSize="9" fill="#94a3b8">{d.date}</text>
            {d.count > 0 && <text x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize="10" fill="#16a34a" fontWeight="600">{d.count}</text>}
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

export default function Dashboard() {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn:  () => adminAPI.getStats().then(r => r.data),
    refetchInterval: 60_000,
  })

  return (
    <div style={s.page}>
      <header style={s.header}>
        <button onClick={() => navigate('/home')} style={s.iconBtn} aria-label="Quay lại">
          <ChevronLeft size={22} />
        </button>
        <h1 style={s.title}>Dashboard</h1>
        <button onClick={() => navigate('/admin/users')} style={s.iconBtn} aria-label="Quản lý users">
          <Users size={20} />
        </button>
      </header>

      <main style={s.main}>
        {isLoading ? (
          <p style={{ textAlign: 'center', color: '#94a3b8', padding: 32 }}>Đang tải...</p>
        ) : (
          <>
            <div style={s.grid4}>
              <StatCard label="Nông dân"  value={data?.totalUsers}   onClick={() => navigate('/admin/users')} />
              <StatCard label="Phiên chat" value={data?.totalSessions} />
              <StatCard label="Chờ KS"    value={data?.pendingQueue}  color={data?.pendingQueue > 5 ? '#ef4444' : '#0f172a'} onClick={() => navigate('/engineer/queue')} />
              <StatCard label="Lỗi AI"    value={data?.errorReports}  color={data?.errorReports > 10 ? '#f59e0b' : '#0f172a'} onClick={() => navigate('/admin/ai-errors')} />
            </div>

            <div style={s.card}>
              <div style={s.cardHead}>
                <span style={s.cardTitle}>AI tự trả lời</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: (data?.ragRate || 0) >= 70 ? '#16a34a' : '#f59e0b' }}>
                  {data?.ragRate ?? 0}%
                </span>
              </div>
              <div style={s.progressBg}>
                <div style={{ height: '100%', borderRadius: 99, width: `${data?.ragRate || 0}%`, background: (data?.ragRate || 0) >= 70 ? '#16a34a' : '#f59e0b', transition: 'width 0.5s' }} />
              </div>
              <p style={s.cardSub}>
                {(data?.ragRate || 0) >= 70 ? 'Đạt mục tiêu ≥70% — AI đang hoạt động tốt' : 'Chưa đạt mục tiêu 70% — cần upload thêm tài liệu RAG'}
              </p>
            </div>

            <div style={s.card}>
              <p style={s.cardTitle}>Phiên chat 7 ngày gần nhất</p>
              <BarChart data={data?.sessionsByDay} />
            </div>

            <div style={s.grid2}>
              <button onClick={() => navigate('/admin/notifications/send')} style={s.actionBtn}>
                <Send size={20} color="#16a34a" strokeWidth={1.5} />
                <span>Gửi thông báo</span>
              </button>
              <button onClick={() => navigate('/engineer/knowledge')} style={s.actionBtn}>
                <BookOpen size={20} color="#16a34a" strokeWidth={1.5} />
                <span>Kho tri thức</span>
              </button>
              <button onClick={() => navigate('/admin/ai-errors')} style={s.actionBtn}>
                <AlertTriangle size={20} color="#f59e0b" strokeWidth={1.5} />
                <span>Báo lỗi AI</span>
              </button>
              <button onClick={() => navigate('/admin/users')} style={s.actionBtn}>
                <Users size={20} color="#3b82f6" strokeWidth={1.5} />
                <span>Quản lý user</span>
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

const s = {
  page:      { minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#f8fafc', fontFamily: "'Noto Sans', sans-serif", maxWidth: 520, margin: '0 auto' },
  header:    { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#fff', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10 },
  iconBtn:   { width: 40, height: 40, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  title:     { flex: 1, fontSize: 17, fontWeight: 700, color: '#0f172a', margin: 0 },
  main:      { flex: 1, padding: '14px', display: 'flex', flexDirection: 'column', gap: 12 },
  grid4:     { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 },
  grid2:     { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  statCard:  { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  statLabel: { fontSize: 11, color: '#94a3b8', textAlign: 'center' },
  statSub:   { fontSize: 10, color: '#e2e8f0' },
  card:      { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 },
  cardHead:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 },
  cardSub:   { fontSize: 12, color: '#64748b', margin: 0 },
  progressBg:{ height: 6, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' },
  actionBtn: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#0f172a' },
}
