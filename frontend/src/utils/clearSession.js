// Dọn dữ liệu gắn với tài khoản trên THIẾT BỊ khi đăng xuất / đổi tài khoản.
// Điện thoại trong nhà hay dùng chung, nên nếu không dọn:
//  - Workbox `api-cache` (vite.config.js) giữ response API theo URL tới 24h → người
//    sau mở app lúc mạng yếu (>4s) được trả /auth/me, bookmark… của người trước.
//  - Push subscription vẫn gắn user cũ ở server → thông báo riêng (câu trả lời kỹ sư,
//    bình luận) của người trước tiếp tục hiện trên máy.
// Mọi bước best-effort: lỗi không được chặn việc đăng xuất.

const API_CACHE = 'api-cache'

export async function clearApiCache() {
  try {
    if (typeof caches !== 'undefined') await caches.delete(API_CACHE)
  } catch { /* trình duyệt không hỗ trợ Cache Storage */ }
}

// Huỷ push của thiết bị này: báo server (cần token còn hiệu lực → gọi TRƯỚC khi xoá
// token) rồi huỷ subscription ở trình duyệt.
export async function unsubscribeDevicePush(token) {
  try {
    if (!('serviceWorker' in navigator)) return
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager?.getSubscription()
    if (!sub) return
    if (token) {
      await fetch(`${import.meta.env.VITE_API_URL}/push/unsubscribe`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => {})
    }
    await sub.unsubscribe().catch(() => {})
  } catch { /* bỏ qua */ }
}
