import { useEffect, useCallback, useState } from 'react'
import { pushAPI } from '../services/api'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export function usePush(userId) {
  const [permission,   setPermission]   = useState(() => {
    try { return Notification.permission } catch { return 'default' }
  })
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [error,        setError]        = useState(null)

  // Kiểm tra subscription hiện tại khi mount hoặc userId thay đổi
  useEffect(() => {
    if (!userId || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.ready.then(reg =>
      reg.pushManager.getSubscription().then(sub => {
        console.log('[PUSH] existing subscription:', sub ? 'yes' : 'none')
        setIsSubscribed(!!sub)
        // Nếu browser đã subscribe nhưng server chưa có → re-sync
        if (sub && Notification.permission === 'granted') {
          pushAPI.subscribe({ subscription: sub }).catch(() => {})
        }
      })
    )
  }, [userId])

  const subscribe = useCallback(async () => {
    if (!userId) { console.warn('[PUSH] no userId'); return }
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setError('Trình duyệt không hỗ trợ push notification.')
      return
    }
    if (!import.meta.env.VITE_VAPID_PUBLIC_KEY) {
      console.error('[PUSH] VITE_VAPID_PUBLIC_KEY chưa được set!')
      setError('Cấu hình VAPID thiếu — liên hệ admin.')
      return
    }

    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      console.log('[PUSH] permission:', perm)

      if (perm !== 'granted') {
        setError('Bạn chưa cho phép nhận thông báo.')
        return
      }

      const registration = await navigator.serviceWorker.ready
      console.log('[PUSH] SW ready, scope:', registration.scope)

      const appKey = urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY)

      // Tái dùng subscription hiện có nếu ĐÚNG VAPID key. Trước đây luôn unsubscribe
      // rồi subscribe lại → mỗi lần sinh endpoint MỚI → server gửi lại welcome push
      // (spam) + tích endpoint rác trong DB. Chỉ tạo mới khi chưa có / key đã đổi.
      let subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        const cur = new Uint8Array(subscription.options?.applicationServerKey || [])
        const sameKey = cur.length === appKey.length && cur.every((b, i) => b === appKey[i])
        if (!sameKey) {
          await pushAPI.unsubscribe({ endpoint: subscription.endpoint }).catch(() => {})
          await subscription.unsubscribe()
          subscription = null
        }
      }
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly:      true,
          applicationServerKey: appKey,
        })
      }
      console.log('[PUSH] browser subscription endpoint:', subscription.endpoint.slice(0, 60) + '...')

      await pushAPI.subscribe({ subscription })
      console.log('[PUSH] subscription saved to server ✓')
      setIsSubscribed(true)
      setError(null)

    } catch (err) {
      console.error('[PUSH] subscribe error:', err.name, err.message)
      if (err.name === 'NotAllowedError') {
        setError('Bạn đã từ chối thông báo. Vào cài đặt trình duyệt để bật lại.')
      } else if (err.response) {
        // Lỗi từ server
        setError('Lỗi server: ' + (err.response.data?.error || err.message))
      } else {
        setError('Không đăng ký được: ' + err.message)
      }
    }
  }, [userId])

  const unsubscribe = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await pushAPI.unsubscribe({ endpoint: sub.endpoint })
        await sub.unsubscribe()
        setIsSubscribed(false)
      }
    } catch (err) {
      console.error('[PUSH] unsubscribe error:', err)
    }
  }, [])

  return { permission, isSubscribed, error, subscribe, unsubscribe }
}
