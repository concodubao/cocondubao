// frontend/src/App.jsx
import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from './stores/authStore'
import { useDisplayStore } from './stores/displayStore'

// ─── Pages tải ngay (luồng lõi nông dân: mở app → đăng nhập → trang chủ → hỏi) ──
import Splash        from './pages/Splash'
import Login         from './pages/Login'
import Home          from './pages/Home'
import ChatMain      from './pages/farmer/ChatMain'
import ToastContainer from './components/Toast'
import OfflineBanner  from './components/OfflineBanner'
import DesktopLayout  from './components/DesktopLayout'

// ─── Pages nông dân lazy (ít khi là màn đầu: nhập ảnh/giọng nói, kết quả, cộng đồng,
// thời tiết, thông báo, hồ sơ) → tách khỏi bundle khởi động cho mạng 3G quê nhanh hơn ─
const Profile       = lazy(() => import('./pages/Profile'))
const Policies      = lazy(() => import('./pages/Policies'))
const VoiceRecord   = lazy(() => import('./pages/farmer/VoiceRecord'))
const ImageUpload   = lazy(() => import('./pages/farmer/ImageUpload'))
const AIResult      = lazy(() => import('./pages/farmer/AIResult'))
const WaitEngineer  = lazy(() => import('./pages/farmer/WaitEngineer'))
const ChatHistory   = lazy(() => import('./pages/farmer/ChatHistory'))
const Weather       = lazy(() => import('./pages/farmer/Weather'))
const Community     = lazy(() => import('./pages/farmer/Community'))
const PostDetail    = lazy(() => import('./pages/farmer/PostDetail'))
const NotifList     = lazy(() => import('./pages/farmer/NotifList'))
const NotifDetail   = lazy(() => import('./pages/farmer/NotifDetail'))
const NotifSettings = lazy(() => import('./pages/farmer/NotifSettings'))

// ─── Pages lazy (kỹ sư + admin, ít dùng hơn) ─────────────────────────────────
const Queue     = lazy(() => import('./pages/engineer/Queue'))
const Answer    = lazy(() => import('./pages/engineer/Answer'))
const History   = lazy(() => import('./pages/engineer/History'))
const Knowledge = lazy(() => import('./pages/engineer/Knowledge'))
const TestAI    = lazy(() => import('./pages/engineer/TestAI'))
const Dashboard = lazy(() => import('./pages/admin/Dashboard'))
const Users     = lazy(() => import('./pages/admin/Users'))
const SendNotif = lazy(() => import('./pages/admin/SendNotif'))
const AIErrors  = lazy(() => import('./pages/admin/AIErrors'))
const AIReview  = lazy(() => import('./pages/admin/AIReview'))
const AuditLog  = lazy(() => import('./pages/admin/AuditLog'))
const Reports   = lazy(() => import('./pages/admin/Reports'))

// ─── Fallback khi lazy page đang tải ─────────────────────────────────────────
function PageLoader() {
  return (
    <div style={{
      height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#fdf8f5', fontFamily: "'Noto Sans', sans-serif",
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'linear-gradient(135deg,#4B230A,#2e1505)',
          animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{ fontSize: 14, color: '#94a3b8', margin: 0 }}>Đang tải...</p>
      </div>
      <style>{`@keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }`}</style>
    </div>
  )
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 1000 * 60 * 5 } },
})

// ─── WeatherRoute ─────────────────────────────────────────────────────────────
// /weather là route công khai (nông dân + khách xem được). Với kỹ sư/admin thì
// bọc trong DesktopLayout để giữ sidebar + thanh tab, không rớt ra trang rời rạc.
function WeatherRoute() {
  const { user } = useAuthStore()
  const isStaff = user?.role === 'engineer' || user?.role === 'admin'
  return isStaff
    ? <DesktopLayout><Weather /></DesktopLayout>
    : <Weather />
}

// ─── ProtectedRoute ───────────────────────────────────────────────────────────
function ProtectedRoute({ children, allowedRoles }) {
  const { token, user } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  if (allowedRoles && user?.role && !allowedRoles.includes(user.role)) {
    return <Navigate to="/home" replace />
  }
  return children
}

