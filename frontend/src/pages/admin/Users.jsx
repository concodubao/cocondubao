import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminAPI } from '../../services/api'
import { ChevronLeft, MapPin, Lock, Unlock, UserCheck, UserPlus, X } from 'lucide-react'

const ROLE_MAP = {
  farmer:   { label: 'Nông dân',  color: '#7a3b10', bg: '#fdf6f0' },
  engineer: { label: 'Kỹ sư',    color: '#3b82f6', bg: '#eff6ff' },
  admin:    { label: 'Admin',     color: '#8b5cf6', bg: '#f5f3ff' },
}

function UserCard({ user, onToggle, onApprove, onChangeRole }) {
  const role    = ROLE_MAP[user.role] || ROLE_MAP.farmer
  const waiting = user.role === 'engineer' && !user.is_active

  return (
    <div style={{ ...s.card, opacity: user.is_active ? 1 : 0.6 }}>
      <div style={s.cardHead}>
        <div style={s.avatar}>{user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || user.phone?.slice(-2) || '?'}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={s.userName}>{user.name || 'Chưa đặt tên'}</p>
          <p style={s.userPhone}>{user.phone || user.email}</p>
          {user.village && (
            <p style={s.userVillage}>
              <MapPin size={10} strokeWidth={2} /> {user.village}
            </p>
          )}
        </div>
        <span style={{ ...s.roleBadge, color: role.color, background: role.bg }}>{role.label}</span>
      </div>

      {user.crops?.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {user.crops.map(c => (
            <span key={c} style={s.cropTag}>{{ rice: 'Lúa', veggie: 'Rau màu', fruit: 'Cây ăn trái', other: 'Khác' }[c] || c}</span>
          ))}
        </div>
      )}

      <div style={s.actions}>
        {waiting && (
          <button onClick={() => onApprove(user.id)} style={s.btnApprove}>
            <UserCheck size={14} strokeWidth={2} /> Phê duyệt kỹ sư
          </button>
        )}
        {!waiting && (
          <button onClick={() => onToggle(user.id, !user.is_active)}
            style={user.is_active ? s.btnLock : s.btnUnlock}>
            {user.is_active ? <><Lock size={13} strokeWidth={2} /> Khóa</> : <><Unlock size={13} strokeWidth={2} /> Mở khóa</>}
          </button>
        )}
        <select value={user.role} onChange={e => onChangeRole(user.id, e.target.value)}
          style={s.roleSelect} aria-label={`Đổi vai trò của ${user.name || user.phone}`}>
          <option value="farmer">Nông dân</option>
          <option value="engineer">Kỹ sư</option>
          <option value="admin">Admin</option>
        </select>
      </div>
    </div>
  )
}

