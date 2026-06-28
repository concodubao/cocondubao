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
  registerPhone:   (phone, password)        => api.post('/auth/register-phone', { phone, password }),
  registerEmail:   (email, password, role)  => api.post('/auth/register-email', { email, password, role }),
  me:              ()                       => api.get('/auth/me'),
  updateProfile:   (data)                   => api.patch('/auth/profile', data),
  setPassword:     (password)               => api.patch('/auth/set-password', { password }),
  changePassword:  (currentPassword, newPassword) => api.patch('/auth/change-password', { currentPassword, newPassword }),
  deleteAccount:   ()                       => api.delete('/auth/account'),
}

export const chatAPI = {
  // Chat cần timeout dài hơn mặc định 15s: LLM có thể retry khi gặp 429 (chờ tới ~45s)
  ask:          data      => api.post('/chat/ask', data, { timeout: 45000 }),
  askWithImage: formData  => api.post('/chat/ask-with-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  }),
  getSessions:  userId     => api.get(`/chat/sessions/${userId}`),
  getMessages:  sessionId  => api.get(`/chat/messages/${sessionId}`),
  reportError:  data       => api.post('/chat/report-error', data),
  escalate:     messageId  => api.post('/chat/escalate', { messageId }),
  feedback:     (messageId, helpful = true) => api.post('/chat/feedback', { messageId, helpful }),
}

export const pushAPI = {
  subscribe:        data    => api.post('/push/subscribe', data),
  unsubscribe:      data    => api.delete('/push/unsubscribe', { data }),
  send:             data    => api.post('/push/send', data),
  uploadImage:      formData => api.post('/push/upload-image', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getNotifications: userId  => api.get(`/push/notifications/${userId}`),
  getNotification:  (id)    => api.get(`/push/notifications/item/${id}`),
  markRead:         (id)    => api.patch(`/push/notifications/${id}/read`),
  getSettings:      ()      => api.get('/push/notifications/settings'),
  updateSettings:   settings => api.patch('/push/notifications/settings', settings),
  getScheduled:     ()      => api.get('/push/scheduled'),
  cancelScheduled:  (id)    => api.delete(`/push/scheduled/${id}`),
  getDrafts:        ()      => api.get('/push/drafts'),
  approveDraft:     (id)    => api.post(`/push/drafts/${id}/approve`),
  dismissDraft:     (id)    => api.delete(`/push/drafts/${id}`),
}

export const engineerAPI = {
  // Hàng đợi
  getQueue:        (status = 'pending', limit = 50) => api.get(`/engineer/queue?status=${status}&limit=${limit}`),
  getQueueItem:    (id)                 => api.get(`/engineer/queue/${id}`),
  take:            (id)                 => api.patch(`/engineer/queue/${id}/take`),
  answer:          (id, data)           => api.patch(`/engineer/queue/${id}/answer`, data),
  deleteQueueItem: (id)                 => api.delete(`/engineer/queue/${id}`),
  getHistory:      (params = {})        => api.get('/engineer/history', { params }),
  getStats:        ()                   => api.get('/engineer/stats'),

  // Kho tri thức
  uploadDoc:  (formData) => api.post('/knowledge/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  addQA:      (data)     => api.post('/knowledge/qa', data, { timeout: 120000 }),
  getDocs:    (status)   => api.get('/knowledge/docs' + (status ? `?status=${status}` : '')),
  getDoc:     (id)       => api.get(`/knowledge/docs/${id}`),
  approveDoc: (id)       => api.patch(`/knowledge/${id}/approve`, {}, { timeout: 120000 }),
  archiveDoc: (id)       => api.patch(`/knowledge/${id}/archive`),
  deleteDoc:  (id)       => api.delete(`/knowledge/${id}`),
}

export const communityAPI = {
  getFeed:        (params = {})  => api.get('/community/feed', { params }),
  getPost:        (id)           => api.get(`/community/posts/${id}`),
  createPost:     (formData)     => api.post('/community/posts', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  deletePost:     (id)           => api.delete(`/community/posts/${id}`),
  toggleLike:     (id)           => api.post(`/community/posts/${id}/like`),
  getComments:    (id)           => api.get(`/community/posts/${id}/comments`),
  addComment:     (id, content)  => api.post(`/community/posts/${id}/comments`, { content }),
  deleteComment:  (id)           => api.delete(`/community/comments/${id}`),
  reportPost:     (id, reason)   => api.post(`/community/posts/${id}/report`, { reason }),
  reportComment:  (id, reason)   => api.post(`/community/comments/${id}/report`, { reason }),
  getReports:     ()            => api.get('/community/reports'),
  dismissReport:  (targetType, targetId) => api.patch('/community/reports/dismiss', { targetType, targetId }),
}

export const adminAPI = {
  createEngineer: (data)         => api.post('/admin/engineers', data),
  getStats:       ()             => api.get('/admin/stats'),
  getKnowledgeGaps: ()           => api.get('/admin/knowledge-gaps'),
  getAIReview:    (filter)       => api.get('/admin/ai-review', { params: filter ? { filter } : {} }),
  addKnowledgeQA: (data)         => api.post('/admin/knowledge-qa', data),
  getUsers:       (params = {}) => api.get('/admin/users', { params }),
  exportUsers:    (role)        => api.get('/admin/users/export', { params: role ? { role } : {}, responseType: 'text' }),
  getUserActivity:(id)          => api.get(`/admin/users/${id}/activity`),
  getAudit:       ()            => api.get('/admin/audit'),
  updateUser:     (id, updates) => api.patch(`/admin/users/${id}`, updates),
  resetUserPin:   (id)          => api.patch(`/admin/users/${id}/reset-pin`),
  getAIErrors: (reviewed)       => api.get('/admin/ai-errors', {
    params: reviewed !== undefined ? { reviewed } : {}
  }),
  reviewError: (id)             => api.patch(`/admin/ai-errors/${id}`),
  errorToKnowledge: (id, data)  => api.post(`/admin/ai-errors/${id}/to-knowledge`, data),
}
 
export default api