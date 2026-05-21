import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { engineerAPI } from '../../services/api'
import { ChevronLeft, Upload, FolderOpen, FileText, Check, Archive } from 'lucide-react'

const CROP_OPTIONS = [
  { id: 'rice',   label: 'Lúa' },
  { id: 'veggie', label: 'Rau màu' },
  { id: 'fruit',  label: 'Cây ăn trái' },
  { id: 'other',  label: 'Khác' },
]

function StatusBadge({ status }) {
  const MAP = {
    draft:    { label: 'Chờ duyệt', bg: '#fffbeb', color: '#d97706' },
    approved: { label: 'Đang dùng', bg: '#f0fdf4', color: '#16a34a' },
    archived: { label: 'Lưu trữ',   bg: '#f1f5f9', color: '#94a3b8' },
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
    if (!file)           return setError('Chọn file trước nhé.')
    if (!title.trim())   return setError('Nhập tên tài liệu.')
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
          ? <><FileText size={16} color="#16a34a" strokeWidth={2} /> <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</span></>
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
              style={{ ...styles.cropBtn, background: crops.includes(c.id) ? '#f0fdf4' : '#fff', border: `1.5px solid ${crops.includes(c.id) ? '#16a34a' : '#e2e8f0'}`, color: crops.includes(c.id) ? '#16a34a' : '#64748b', fontWeight: crops.includes(c.id) ? 700 : 400 }}>
              {c.label}
            </button>
          ))}
        </div>
      </div>
      {error && <p style={styles.error} role="alert">{error}</p>}
      <button onClick={handleUpload} disabled={loading} style={{ ...styles.btnUpload, opacity: loading ? 0.7 : 1 }}>
        <Upload size={16} strokeWidth={2} /> {loading ? 'Đang xử lý...' : 'Upload tài liệu'}
      </button>
    </div>
  )
}

function DocCard({ doc, onApprove, onArchive, approving }) {
  const isApproving = approving === doc.id
  return (
    <div style={styles.docCard}>
      <div style={styles.docHead}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={styles.docTitle}>{doc.title}</p>
          {doc.source && <p style={styles.docSource}><FileText size={12} strokeWidth={1.5} /> {doc.source}</p>}
        </div>
        <StatusBadge status={doc.status} />
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {doc.crop_tags?.map(tag => {
          const c = CROP_OPTIONS.find(o => o.id === tag)
          return <span key={tag} style={styles.tag}>{c?.label || tag}</span>
        })}
        {doc.chunkCount > 0 && <span style={{ ...styles.tag, background: '#eff6ff', color: '#3b82f6' }}>{doc.chunkCount} chunks</span>}
      </div>
      <div style={styles.docActions}>
        {doc.status === 'draft' && (
          <button onClick={() => onApprove(doc.id)} disabled={isApproving}
            style={{ ...styles.btnApprove, opacity: isApproving ? 0.7 : 1 }}>
            <Check size={14} strokeWidth={2.5} /> {isApproving ? 'Đang embed...' : 'Duyệt & Embed vào RAG'}
          </button>
        )}
        {doc.status === 'approved' && (
          <button onClick={() => onArchive(doc.id)} style={styles.btnArchive}>
            <Archive size={13} strokeWidth={1.5} /> Lưu trữ
          </button>
        )}
        {doc.status === 'archived' && <span style={{ fontSize: 12, color: '#94a3b8' }}>Đã lưu trữ — không dùng trong RAG</span>}
      </div>
    </div>
  )
}