function CreateEngineerModal({ onClose, onCreated }) {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [name,     setName]     = useState('')
  const [role,     setRole]     = useState('engineer')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function handleSubmit() {
    if (!email.trim() || !password) return setError('Vui lòng nhập đầy đủ email và mật khẩu.')
    if (password.length < 8)        return setError('Mật khẩu tối thiểu 8 ký tự.')
    setError(''); setLoading(true)
    try {
      const res = await adminAPI.createEngineer({ email: email.trim(), password, name: name.trim(), role })
      onCreated(res.data.user)
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Tạo tài khoản thất bại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'flex-end', zIndex: 100, backdropFilter: 'blur(2px)',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: '24px 24px 0 0', padding: '16px 20px 36px',
                    width: '100%', maxWidth: 520, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ width: 40, height: 4, background: '#e2e8f0', borderRadius: 99, margin: '0 auto 4px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', margin: 0 }}>Tạo tài khoản nhân sự</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
            <X size={20} />
          </button>
        </div>

        {/* Role picker */}
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { value: 'engineer', label: 'Kỹ sư',          bg: '#eff6ff', color: '#1d4ed8', activeBg: '#1d4ed8' },
            { value: 'admin',    label: 'Quản trị viên',   bg: '#f5f3ff', color: '#7c3aed', activeBg: '#7c3aed' },
          ].map(r => (
            <button key={r.value} onClick={() => setRole(r.value)}
              style={{
                flex: 1, padding: '10px 8px', borderRadius: 10, border: '2px solid',
                borderColor: role === r.value ? r.activeBg : '#e2e8f0',
                background:  role === r.value ? r.bg : '#fff',
                color:       role === r.value ? r.activeBg : '#64748b',
                fontWeight:  role === r.value ? 700 : 400, fontSize: 14, cursor: 'pointer',
              }}>
              {r.label}
            </button>
          ))}
        </div>

        {[
          { label: 'Họ tên (tuỳ chọn)', value: name,     set: setName,     type: 'text',     placeholder: 'Nguyễn Văn A' },
          { label: 'Email *',           value: email,    set: setEmail,    type: 'email',    placeholder: 'staff@example.com' },
          { label: 'Mật khẩu *',        value: password, set: setPassword, type: 'password', placeholder: 'Tối thiểu 8 ký tự' },
        ].map(f => (
          <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{f.label}</label>
            <input type={f.type} placeholder={f.placeholder} value={f.value}
              onChange={e => f.set(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              style={{ padding: '10px 12px', fontSize: 15, borderRadius: 10,
                       border: '1.5px solid #e2e8f0', outline: 'none', color: '#0f172a' }} />
          </div>
        ))}
        {error && (
          <p style={{ color: '#ef4444', fontSize: 13, background: '#fef2f2',
                      padding: '8px 12px', borderRadius: 8, margin: 0 }}>{error}</p>
        )}
        <button onClick={handleSubmit} disabled={loading}
          style={{ padding: '13px', fontSize: 15, fontWeight: 700, background: '#7a3b10',
                   color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer',
                   opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Đang tạo...' : `Tạo tài khoản ${role === 'admin' ? 'quản trị' : 'kỹ sư'}`}
        </button>
      </div>
    </div>
  )
}

export default function Users() {
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const [tab,         setTab]         = useState('farmer')
  const [search,      setSearch]      = useState('')
  const [showCreate,  setShowCreate]  = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', tab, search],
    queryFn:  () => adminAPI.getUsers({ role: tab === 'all' ? undefined : tab, search }).then(r => r.data.users),
    staleTime: 30_000,
  })

  const updateUser = useMutation({
    mutationFn: ({ id, updates }) => adminAPI.updateUser(id, updates),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
    onError:    () => alert('Cập nhật thất bại. Thử lại nhé.'),
  })

  const users   = data || []
  const pending = users.filter(u => u.role === 'engineer' && !u.is_active).length

  const TABS = [
    { key: 'farmer',   label: 'Nông dân' },
    { key: 'engineer', label: `Kỹ sư${pending > 0 ? ` (${pending})` : ''}` },
    { key: 'admin',    label: 'Admin' },
  ]

  return (
    <div style={s.page}>
      <header style={s.header}>
        <button onClick={() => navigate('/admin')} style={s.iconBtn} aria-label="Quay lại">
          <ChevronLeft size={22} />
        </button>
        <h1 style={s.title}>Quản lý người dùng</h1>
        <button onClick={() => setShowCreate(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px',
                   background: '#7a3b10', color: '#fff', border: 'none', borderRadius: 10,
                   cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
          <UserPlus size={15} strokeWidth={2} /> Tạo kỹ sư
        </button>
      </header>

      <div style={{ padding: '10px 14px', background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
        <input type="search" placeholder="Tìm theo tên hoặc số điện thoại..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={s.searchInput} aria-label="Tìm kiếm người dùng" />
      </div>

      <div style={s.tabs} role="tablist">
        {TABS.map(t => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            style={{ ...s.tab, background: tab === t.key ? '#7a3b10' : 'transparent', color: tab === t.key ? '#fff' : '#64748b', fontWeight: tab === t.key ? 700 : 400 }}>
            {t.label}
          </button>
        ))}
      </div>

      <main style={s.main} aria-live="polite" aria-busy={isLoading}>
        {isLoading ? (
          <p style={{ textAlign: 'center', color: '#94a3b8', padding: 24 }}>Đang tải...</p>
        ) : users.length === 0 ? (
          <div style={s.empty}>
            <p style={{ color: '#64748b' }}>Chưa có người dùng nào.</p>
          </div>
        ) : (
          users.map(user => (
            <UserCard key={user.id} user={user}
              onToggle={(id, active) => updateUser.mutate({ id, updates: { is_active: active } })}
              onApprove={id => updateUser.mutate({ id, updates: { is_active: true } })}
              onChangeRole={(id, role) => { if (confirm(`Đổi vai trò thành ${role}?`)) updateUser.mutate({ id, updates: { role } }) }} />
          ))
        )}
      </main>

      {showCreate && (
        <CreateEngineerModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ['admin-users'] })
            setTab('engineer')
          }}
        />
      )}
    </div>
  )
}

const s = {
  page:        { minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#fdf8f5', fontFamily: "'Noto Sans', sans-serif", maxWidth: 520, margin: '0 auto' },
  header:      { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#fff', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10 },
  iconBtn:     { width: 40, height: 40, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  title:       { fontSize: 17, fontWeight: 700, color: '#0f172a', margin: 0 },
  searchInput: { width: '100%', padding: '9px 12px', fontSize: 14, borderRadius: 8, border: '1.5px solid #e2e8f0', outline: 'none', boxSizing: 'border-box' },
  tabs:        { display: 'flex', padding: '8px 12px', gap: 6, background: '#fff', borderBottom: '1px solid #e2e8f0', overflowX: 'auto' },
  tab:         { padding: '6px 12px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' },
  main:        { flex: 1, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 },
  empty:       { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: 40 },
  card:        { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 10 },
  cardHead:    { display: 'flex', gap: 10, alignItems: 'flex-start' },
  avatar:      { width: 38, height: 38, borderRadius: '50%', background: '#7a3b10', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, flexShrink: 0 },
  userName:    { fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 },
  userPhone:   { fontSize: 12, color: '#94a3b8', margin: '2px 0 0' },
  userVillage: { fontSize: 11, color: '#94a3b8', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 3 },
  roleBadge:   { fontSize: 11, padding: '3px 8px', borderRadius: 99, fontWeight: 600, whiteSpace: 'nowrap' },
  cropTag:     { fontSize: 11, background: '#fdf6f0', color: '#7a3b10', padding: '2px 7px', borderRadius: 99 },
  actions:     { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  btnApprove:  { padding: '7px 12px', background: '#7a3b10', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 },
  btnLock:     { padding: '7px 12px', background: 'transparent', color: '#ef4444', border: '1px solid #fecaca', borderRadius: 8, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 5 },
  btnUnlock:   { padding: '7px 12px', background: '#fdf6f0', color: '#7a3b10', border: '1px solid #f5d5b0', borderRadius: 8, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 5 },
  roleSelect:  { padding: '6px 10px', fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#0f172a', cursor: 'pointer' },
}
