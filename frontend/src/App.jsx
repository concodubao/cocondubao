// frontend/src/App.jsx — FIX
// Vấn đề cũ: ProtectedRoute dùng user thay vì token
// → sau khi đăng nhập, token có trong store nhưng user chưa load → redirect về /login

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from './stores/authStore'

// Pages — chung
import Splash    from './pages/Splash'
import Login     from './pages/Login'
import Home      from './pages/Home'
import Profile   from './pages/Profile'

// Pages — Nông dân
import ChatMain     from './pages/farmer/ChatMain'
import VoiceRecord  from './pages/farmer/VoiceRecord'
import ImageUpload  from './pages/farmer/ImageUpload'
import AIResult     from './pages/farmer/AIResult'
import WaitEngineer from './pages/farmer/WaitEngineer'
import NotifList    from './pages/farmer/NotifList'
import NotifDetail  from './pages/farmer/NotifDetail'
import NotifSettings from './pages/farmer/NotifSettings'

// Pages — Kỹ sư
import Queue     from './pages/engineer/Queue'
import Answer    from './pages/engineer/Answer'
import Knowledge from './pages/engineer/Knowledge'
import TestAI    from './pages/engineer/TestAI'

// Pages — Admin
import Dashboard from './pages/admin/Dashboard'
import Users     from './pages/admin/Users'
import SendNotif from './pages/admin/SendNotif'
import AIErrors  from './pages/admin/AIErrors'

import DesktopLayout from './components/DesktopLayout'
import ToastContainer from './components/Toast'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 1000 * 60 * 5 } },
})

// ─── ProtectedRoute ───────────────────────────────────────────────────────────
// Dùng TOKEN (không phải user) để check — token được persist trong localStorage
// user có thể chưa load khi component mount lần đầu
function ProtectedRoute({ children, allowedRoles }) {
  const { token, user } = useAuthStore()

  // Chưa đăng nhập
  if (!token) return <Navigate to="/login" replace />

  // Đã đăng nhập nhưng không đúng role
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
          <Route path="/"      element={<Splash />} />
          <Route path="/login" element={<Login />} />

          {/* Chung — cần đăng nhập */}
          <Route path="/home"    element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

          {/* Nông dân — Chat */}
          <Route path="/chat"         element={<ProtectedRoute><ChatMain /></ProtectedRoute>} />
          <Route path="/chat/voice"   element={<ProtectedRoute><VoiceRecord /></ProtectedRoute>} />
          <Route path="/chat/image"   element={<ProtectedRoute><ImageUpload /></ProtectedRoute>} />
          <Route path="/chat/result"  element={<ProtectedRoute><AIResult /></ProtectedRoute>} />
          <Route path="/chat/waiting" element={<ProtectedRoute><WaitEngineer /></ProtectedRoute>} />

          {/* Nông dân — Thông báo
              LƯU Ý: /settings phải đứng TRƯỚC /:id
              nếu không React Router match "settings" như một :id param */}
          <Route path="/notifications"          element={<ProtectedRoute><NotifList /></ProtectedRoute>} />
          <Route path="/notifications/settings" element={<ProtectedRoute><NotifSettings /></ProtectedRoute>} />
          <Route path="/notifications/:id"      element={<ProtectedRoute><NotifDetail /></ProtectedRoute>} />

          {/* Kỹ sư */}
          <Route path="/engineer/queue"      element={<ProtectedRoute allowedRoles={['engineer','admin']}><DesktopLayout><Queue /></DesktopLayout></ProtectedRoute>} />
          <Route path="/engineer/answer/:id" element={<ProtectedRoute allowedRoles={['engineer','admin']}><DesktopLayout><Answer /></DesktopLayout></ProtectedRoute>} />
          <Route path="/engineer/knowledge"  element={<ProtectedRoute allowedRoles={['engineer','admin']}><DesktopLayout><Knowledge /></DesktopLayout></ProtectedRoute>} />
          <Route path="/engineer/test-ai"    element={<ProtectedRoute allowedRoles={['engineer','admin']}><DesktopLayout><TestAI /></DesktopLayout></ProtectedRoute>} />

          {/* Admin */}
          <Route path="/admin"                    element={<ProtectedRoute allowedRoles={['admin']}><DesktopLayout><Dashboard /></DesktopLayout></ProtectedRoute>} />
          <Route path="/admin/users"              element={<ProtectedRoute allowedRoles={['admin']}><DesktopLayout><Users /></DesktopLayout></ProtectedRoute>} />
          <Route path="/admin/notifications/send" element={<ProtectedRoute allowedRoles={['admin']}><DesktopLayout><SendNotif /></DesktopLayout></ProtectedRoute>} />
          <Route path="/admin/ai-errors"          element={<ProtectedRoute allowedRoles={['admin']}><DesktopLayout><AIErrors /></DesktopLayout></ProtectedRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}