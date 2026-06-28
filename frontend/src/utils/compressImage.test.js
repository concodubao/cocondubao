import { describe, it, expect } from 'vitest'
import { compressImage } from './compressImage'

// jsdom không có canvas thật nên ta kiểm các nhánh "trả về file gốc" — chính là phần
// an toàn quan trọng nhất: nén chỉ là tối ưu, KHÔNG được làm hỏng luồng gửi.
function makeFile(bytes, type, name = 'photo') {
  const blob = new Blob([new Uint8Array(bytes)], { type })
  return new File([blob], name, { type })
}

describe('compressImage — fallback an toàn', () => {
  it('trả lại đúng file khi không phải ảnh', async () => {
    const f = makeFile(1000, 'application/pdf', 'doc.pdf')
    expect(await compressImage(f)).toBe(f)
  })

  it('bỏ qua GIF (giữ ảnh động)', async () => {
    const f = makeFile(500 * 1024, 'image/gif', 'anim.gif')
    expect(await compressImage(f)).toBe(f)
  })

  it('ảnh đã nhỏ (<300KB) thì giữ nguyên, không re-encode', async () => {
    const f = makeFile(50 * 1024, 'image/jpeg')
    expect(await compressImage(f)).toBe(f)
  })

  it('không ném lỗi khi đầu vào rỗng', async () => {
    expect(await compressImage(null)).toBe(null)
  })

  it('ảnh lớn nhưng môi trường không decode được → vẫn trả file gốc (không throw)', async () => {
    // jsdom: createImageBitmap không có/khả dụng → nhánh catch trả file gốc.
    const f = makeFile(2 * 1024 * 1024, 'image/jpeg', 'big.jpg')
    const out = await compressImage(f)
    expect(out).toBe(f)
  })
})
