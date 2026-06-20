import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Cỡ chữ hiển thị cho nông dân lớn tuổi. Dùng CSS `zoom` (Chrome/WebKit — đa số
// điện thoại ở quê) để phóng to toàn bộ UI đồng đều, vì app dùng nhiều px cứng
// nên không scale theo rem được. 1 = thường, 1.15 = lớn, 1.3 = rất lớn.
export const useDisplayStore = create(
  persist(
    (set) => ({
      fontScale: 1,
      setFontScale: (fontScale) => set({ fontScale }),
    }),
    { name: 'cocon-display' }
  )
)
