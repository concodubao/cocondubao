import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Mẫu trả lời tự lưu của kỹ sư. Lưu theo trình duyệt (localStorage) — đủ dùng vì
// kỹ sư thường ngồi 1 máy. Có thể nâng lên bảng DB để đồng bộ đa thiết bị sau.
export const useTemplateStore = create(
  persist(
    (set) => ({
      templates: [], // [{ id, label, text }]
      addTemplate:    (t)  => set(s => ({ templates: [...s.templates, t] })),
      removeTemplate: (id) => set(s => ({ templates: s.templates.filter(x => x.id !== id) })),
    }),
    { name: 'cocon-eng-templates' }
  )
)
