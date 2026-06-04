// frontend/src/App.jsx
import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from './stores/authStore'

// ─── Pages tải ngay (nông dân, dùng nhiều nhất) ───────────────────────────────
import Splash        from './pages/Splash'
import Login         from './pages/Login'
import Home          from './pages/Home'
import Profile       from './pages/Profile'
import Policies      from './pages/Policies'
import ChatMain      from './pages/farmer/ChatMain'
import VoiceRecord   from './pages/farmer/VoiceRecord'
import ImageUpload   from './pages/farmer/ImageUpload'
import AIResult      from './pages/farmer/AIResult'
import WaitEngineer  from './pages/farmer/WaitEngineer'
import ChatHistory   from './pages/farmer/ChatHistory'
import Weather       from './pages/farmer/Weather'
import Community     from './pages/farmer/Community'
import PostDetail    from './pages/farmer/PostDetail'
import NotifList     from './pages/farmer/NotifList'
import NotifDetail   from './pages/farmer/NotifDetail'
import NotifSettings from './pages/farmer/NotifSettings'
import ToastContainer from './components/Toast'
import DesktopLayout  from './components/DesktopLayout'

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
  return (
    <QueryClientProvider client={queryClient}>
      <ToastContainer />
      <BrowserRouter>
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
          <Route path="/weather"          element={<Weather />} />{/* công khai — ai cũng xem được */}
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

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
