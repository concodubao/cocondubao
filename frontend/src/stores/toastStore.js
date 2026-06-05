import { create } from 'zustand'

// ─── Store ─────────────────────────────────────────────────
let _id = 0
export const useToastStore = create((set) => ({
  toasts: [],
  add:    (toast) => set(s => ({ toasts: [...s.toasts, { id: ++_id, ...toast }] })),
  remove: (id)   => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}))

// ─── Helper (gọi từ bất kỳ đâu, kể cả ngoài React) ─────────
const { add } = useToastStore.getState()
export const toast = {
  success: (msg, opts) => add({ type: 'success', msg, ...opts }),
  error:   (msg, opts) => add({ type: 'error',   msg, ...opts }),
  info:    (msg, opts) => add({ type: 'info',     msg, ...opts }),
  warning: (msg, opts) => add({ type: 'warning',  msg, ...opts }),
}
