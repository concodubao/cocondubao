import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase: storage (list/remove/getPublicUrl) + from().update().in() cho null image_url
const store = vi.hoisted(() => ({ folders: [], files: {}, removed: [], nulled: [] }))

vi.mock('../src/services/supabase.js', () => ({
  supabase: {
    storage: {
      from: () => ({
        list: (path) => path === 'pest-images'
          ? Promise.resolve({ data: store.folders, error: null })
          : Promise.resolve({ data: store.files[path] || [], error: null }),
        remove: (paths) => { store.removed.push(...paths); return Promise.resolve({ error: null }) },
        getPublicUrl: (p) => ({ data: { publicUrl: `https://x/object/public/images/${p}` } }),
      }),
    },
    from: () => ({ update: () => ({ in: (_col, urls) => { store.nulled.push(...urls); return Promise.resolve({ error: null }) } }) }),
  },
}))

const { cleanupOldPestImages } = await import('../src/services/storageCleanup.js')
const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString()

describe('cleanupOldPestImages', () => {
  beforeEach(() => { store.folders = []; store.files = {}; store.removed = []; store.nulled = [] })

  it('chỉ xóa ảnh > 30 ngày, giữ ảnh mới', async () => {
    store.folders = [{ id: null, name: 'user1' }]
    store.files['pest-images/user1'] = [
      { id: 'a', name: '111.jpg', created_at: daysAgo(40) }, // cũ → xóa
      { id: 'b', name: '222.jpg', created_at: daysAgo(5) },  // mới → giữ
    ]
    const n = await cleanupOldPestImages()
    expect(n).toBe(1)
    expect(store.removed).toEqual(['pest-images/user1/111.jpg'])
    // null image_url đúng URL ảnh đã xóa
    expect(store.nulled).toEqual(['https://x/object/public/images/pest-images/user1/111.jpg'])
  })

  it('không có ảnh cũ → xóa 0', async () => {
    store.folders = [{ id: null, name: 'user1' }]
    store.files['pest-images/user1'] = [{ id: 'b', name: '222.jpg', created_at: daysAgo(5) }]
    expect(await cleanupOldPestImages()).toBe(0)
    expect(store.removed).toEqual([])
  })

  it('bỏ qua placeholder (.emptyFolderPlaceholder) và folder lạ', async () => {
    store.folders = [{ id: null, name: 'user1' }, { id: 'x', name: 'lac.jpg', created_at: daysAgo(99) }]
    store.files['pest-images/user1'] = [
      { id: null, name: '.emptyFolderPlaceholder', created_at: daysAgo(99) }, // bỏ qua
      { id: 'a', name: '111.jpg', created_at: daysAgo(40) },                  // xóa
    ]
    const n = await cleanupOldPestImages()
    expect(n).toBe(1)
    expect(store.removed).toEqual(['pest-images/user1/111.jpg'])
  })
})
