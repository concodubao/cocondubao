// Dọn dữ liệu gắn với tài khoản trên THIẾT BỊ khi đăng xuất / đổi tài khoản.
// Điện thoại trong nhà hay dùng chung, nên nếu không dọn:
//  - Workbox `api-cache` (vite.config.js) giữ response API theo URL tới 24h → người
//    sau mở app lúc mạng yếu (>4s) được trả /auth/me, bookmark… của người trước.
//  - Push subscription vẫn gắn user cũ ở server → thông báo riêng (câu trả lời kỹ sư,
//    bình luận) của người trước tiếp tục hiện trên máy.
// Sau khi đăng nhập lại, resyncDevicePush() tự gắn push cho tài khoản mới (không hỏi
// lại quyền) — trừ khi chính user đó đã chủ động TẮT thông báo.
// Mọi bước best-effort: lỗi không được chặn việc đăng xuất.

const API_CACHE = 'api-cache'
const API_URL = String(import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')
const optOutKey = (userId) => `cocon-push-optout:${userId}`

export async function clearApiCache() {
  try {
    if (typeof caches !== 'undefined') await caches.delete(API_CACHE)
  } catch { /* trình duyệt không hỗ trợ Cache Storage */ }
}

async function currentSubscription() {
  if (!('serviceWorker' in navigator)) return null
  const reg = await navigator.serviceWorker.getRegistration()
  return (await reg?.pushManager?.getSubscription()) || null
}

// Đăng xuất chủ động: báo server (token còn hiệu lực → gọi TRƯỚC khi xoá token) và
// huỷ subscription ở trình duyệt SONG SONG. keepalive để điều hướng trang không huỷ request.
export async function unsubscribeDevicePush(token) {
  try {
    const sub = await currentSubscription()
    if (!sub) return
    const tasks = [sub.unsubscribe().catch(() => {})]
    if (token) {
      tasks.push(fetch(`${API_URL}/push/unsubscribe`, {
        method: 'DELETE',
        keepalive: true,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => {}))
    }
    await Promise.allSettled(tasks)
  } catch { /* bỏ qua */ }
}

// Phiên kết thúc do 401 (hết hạn / bị thu hồi / đổi PIN ở máy khác): token đã chết nên
// không báo server được — chỉ huỷ ở trình duyệt; endpoint chết ở server sẽ bị push
// service trả 410/404 và tự đánh dấu inactive (webpush.js). Có giới hạn thời gian để
// không giữ người dùng ở màn cũ quá lâu.
export async function cleanupAfterSessionEnd(timeoutMs = 1500) {
  const work = Promise.allSettled([
    clearApiCache(),
    currentSubscription().then(s => s?.unsubscribe()).catch(() => {}),
  ])
  await Promise.race([work, new Promise(r => setTimeout(r, timeoutMs))])
}

// Ghi nhớ lựa chọn TẮT thông báo của từng user (NotifSettings) để resync không bật lại.
export function setPushOptOut(userId, optedOut) {
  try {
    if (!userId) return
    if (optedOut) localStorage.setItem(optOutKey(userId), '1')
    else localStorage.removeItem(optOutKey(userId))
  } catch { /* storage bị chặn */ }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from([...atob(base64)].map(c => c.charCodeAt(0)))
}

// Sau đăng nhập (mọi vai trò, kể cả trang kỹ sư không dùng usePush): nếu quyền thông báo
// ĐÃ được cấp thì gắn push cho tài khoản hiện tại — tạo subscription mới không cần hỏi
// lại nếu lần đăng xuất trước đã huỷ. Server upsert theo endpoint → gán đúng user mới.
export async function resyncDevicePush(userId, token) {
  try {
    if (!userId || !token) return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    try { if (localStorage.getItem(optOutKey(userId))) return } catch { /* bỏ qua */ }
    const vapid = import.meta.env.VITE_VAPID_PUBLIC_KEY
    if (!vapid) return
    const reg = await navigator.serviceWorker.ready
    const appKey = urlBase64ToUint8Array(vapid)
    let sub = await reg.pushManager.getSubscription()
    if (sub) {
      // Đổi cặp khoá VAPID (rotate sau sự cố lộ khoá) → subscription cũ ký theo khoá cũ,
      // server gửi bằng khoá mới sẽ bị push service từ chối. Tạo lại cho khớp khoá mới.
      const cur = new Uint8Array(sub.options?.applicationServerKey || [])
      const sameKey = cur.length === appKey.length && cur.every((b, i) => b === appKey[i])
      if (!sameKey) { await sub.unsubscribe().catch(() => {}); sub = null }
    }
    if (!sub) {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey })
    }
    await fetch(`${API_URL}/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    })
  } catch { /* best-effort */ }
}