export default function Knowledge() {
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const [filter,     setFilter]     = useState('all')
  const [approving,  setApproving]  = useState(null)
  const [showUpload, setShowUpload] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['knowledge-docs', filter],
    queryFn:  () => engineerAPI.getDocs(filter === 'all' ? undefined : filter).then(r => r.data.docs),
    staleTime: 30_000,
  })

  const docs     = data || []
  const approved = docs.filter(d => d.status === 'approved').length
  const draft    = docs.filter(d => d.status === 'draft').length
  const total    = docs.length

  async function handleApprove(id) {
    setApproving(id)
    try {
      const res = await engineerAPI.approveDoc(id)
      alert(`Đã embed ${res.data.chunksCreated} chunks vào kho tri thức!`)
      queryClient.invalidateQueries({ queryKey: ['knowledge-docs'] })
    } catch (err) {
      alert(err.response?.data?.error || 'Embed thất bại. Thử lại nhé.')
    } finally {
      setApproving(null)
    }
  }

  async function handleArchive(id) {
    if (!confirm('Lưu trữ tài liệu này? AI sẽ không dùng tài liệu này nữa.')) return
    try {
      await engineerAPI.archiveDoc(id)
      queryClient.invalidateQueries({ queryKey: ['knowledge-docs'] })
    } catch {
      alert('Không thể lưu trữ. Thử lại nhé.')
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
        <button onClick={() => navigate('/engineer/queue')} style={styles.iconBtn} aria-label="Quay lại">
          <ChevronLeft size={22} />
        </button>
        <h1 style={styles.title}>Kho tri thức RAG</h1>
      </header>

      <div style={styles.statsRow}>
        <div style={styles.stat}><span style={styles.statNum}>{approved}</span><span style={styles.statLabel}>Đang dùng</span></div>
        <div style={styles.stat}><span style={{ ...styles.statNum, color: draft > 0 ? '#d97706' : '#16a34a' }}>{draft}</span><span style={styles.statLabel}>Chờ duyệt</span></div>
        <div style={styles.stat}><span style={styles.statNum}>{total}</span><span style={styles.statLabel}>Tổng số</span></div>
      </div>

      <div style={{ padding: '0 14px' }}>
        <button onClick={() => setShowUpload(v => !v)} style={styles.btnToggleUpload} aria-expanded={showUpload}>
          {showUpload ? 'Đóng form upload' : '+ Upload tài liệu mới'}
        </button>
        {showUpload && <UploadForm onSuccess={() => { setShowUpload(false); queryClient.invalidateQueries({ queryKey: ['knowledge-docs'] }) }} />}
      </div>

      <div style={styles.filterRow} role="tablist">
        {FILTERS.map(f => (
          <button key={f.key} role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}
            style={{ ...styles.filterBtn, background: filter === f.key ? '#16a34a' : 'transparent', color: filter === f.key ? '#fff' : '#64748b', fontWeight: filter === f.key ? 700 : 400 }}>
            {f.label}
          </button>
        ))}
      </div>

      <main style={styles.main} role="region" aria-label="Danh sách tài liệu" aria-live="polite">
        {isLoading ? (
          <p style={{ color: '#94a3b8', textAlign: 'center', padding: 24 }}>Đang tải...</p>
        ) : docs.length === 0 ? (
          <div style={styles.empty}>
            <FolderOpen size={40} color="#e2e8f0" strokeWidth={1} />
            <p style={{ color: '#64748b', fontSize: 15, textAlign: 'center' }}>Chưa có tài liệu nào. Upload file đầu tiên ngay nhé!</p>
          </div>
        ) : (
          docs.map(doc => (
            <DocCard key={doc.id} doc={doc} onApprove={handleApprove} onArchive={handleArchive} approving={approving} />
          ))
        )}
      </main>
    </div>
  )
}

const styles = {
  page:           { minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#f8fafc', fontFamily: "'Noto Sans', sans-serif", maxWidth: 520, margin: '0 auto' },
  header:         { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#fff', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10 },
  iconBtn:        { width: 40, height: 40, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  title:          { fontSize: 17, fontWeight: 700, color: '#0f172a', margin: 0 },
  statsRow:       { display: 'flex', padding: '12px 14px', background: '#fff', borderBottom: '1px solid #e2e8f0' },
  stat:           { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
  statNum:        { fontSize: 22, fontWeight: 700, color: '#0f172a' },
  statLabel:      { fontSize: 11, color: '#94a3b8' },
  btnToggleUpload:{ width: '100%', padding: '11px', fontSize: 14, fontWeight: 600, background: '#f0fdf4', color: '#16a34a', border: '1.5px dashed #bbf7d0', borderRadius: 10, cursor: 'pointer', margin: '12px 0 0' },
  uploadCard:     { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '14px', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 },
  filePicker:     { display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', background: '#f8fafc', border: '2px dashed #bbf7d0', borderRadius: 8, cursor: 'pointer', fontSize: 14, color: '#64748b', width: '100%', textAlign: 'left', overflow: 'hidden' },
  input:          { padding: '10px 12px', fontSize: 14, borderRadius: 8, border: '1.5px solid #e2e8f0', outline: 'none', color: '#0f172a', background: '#fff', width: '100%', boxSizing: 'border-box' },
  cropBtn:        { padding: '6px 12px', borderRadius: 99, cursor: 'pointer', fontSize: 13, transition: 'all 0.15s' },
  error:          { color: '#ef4444', fontSize: 13, background: '#fef2f2', padding: '8px 10px', borderRadius: 8, margin: 0 },
  btnUpload:      { padding: '11px', fontSize: 15, fontWeight: 700, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
  filterRow:      { display: 'flex', padding: '8px 12px', gap: 6, background: '#fff', borderBottom: '1px solid #e2e8f0', overflowX: 'auto' },
  filterBtn:      { padding: '6px 12px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' },
  main:           { flex: 1, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 },
  empty:          { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  docCard:        { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 8 },
  docHead:        { display: 'flex', gap: 10, alignItems: 'flex-start' },
  docTitle:       { fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0, lineHeight: 1.4 },
  docSource:      { fontSize: 12, color: '#94a3b8', margin: '3px 0 0', display: 'flex', alignItems: 'center', gap: 4 },
  tag:            { fontSize: 12, padding: '2px 8px', borderRadius: 99, background: '#f0fdf4', color: '#16a34a' },
  docActions:     { display: 'flex', gap: 8, flexWrap: 'wrap' },
  btnApprove:     { padding: '8px 12px', fontSize: 13, fontWeight: 700, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 },
  btnArchive:     { padding: '7px 12px', fontSize: 13, background: 'transparent', color: '#94a3b8', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 },
}
