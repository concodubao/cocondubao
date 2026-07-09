import { useState, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { engineerAPI } from '../../services/api'
import { toast } from '../../stores/toastStore'
import { useIsDesktop } from '../../hooks/useIsDesktop'
import { ChevronLeft, Upload, FolderOpen, FileText, Check, Archive, Trash2, Search, AlertCircle, Eye, X } from 'lucide-react'

const CROP_OPTIONS = [
  { id: 'rice',   label: 'Lúa' },
  { id: 'veggie', label: 'Rau màu' },
  { id: 'fruit',  label: 'Cây ăn trái' },
  { id: 'other',  label: 'Khác' },
]

function StatusBadge({ status }) {
  const MAP = {
    draft:     { label: 'Chờ duyệt',   bg: '#fffbeb', color: '#d97706' },
    embedding: { label: 'Đang embed…', bg: '#eff6ff', color: '#2563eb' },
    approved:  { label: 'Đang dùng',   bg: '#fdf6f0', color: '#4B230A' },
    archived:  { label: 'Lưu trữ',     bg: '#f1f5f9', color: '#64748b' },
  }
  const c = MAP[status] || MAP.draft
  return (
    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: c.bg, color: c.color, fontWeight: 600 }}>
      {c.label}
    </span>
  )
}

function UploadForm({ onSuccess }) {
  const fileRef   = useRef()
  const [title,   setTitle]   = useState('')
  const [source,  setSource]  = useState('')
  const [crops,   setCrops]   = useState([])
  const [file,    setFile]    = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  function toggleCrop(id) {
    setCrops(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  }

  async function handleUpload() {
    if (!file)              return setError('Chọn file trước nhé.')
    if (!title.trim())      return setError('Nhập tên tài liệu.')
    if (crops.length === 0) return setError('Chọn ít nhất 1 loại cây trồng.')
    setLoading(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file',     file)
      formData.append('title',    title.trim())
      formData.append('source',   source.trim())
      formData.append('cropTags', JSON.stringify(crops))
      await engineerAPI.uploadDoc(formData)
      setTitle(''); setSource(''); setCrops([]); setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      onSuccess()
    } catch (err) {
      setError(err.response?.data?.error || 'Upload thất bại. Thử lại nhé.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.uploadCard}>
      <p style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>Upload tài liệu mới</p>
      <input ref={fileRef} type="file" accept=".pdf,.docx,.txt"
        onChange={e => { setFile(e.target.files[0]); setError('') }}
        style={{ display: 'none' }} />
      <button onClick={() => fileRef.current?.click()} style={styles.filePicker}>
        {file
          ? <><FileText size={16} color="#4B230A" strokeWidth={2} /> <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</span></>
          : <><FolderOpen size={16} color="#64748b" strokeWidth={1.5} /> <span>Chọn file PDF / DOCX / TXT</span></>
        }
      </button>
      <input type="text" placeholder="Tên tài liệu" value={title} onChange={e => setTitle(e.target.value)} style={styles.input} />
      <input type="text" placeholder="Nguồn (không bắt buộc)" value={source} onChange={e => setSource(e.target.value)} style={styles.input} />
      <div>
        <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 6px' }}>Áp dụng cho cây trồng nào?</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {CROP_OPTIONS.map(c => (
            <button key={c.id} onClick={() => toggleCrop(c.id)} aria-pressed={crops.includes(c.id)}
              style={{ ...styles.cropBtn, background: crops.includes(c.id) ? '#fdf6f0' : '#fff', border: `1.5px solid ${crops.includes(c.id) ? '#4B230A' : '#e2e8f0'}`, color: crops.includes(c.id) ? '#4B230A' : '#64748b', fontWeight: crops.includes(c.id) ? 700 : 400 }}>
              {c.label}
            </button>
          ))}
        </div>
      </div>
      {error && <p style={styles.errorText} role="alert">{error}</p>}
      <button onClick={handleUpload} disabled={loading} style={{ ...styles.btnUpload, opacity: loading ? 0.7 : 1 }}>
        <Upload size={16} strokeWidth={2} /> {loading ? 'Đang xử lý...' : 'Upload tài liệu'}
      </button>
    </div>
  )
}

