// Nén ảnh phía client TRƯỚC khi upload. Ảnh từ camera điện thoại thường 3–8MB →
// mạng quê upload lâu, phình bucket Supabase, tốn token Gemini Vision. Thu cạnh dài về
// ≤ MAX_EDGE và xuất JPEG chất lượng QUALITY thường còn ~100–400KB mà vẫn đủ rõ để
// chẩn đoán sâu bệnh.
//
// An toàn theo nguyên tắc "không bao giờ làm hỏng luồng gửi": mọi nhánh lỗi (không phải
// ảnh, trình duyệt cũ không decode được, ảnh đã nhỏ) đều TRẢ LẠI FILE GỐC để upload vẫn
// chạy. Nén chỉ là tối ưu, không phải điều kiện bắt buộc.

const MAX_EDGE   = 1280   // px — cạnh dài tối đa sau khi thu nhỏ
const QUALITY    = 0.8    // chất lượng JPEG (0–1)
const SKIP_BYTES = 300 * 1024 // ảnh đã < 300KB thì khỏi nén lại

/**
 * @param {File} file Ảnh người dùng chọn/chụp.
 * @returns {Promise<File>} File đã nén (JPEG) hoặc chính file gốc nếu không nén được.
 */
export async function compressImage(file) {
  try {
    if (!file || !file.type?.startsWith('image/')) return file
    // GIF có thể là ảnh động → nén thành JPEG sẽ mất động; bỏ qua cho an toàn.
    if (file.type === 'image/gif') return file
    if (file.size <= SKIP_BYTES) return file

    const bitmap = await createImageBitmap(file)
    const { width, height } = bitmap
    const scale = Math.min(1, MAX_EDGE / Math.max(width, height))
    // Ảnh đã nhỏ hơn MAX_EDGE và không quá nặng → giữ nguyên (tránh re-encode vô ích).
    if (scale === 1 && file.size <= SKIP_BYTES) { bitmap.close?.(); return file }

    const w = Math.round(width * scale)
    const h = Math.round(height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) { bitmap.close?.(); return file }
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()

    const blob = await new Promise(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', QUALITY)
    )
    // toBlob có thể null, hoặc nén ra to hơn bản gốc (ảnh đã tối ưu) → giữ gốc.
    if (!blob || blob.size >= file.size) return file

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() })
  } catch {
    // Trình duyệt cũ / HEIC không decode được / lỗi canvas → gửi file gốc.
    return file
  }
}