export default function App() {
  const readScale = useDisplayStore(s => s.fontScale)

  useEffect(() => {
    // Dọn sạch CSS `zoom` của bản font-scale CŨ (zoom cả trang gây vỡ/tràn layout).
    const root = document.getElementById('root')
    if (root) {
      root.style.zoom = ''
      root.style.width = ''
      root.style.marginLeft = ''
      root.style.marginRight = ''
    }
  }, [])

  useEffect(() => {
    // Phóng CỠ CHỮ ĐỌC (câu trả lời AI + nội dung thông báo) qua biến CSS, KHÔNG
    // zoom cả trang nên KHÔNG vỡ layout. Chỉ vài thành phần nội dung dùng biến này
    // (AnswerContent, NotifDetail). Px cứng ở nút/khung giữ nguyên.
    document.documentElement.style.setProperty('--read-scale', String(readScale))
  }, [readScale])

  return (
    <QueryClientProvider client={queryClient}>
      <OfflineBanner />
      <ToastContainer />
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Chung — không cần đăng nhập */}
          <Route path="/"        element={<Splash />} />
          <Route path="/login"    element={<Login />} />
          <Route path="/policies" element={<Policies />} />

          {/* Chung — cần đăng nhập */}
          <Route path="/home"    element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

          {/* Nông dân — Chat */}
          <Route path="/chat"         element={<ProtectedRoute><ChatMain /></ProtectedRoute>} />
          <Route path="/chat/voice"   element={<ProtectedRoute><VoiceRecord /></ProtectedRoute>} />
          <Route path="/chat/image"   element={<ProtectedRoute><ImageUpload /></ProtectedRoute>} />
          <Route path="/chat/result"  element={<ProtectedRoute><AIResult /></ProtectedRoute>} />
          <Route path="/chat/waiting" element={<ProtectedRoute><WaitEngineer /></ProtectedRoute>} />
          <Route path="/chat/history" element={<ProtectedRoute><ChatHistory /></ProtectedRoute>} />
          <Route path="/weather"          element={<WeatherRoute />} />{/* công khai; staff thì có layout */}
          <Route path="/community"        element={<ProtectedRoute><Community /></ProtectedRoute>} />
          <Route path="/community/:id"    element={<ProtectedRoute><PostDetail /></ProtectedRoute>} />

          {/* Nông dân — Thông báo */}
          <Route path="/notifications"          element={<ProtectedRoute><NotifList /></ProtectedRoute>} />
          <Route path="/notifications/settings" element={<ProtectedRoute><NotifSettings /></ProtectedRoute>} />
          <Route path="/notifications/:id"      element={<ProtectedRoute><NotifDetail /></ProtectedRoute>} />

          {/* Kỹ sư — lazy loaded */}
          <Route path="/engineer/queue" element={
            <ProtectedRoute allowedRoles={['engineer','admin']}>
              <DesktopLayout>
                <Suspense fallback={<PageLoader />}><Queue /></Suspense>
              </DesktopLayout>
            </ProtectedRoute>
          } />
          <Route path="/engineer/answer/:id" element={
            <ProtectedRoute allowedRoles={['engineer','admin']}>
              <DesktopLayout>
                <Suspense fallback={<PageLoader />}><Answer /></Suspense>
              </DesktopLayout>
            </ProtectedRoute>
          } />
          <Route path="/engineer/history" element={
            <ProtectedRoute allowedRoles={['engineer','admin']}>
              <DesktopLayout>
                <Suspense fallback={<PageLoader />}><History /></Suspense>
              </DesktopLayout>
            </ProtectedRoute>
          } />
          <Route path="/engineer/knowledge" element={
            <ProtectedRoute allowedRoles={['engineer','admin']}>
              <DesktopLayout>
                <Suspense fallback={<PageLoader />}><Knowledge /></Suspense>
              </DesktopLayout>
            </ProtectedRoute>
          } />
          <Route path="/engineer/test-ai" element={
            <ProtectedRoute allowedRoles={['engineer','admin']}>
              <DesktopLayout>
                <Suspense fallback={<PageLoader />}><TestAI /></Suspense>
              </DesktopLayout>
            </ProtectedRoute>
          } />

          {/* Admin — lazy loaded */}
          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <DesktopLayout>
                <Suspense fallback={<PageLoader />}><Dashboard /></Suspense>
              </DesktopLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/users" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <DesktopLayout>
                <Suspense fallback={<PageLoader />}><Users /></Suspense>
              </DesktopLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/notifications/send" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <DesktopLayout>
                <Suspense fallback={<PageLoader />}><SendNotif /></Suspense>
              </DesktopLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/ai-errors" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <DesktopLayout>
                <Suspense fallback={<PageLoader />}><AIErrors /></Suspense>
              </DesktopLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/ai-review" element={
            <ProtectedRoute allowedRoles={['engineer','admin']}>
              <DesktopLayout>
                <Suspense fallback={<PageLoader />}><AIReview /></Suspense>
              </DesktopLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/audit" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <DesktopLayout>
                <Suspense fallback={<PageLoader />}><AuditLog /></Suspense>
              </DesktopLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/community-reports" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <DesktopLayout>
                <Suspense fallback={<PageLoader />}><Reports /></Suspense>
              </DesktopLayout>
            </ProtectedRoute>
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
