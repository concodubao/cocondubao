import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 15000
})

api.interceptors.request.use(config => {
  const stored = JSON.parse(localStorage.getItem('cocon-auth') || '{}')
  const token = stored?.state?.token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('cocon-auth')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const authAPI = {
  requestOTP:      (phone)                  => api.post('/auth/request-otp', { phone }),
  verifyOTP:       (phone, otp, role)       => api.post('/auth/verify-otp', { phone, otp, role }),
  loginEmail:      (email, password)        => api.post('/auth/login-email', { email, password }),
  loginPhone:      (phone, password)        => api.post('/auth/login-phone', { phone, password }),
  registerEmail:   (email, password, role)  => api.post('/auth/register-email', { email, password, role }),
  me:              ()                       => api.get('/auth/me'),
  updateProfile:   (data)                   => api.patch('/auth/profile', data),
  setPassword:     (password)               => api.patch('/auth/set-password', { password }),
  changePassword:  (currentPassword, newPassword) => api.patch('/auth/change-password', { currentPassword, newPassword }),
}

export const chatAPI = {
  ask:          data      => api.post('/chat/ask', data),
  askWithImage: formData  => api.post('/chat/ask-with-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getSessions:  userId     => api.get(`/chat/sessions/${userId}`),
  getMessages:  sessionId  => api.get(`/chat/messages/${sessionId}`),
  reportError:  data       => api.post('/chat/report-error', data),
}

export const pushAPI = {
  subscribe:        data    => api.post('/push/subscribe', data),
  unsubscribe:      data    => api.delete('/push/unsubscribe', { data }),
  send:             data    => api.post('/push/send', data),
  getNotifications: userId  => api.get(`/push/notifications/${userId}`),
  markRead:         (id)    => api.patch(`/push/notifications/${id}/read`),
  updateSettings:   settings => api.patch('/push/notifications/settings', settings),
}

export const engineerAPI = {
  // Hàng đợi
  getQueue:        (status = 'pending') => api.get(`/engineer/queue?status=${status}`),
  take:            (id)                 => api.patch(`/engineer/queue/${id}/take`),
  answer:          (id, data)           => api.patch(`/engineer/queue/${id}/answer`, data),
  deleteQueueItem: (id)                 => api.delete(`/engineer/queue/${id}`),
  getHistory:      (params = {})        => api.get('/engineer/history', { params }),

  // Kho tri thức
  uploadDoc:  (formData) => api.post('/knowledge/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getDocs:    (status)   => api.get('/knowledge/docs' + (status ? `?status=${status}` : '')),
  approveDoc: (id)       => api.patch(`/knowledge/${id}/approve`, {}, { timeout: 120000 }),
  archiveDoc: (id)       => api.patch(`/knowledge/${id}/archive`),
  deleteDoc:  (id)       => api.delete(`/knowledge/${id}`),
}

export const communityAPI = {
  getFeed:        (params = {})  => api.get('/community/feed', { params }),
  createPost:     (formData)     => api.post('/community/posts', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  deletePost:     (id)           => api.delete(`/community/posts/${id}`),
  toggleLike:     (id)           => api.post(`/community/posts/${id}/like`),
  getComments:    (id)           => api.get(`/community/posts/${id}/comments`),
  addComment:     (id, content)  => api.post(`/community/posts/${id}/comments`, { content }),
  deleteComment:  (id)           => api.delete(`/community/comments/${id}`),
}

export const adminAPI = {
  createEngineer: (data)         => api.post('/admin/engineers', data),
  getStats:       ()             => api.get('/admin/stats'),
  getUsers:       (params = {}) => api.get('/admin/users', { params }),
  updateUser:     (id, updates) => api.patch(`/admin/users/${id}`, updates),
  getAIErrors: (reviewed)       => api.get('/admin/ai-errors', {
    params: reviewed !== undefined ? { reviewed } : {}
  }),
  reviewError: (id)             => api.patch(`/admin/ai-errors/${id}`),
}
 
export default api