// Form soạn 1 cặp Hỏi–Đáp chuẩn (kỹ sư/admin) — embed thẳng vào RAG.
function QAForm({ onSuccess }) {
  const [question, setQuestion] = useState('')
  const [answer,   setAnswer]   = useState('')
  const [crops,    setCrops]    = useState([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  function toggleCrop(id) {
    setCrops(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  }

  async function handleSave() {
    if (!question.trim()) return setError('Nhập câu hỏi của nông dân.')
    if (!answer.trim())   return setError('Nhập câu trả lời chuẩn.')
    setLoading(true)
    setError('')
    try {
      await engineerAPI.addQA({ question: question.trim(), answer: answer.trim(), cropTags: crops })
      setQuestion(''); setAnswer(''); setCrops([])
      onSuccess()
    } catch (err) {
      setError(err.response?.data?.error || 'Không lưu được. Thử lại nhé.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.uploadCard}>
      <p style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>Soạn cặp Hỏi–Đáp chuẩn</p>
      <p style={{ fontSize: 12.5, color: '#64748b', margin: 0, lineHeight: 1.5 }}>
        Khi nông dân hỏi câu tương tự, AI sẽ trả thẳng câu trả lời này (khỏi tốn quota). Dùng cho câu hay gặp, cần đáp án chính xác.
      </p>
      <textarea placeholder="Câu hỏi của nông dân — vd: Lúa bị vàng lá phải làm sao?"
        value={question} onChange={e => setQuestion(e.target.value)} rows={2} style={styles.textarea} />
      <textarea placeholder="Câu trả lời chuẩn — viết đúng, ngắn gọn, dễ hiểu cho bà con"
        value={answer} onChange={e => setAnswer(e.target.value)} rows={5} style={styles.textarea} />
      <div>
        <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 6px' }}>Áp dụng cho cây trồng nào? (không bắt buộc)</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {CROP_OPTIONS.map(c => (
            <button key={c.id} onClick={() => toggleCrop(c.id)} aria-pressed={crops.includes(c.id)}
              style={{ ...styles.cropBtn, background: crops.includes(c.id) ? '#fdf6f0' : '#fff', border: `1.5px solid ${crops.includes(c.id) ? '#4B230A' : '#e2e8f0'}`, color: crops.includes(c.id) ? '#4B230A' : '#64748b', fontWeight: crops.includes(c.id) ? 700 : 400 }}>
              {c.label}
            </button>
          ))}
        </div>
      </div>
      {error && <p style={styles.errorText} role="alert">{error}</p>}
      <button onClick={handleSave} disabled={loading} style={{ ...styles.btnUpload, opacity: loading ? 0.7 : 1 }}>
        <Check size={16} strokeWidth={2.5} /> {loading ? 'Đang lưu & embed...' : 'Lưu vào kho tri thức'}
      </button>
    </div>
  )
}

function DocCard({ doc, onApprove, onArchive, onDelete, onPreview, approving, deleting }) {
  const isApproving = approving === doc.id
  const isDeleting  = deleting  === doc.id
  const canDelete   = doc.status === 'draft' || doc.status === 'embedding'

  return (
    <div style={styles.docCard}>
      <div style={styles.docHead}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={styles.docTitle}>{doc.title}</p>
          {doc.source && <p style={styles.docSource}><FileText size={12} strokeWidth={1.5} /> {doc.source}</p>}
        </div>
        <StatusBadge status={doc.status} />
      </div>

      {/* Hiển thị lỗi embed nếu có */}
      {doc.error_message && (
        <div style={styles.errorBanner}>
          <AlertCircle size={13} strokeWidth={2} style={{ flexShrink: 0 }} />
          <span>{doc.error_message}</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {doc.crop_tags?.map(tag => {
          const c = CROP_OPTIONS.find(o => o.id === tag)
          return <span key={tag} style={styles.tag}>{c?.label || tag}</span>
        })}
        {doc.chunkCount > 0 && <span style={{ ...styles.tag, background: '#eff6ff', color: '#3b82f6' }}>{doc.chunkCount} chunks</span>}
      </div>
      <div style={styles.docActions}>
        <button onClick={() => onPreview(doc.id)} style={styles.btnView} aria-label="Xem nội dung">
          <Eye size={13} strokeWidth={2} /> Xem
        </button>
        {doc.status === 'draft' && (
          <button onClick={() => onApprove(doc.id)} disabled={isApproving}
            style={{ ...styles.btnApprove, opacity: isApproving ? 0.7 : 1 }}>
            <Check size={14} strokeWidth={2.5} /> {isApproving ? 'Đang gửi...' : 'Duyệt & Embed vào RAG'}
          </button>
        )}
        {doc.status === 'embedding' && (
          <span style={{ fontSize: 12, color: '#2563eb' }}>⏳ Đang embed, vui lòng chờ...</span>
        )}
        {doc.status === 'approved' && (
          <button onClick={() => onArchive(doc.id)} style={styles.btnArchive}>
            <Archive size={13} strokeWidth={1.5} /> Lưu trữ
          </button>
        )}
        {doc.status === 'archived' && (
          <span style={{ fontSize: 12, color: '#64748b' }}>Đã lưu trữ — không dùng trong RAG</span>
        )}
        {canDelete && (
          <button onClick={() => onDelete(doc.id, doc.title)} disabled={isDeleting}
            style={{ ...styles.btnDelete, opacity: isDeleting ? 0.6 : 1 }}
            aria-label="Xóa tài liệu">
            <Trash2 size={13} strokeWidth={1.5} /> {isDeleting ? 'Đang xóa...' : 'Xóa'}
          </button>
        )}
      </div>
    </div>
  )
}

// Modal xem nội dung đầy đủ tài liệu (đọc trước khi Duyệt)
function DocPreviewModal({ id, onClose, onApprove, approving }) {
  const { data: doc, isLoading } = useQuery({
    queryKey: ['doc', id],
    queryFn:  () => engineerAPI.getDoc(id).then(r => r.data.doc),
  })
  return (
    <div style={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={styles.previewModal}>
        <div style={styles.previewHead}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>{doc?.title || 'Đang tải...'}</p>
            {doc?.source && <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0' }}>{doc.source}</p>}
          </div>
          <button onClick={onClose} aria-label="Đóng" style={styles.iconBtn}><X size={20} /></button>
        </div>
        <div style={styles.previewBody}>
          {isLoading
            ? <p style={{ color: '#64748b', textAlign: 'center', padding: 20 }}>Đang tải nội dung...</p>
            : <pre style={styles.previewText}>{doc?.content || '(Tài liệu không có nội dung)'}</pre>}
        </div>
        {doc?.status === 'draft' && (
          <div style={styles.previewFoot}>
            <button onClick={() => { onApprove(doc.id); onClose() }} disabled={approving}
              style={{ ...styles.btnApprove, justifyContent: 'center', padding: '11px', opacity: approving ? 0.7 : 1 }}>
              <Check size={14} strokeWidth={2.5} /> Duyệt & Embed vào RAG
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Knowledge() {
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const isDesktop   = useIsDesktop()
  const [previewId,  setPreviewId]  = useState(null)
  const [filter,     setFilter]     = useState('all')
  const [search,     setSearch]     = useState('')
  const [approving,  setApproving]  = useState(null)
  const [deleting,   setDeleting]   = useState(null)
  const [showUpload, setShowUpload] = useState(false)
  const [showQA,     setShowQA]     = useState(false)

  const { data, isLoading } = useQuery({
    queryKey:  ['knowledge-docs', filter],
    queryFn:   () => engineerAPI.getDocs(filter === 'all' ? undefined : filter).then(r => r.data.docs),
    staleTime: 5_000,
    refetchInterval: (query) => {
      const docs = query.state.data || []
      return docs.some(d => d.status === 'embedding') ? 5000 : false
    },
  })

  const docs     = useMemo(() => data || [], [data])
  const approved = docs.filter(d => d.status === 'approved').length
  const draft    = docs.filter(d => d.status === 'draft').length
  const total    = docs.length

  // Full-text search client-side
  const filteredDocs = useMemo(() => {
    if (!search.trim()) return docs
    const q = search.toLowerCase().trim()
    return docs.filter(d =>
      d.title?.toLowerCase().includes(q) ||
      d.source?.toLowerCase().includes(q) ||
      d.crop_tags?.some(t => t.toLowerCase().includes(q))
    )
  }, [docs, search])

  async function handleApprove(id) {
    setApproving(id)
    try {
      await engineerAPI.approveDoc(id)
      toast.success('Đã duyệt — đang embed vào kho tri thức.')
      queryClient.invalidateQueries({ queryKey: ['knowledge-docs'] })
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Embed thất bại. Thử lại nhé.'
      console.error('[Knowledge] approve error:', err.response?.data || err)
      toast.error(msg)
    } finally {
      setApproving(null)
    }
  }

  async function handleArchive(id) {
    if (!confirm('Lưu trữ tài liệu này? AI sẽ không dùng tài liệu này nữa.')) return
    try {
      await engineerAPI.archiveDoc(id)
      toast.success('Đã lưu trữ tài liệu.')
      queryClient.invalidateQueries({ queryKey: ['knowledge-docs'] })
    } catch {
      toast.error('Không thể lưu trữ. Thử lại nhé.')
    }
  }

  async function handleDelete(id, title) {
    if (!confirm(`Xóa vĩnh viễn tài liệu "${title}"? Hành động này không thể hoàn tác.`)) return
    setDeleting(id)
    try {
      await engineerAPI.deleteDoc(id)
      toast.success('Đã xóa tài liệu.')
      queryClient.invalidateQueries({ queryKey: ['knowledge-docs'] })
    } catch (err) {
      toast.error(err.response?.data?.error || 'Không thể xóa. Thử lại nhé.')
    } finally {
      setDeleting(null)
    }
  }

  const FILTERS = [
    { key: 'all',      label: 'Tất cả' },
    { key: 'draft',    label: 'Chờ duyệt' },
    { key: 'approved', label: 'Đang dùng' },
    { key: 'archived', label: 'Lưu trữ' },
  ]

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        {!isDesktop && (
          <button onClick={() => navigate('/engineer/queue')} style={styles.iconBtn} aria-label="Quay lại">
            <ChevronLeft size={22} />
          </button>
        )}
        <h1 style={styles.title}>Kho tri thức RAG</h1>
      </header>

      <div style={styles.statsRow}>
        <div style={styles.stat}><span style={styles.statNum}>{approved}</span><span style={styles.statLabel}>Đang dùng</span></div>
        <div style={styles.stat}><span style={{ ...styles.statNum, color: draft > 0 ? '#d97706' : '#4B230A' }}>{draft}</span><span style={styles.statLabel}>Chờ duyệt</span></div>
        <div style={styles.stat}><span style={styles.statNum}>{total}</span><span style={styles.statLabel}>Tổng số</span></div>
      </div>

      <div style={{ padding: '0 14px' }}>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={() => { setShowUpload(v => !v); setShowQA(false) }}
            style={{ ...styles.btnToggleUpload, margin: 0, flex: 1 }} aria-expanded={showUpload}>
            {showUpload ? 'Đóng' : '+ Upload tài liệu'}
          </button>
          <button onClick={() => { setShowQA(v => !v); setShowUpload(false) }}
            style={{ ...styles.btnToggleUpload, margin: 0, flex: 1 }} aria-expanded={showQA}>
            {showQA ? 'Đóng' : '+ Soạn Hỏi–Đáp'}
          </button>
        </div>
        {showUpload && (
          <UploadForm onSuccess={() => {
            setShowUpload(false)
            queryClient.invalidateQueries({ queryKey: ['knowledge-docs'] })
          }} />
        )}
        {showQA && (
          <QAForm onSuccess={() => {
            setShowQA(false)
            toast.success('Đã lưu — đang embed cặp Hỏi–Đáp vào kho tri thức.')
            queryClient.invalidateQueries({ queryKey: ['knowledge-docs'] })
          }} />
        )}
      </div>

      <div style={styles.filterRow} role="tablist">
        {FILTERS.map(f => (
          <button key={f.key} role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}
            style={{ ...styles.filterBtn, background: filter === f.key ? '#4B230A' : 'transparent', color: filter === f.key ? '#fff' : '#64748b', fontWeight: filter === f.key ? 700 : 400 }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Search box */}
      <div style={{ padding: '8px 14px 0' }}>
        <div style={styles.searchBox}>
          <Search size={15} color="#64748b" strokeWidth={2} />
          <input
            type="search"
            placeholder="Tìm theo tên, nguồn, loại cây..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={styles.searchInput}
            aria-label="Tìm kiếm tài liệu"
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 0 }} aria-label="Xóa tìm kiếm">✕</button>
          )}
        </div>
      </div>

      <main style={styles.main} role="region" aria-label="Danh sách tài liệu" aria-live="polite">
        {isLoading ? (
          <p style={{ color: '#64748b', textAlign: 'center', padding: 24 }}>Đang tải...</p>
        ) : filteredDocs.length === 0 ? (
          <div style={styles.empty}>
            <FolderOpen size={40} color="#e2e8f0" strokeWidth={1} />
            <p style={{ color: '#64748b', fontSize: 15, textAlign: 'center' }}>
              {search ? `Không tìm thấy tài liệu nào cho "${search}"` : 'Chưa có tài liệu nào. Upload file đầu tiên ngay nhé!'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10, alignItems: 'start' }}>
            {filteredDocs.map(doc => (
              <DocCard
                key={doc.id}
                doc={doc}
                onApprove={handleApprove}
                onArchive={handleArchive}
                onDelete={handleDelete}
                onPreview={setPreviewId}
                approving={approving}
                deleting={deleting}
              />
            ))}
          </div>
        )}
      </main>

      {previewId && (
        <DocPreviewModal
          id={previewId}
          onClose={() => setPreviewId(null)}
          onApprove={handleApprove}
          approving={approving === previewId}
        />
      )}
    </div>
  )
}

const styles = {
  page:           { minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#fdf8f5', fontFamily: "'Noto Sans', sans-serif", maxWidth: 1080, margin: '0 auto', width: '100%' },
  header:         { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: '#fff', borderBottom: '1px solid #f1f5f9', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.04)' },
  iconBtn:        { width: 40, height: 40, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  title:          { fontSize: 18, fontWeight: 800, color: '#0b1c30', margin: 0 },
  statsRow:       { display: 'flex', padding: '12px 14px', background: '#fff', borderBottom: '1px solid #e2e8f0' },
  stat:           { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
  statNum:        { fontSize: 22, fontWeight: 700, color: '#0f172a' },
  statLabel:      { fontSize: 11, color: '#64748b' },
  btnToggleUpload:{ width: '100%', padding: '11px', fontSize: 14, fontWeight: 600, background: '#fdf6f0', color: '#4B230A', border: '1.5px dashed #f5d5b0', borderRadius: 10, cursor: 'pointer', margin: '12px 0 0' },
  uploadCard:     { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '14px', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 },
  filePicker:     { display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', background: '#fdf8f5', border: '2px dashed #f5d5b0', borderRadius: 8, cursor: 'pointer', fontSize: 14, color: '#64748b', width: '100%', textAlign: 'left', overflow: 'hidden' },
  input:          { padding: '10px 12px', fontSize: 14, borderRadius: 8, border: '1.5px solid #e2e8f0', outline: 'none', color: '#0f172a', background: '#fff', width: '100%', boxSizing: 'border-box' },
  textarea:       { padding: '10px 12px', fontSize: 14, borderRadius: 8, border: '1.5px solid #e2e8f0', outline: 'none', color: '#0f172a', background: '#fff', width: '100%', boxSizing: 'border-box', fontFamily: "'Noto Sans', sans-serif", resize: 'vertical', lineHeight: 1.5 },
  cropBtn:        { padding: '6px 12px', borderRadius: 99, cursor: 'pointer', fontSize: 13, transition: 'all 0.15s' },
  errorText:      { color: '#ef4444', fontSize: 13, background: '#fef2f2', padding: '8px 10px', borderRadius: 8, margin: 0 },
  btnUpload:      { padding: '11px', fontSize: 15, fontWeight: 700, background: '#4B230A', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
  filterRow:      { display: 'flex', padding: '8px 12px', gap: 6, background: '#fff', borderBottom: '1px solid #e2e8f0', overflowX: 'auto' },
  filterBtn:      { padding: '6px 12px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' },
  main:           { flex: 1, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 },
  empty:          { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  docCard:        { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 8 },
  docHead:        { display: 'flex', gap: 10, alignItems: 'flex-start' },
  docTitle:       { fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0, lineHeight: 1.4 },
  docSource:      { fontSize: 12, color: '#64748b', margin: '3px 0 0', display: 'flex', alignItems: 'center', gap: 4 },
  tag:            { fontSize: 12, padding: '2px 8px', borderRadius: 99, background: '#fdf6f0', color: '#4B230A' },
  docActions:     { display: 'flex', gap: 8, flexWrap: 'wrap' },
  btnApprove:     { padding: '8px 12px', fontSize: 13, fontWeight: 700, background: '#4B230A', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 },
  btnArchive:     { padding: '7px 12px', fontSize: 13, background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 },
  btnDelete:      { padding: '7px 12px', fontSize: 13, background: 'transparent', color: '#ef4444', border: '1px solid #fecaca', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 },
  searchBox:      { display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '8px 12px', marginBottom: 2 },
  searchInput:    { flex: 1, border: 'none', outline: 'none', fontSize: 14, color: '#0f172a', background: 'transparent', fontFamily: "'Noto Sans', sans-serif" },
  errorBanner:    { display: 'flex', alignItems: 'flex-start', gap: 6, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 10px', color: '#dc2626', fontSize: 12, lineHeight: 1.5 },
  btnView:        { display: 'flex', alignItems: 'center', gap: 4, padding: '7px 12px', fontSize: 13, fontWeight: 600, background: '#fdf8f5', color: '#4B230A', border: '1px solid #f0e0d0', borderRadius: 8, cursor: 'pointer' },
  overlay:        { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  previewModal:   { background: '#fff', width: '100%', maxWidth: 640, maxHeight: '86dvh', borderRadius: 18, display: 'flex', flexDirection: 'column', boxShadow: '0 12px 40px rgba(0,0,0,0.22)' },
  previewHead:    { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '14px 16px', borderBottom: '1px solid #f1f5f9' },
  previewBody:    { flex: 1, overflowY: 'auto', padding: '14px 16px' },
  previewText:    { margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: "'Noto Sans', sans-serif", fontSize: 14, lineHeight: 1.6, color: '#0f172a' },
  previewFoot:    { padding: '12px 16px', borderTop: '1px solid #f1f5f9' },
}
