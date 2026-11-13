import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import * as Sentry from '@sentry/react'
import { clearApiCache, unsubscribeDevicePush } from '../utils/clearSession'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      setUser: (user) => {
        set({ user })
        if (user) {
          // Chỉ id + vai trò: SĐT là dữ liệu cá nhân, không cần cho việc dò lỗi
          Sentry.setUser({ id: user.id, role: user.role })
        } else {
          Sentry.setUser(null)
        }
      },
      setToken: (token) => set({ token }),
      logout: () => {
        const { token } = get()
        // Dọn dữ liệu của tài khoản trên thiết bị (máy dùng chung) — xem utils/clearSession.js
        unsubscribeDevicePush(token)
        clearApiCache()
        set({ user: null, token: null })
        Sentry.setUser(null)
      },
    }),
    { name: 'cocon-auth' } // lưu vào localStorage
  )
)