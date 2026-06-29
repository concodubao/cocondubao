import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import * as Sentry from '@sentry/react'

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      setUser: (user) => {
        set({ user })
        if (user) {
          Sentry.setUser({ id: user.id, phone: user.phone, role: user.role })
        } else {
          Sentry.setUser(null)
        }
      },
      setToken: (token) => set({ token }),
      logout: () => {
        set({ user: null, token: null })
        Sentry.setUser(null)
      },
    }),
    { name: 'cocon-auth' } // lưu vào localStorage
  )
)