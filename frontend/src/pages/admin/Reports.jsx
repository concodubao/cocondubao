import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { communityAPI } from '../../services/api'
import { toast } from '../../stores/toastStore'
import { useIsDesktop } from '../../hooks/useIsDesktop'
import { ChevronLeft, Flag, Trash2, Check, ExternalLink } from 'lucide-react'

export default function Reports() {
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const isDesktop   = useIsDesktop()

  const { data, isLoading } = useQuery({
    queryKey: ['community-reports'],
    queryFn:  () => communityAPI.getReports().then(r => r.data.reports),
    refetchInterval: 60_000,
  })
  const reports = data || []

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['community-reports'] })

  const dismiss = useMutation({
    mutationFn: (it) => communityAPI.dismissReport(it.target_type, it.target_id),
    onSuccess:  () => { toast.success('Đã bỏ qua báo cáo.'); refresh() },
    onError:    () => toast.error('Không bỏ qua được. Thử lại nhé.'),
  })

  const remove = useMutation({
    mutationFn: (it) => it.target_type === 'post'
      ? communityAPI.deletePost(it.target_id)
      : communityAPI.deleteComment(it.target_id),
    onSuccess:  () => { toast.success('Đã xóa nội dung vi phạm.'); refresh() },
    onError:    () => toast.error('Không xóa được. Thử lại nhé.'),
  })

  return (
    <div style={s.page}>
      <header style={s.header}>
        {!isDesktop && (
          <button onClick={() => navigate('/admin')} style={s.iconBtn} aria-label="Quay lại">
            <ChevronLeft size={22} />
          </button>
        )}
        <h1 style={s.title}>Báo cáo cộng đồng</h1>
      </header>

      <main style={s.main}>
        {isLoading && <p style={s.muted}>Đang tải...</p>}

        {!isLoading && reports.length === 0 && (
          <div style={s.empty}>
            <Flag size={32} color="#94a3b8" strokeWidth={1.5} />
            <p style={{ margin: 0 }}>Không có báo cáo nào đang chờ xử lý.</p>
          </div>
        )}

        {reports.map(it => (
          <div key={`${it.target_type}:${it.target_id}`} style={s.card}>
            <div style={s.cardTop}>
              <span style={s.typeBadge}>{it.target_type === 'post' ? 'Bài đăng' : 'Bình luận'}</span>
              <span style={s.countBadge}>{it.count} báo cáo</span>
            </div>

            {it.deleted ? (
              <p style={{ ...s.content, fontStyle: 'italic', color: '#94a3b8' }}>
                (Nội dung đã bị xóa)
              </p>
            ) : (
              <>
                <p style={s.content}>{it.content || '(không có nội dung)'}</p>
                {it.author && <p style={s.author}>— {it.author}</p>}
              </>
            )}

            {it.reasons?.length > 0 && (
              <div style={s.reasons}>
                {it.reasons.slice(0, 5).map((r, i) => <span key={i} style={s.reasonChip}>{r}</span>)}
              </div>
            )}

            <div style={s.actions}>
              {!it.deleted && it.postId && (
                <button onClick={() => navigate(`/community/${it.postId}`)} style={s.btnView}>
                  <ExternalLink size={14} strokeWidth={2} /> Xem
                </button>
              )}
              {!it.deleted && (
                <button onClick={() => { if (confirm('Xóa nội dung vi phạm này?')) remove.mutate(it) }}
                  disabled={remove.isPending} style={s.btnDelete}>
                  <Trash2 size={14} strokeWidth={2} /> Xóa nội dung
                </button>
              )}
              <button onClick={() => dismiss.mutate(it)} disabled={dismiss.isPending} style={s.btnDismiss}>
                <Check size={14} strokeWidth={2} /> Bỏ qua
              </button>
            </div>
          </div>
        ))}
      </main>
    </div>
  )
}

const s = {
  page:       { minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#fdf8f5', fontFamily: "'Noto Sans', sans-serif", maxWidth: 720, margin: '0 auto' },
  header:     { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', background: '#fff', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10 },
  iconBtn:    { width: 40, height: 40, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  title:      { fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0 },
  main:       { flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 },
  muted:      { fontSize: 14, color: '#64748b' },
  empty:      { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '48px 16px', color: '#64748b', fontSize: 14 },
  card:       { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 },
  cardTop:    { display: 'flex', alignItems: 'center', gap: 8 },
  typeBadge:  { fontSize: 12, fontWeight: 600, color: '#4a3328', background: '#fdf6f0', borderRadius: 99, padding: '3px 10px' },
  countBadge: { fontSize: 12, fontWeight: 700, color: '#b91c1c', background: '#fef2f2', borderRadius: 99, padding: '3px 10px' },
  content:    { fontSize: 15, color: '#0f172a', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' },
  author:     { fontSize: 13, color: '#64748b', margin: 0 },
  reasons:    { display: 'flex', flexWrap: 'wrap', gap: 6 },
  reasonChip: { fontSize: 12, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '3px 8px' },
  actions:    { display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 4 },
  btnView:    { display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: '#0f172a', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' },
  btnDelete:  { display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 700, color: '#fff', background: '#dc2626', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' },
  btnDismiss: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: '#4B230A', background: '#fdf6f0', border: '1px solid #f5d5b0', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' },
}
