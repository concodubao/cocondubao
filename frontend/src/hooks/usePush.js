// frontend/src/hooks/usePush.js
// Hook đăng ký Web Push — gọi khi user đăng nhập xong

import { useEffect, useCallback, useState } from 'react'
import { pushAPI } from '../services/api'

// Chuyển VAPID public key từ base64url → Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export function usePush(userId) {
  const [permission,   setPermission]   = useState(Notification.permission)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [error,        setError]        = useState(null)

  // Kiểm tra đã subscribe chưa khi mount
  useEffect(() => {
    if (!userId || !('serviceWorker' in navigator)) return

    navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.getSubscription().then(sub => {
        setIsSubscribed(!!sub)
      })
    })
  }, [userId])

  const subscribe = useCallback(async () => {
    if (!userId) return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setError('Trình duyệt không hỗ trợ push notification.')
      return
    }

    try {
      // 1. Xin quyền notification
      const perm = await Notification.requestPermission()
      setPermission(perm)

      if (perm !== 'granted') {
        setError('Bạn chưa cho phép nhận thông báo.')
        return
      }

      // 2. Lấy Service Worker registration
      const registration = await navigator.serviceWorker.ready

      // 3. Subscribe với VAPID key
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(
          import.meta.env.VITE_VAPID_PUBLIC_KEY
        ),
      })

      // 4. Gửi subscription lên backend
      await pushAPI.subscribe({ subscription })
      setIsSubscribed(true)
      setError(null)

    } catch (err) {
      console.error('[PUSH] subscribe error:', err)
      if (err.name === 'NotAllowedError') {
        setError('Bạn đã từ chối nhận thông báo. Vào cài đặt trình duyệt để bật lại.')
      } else {
        setError('Không đăng ký được thông báo: ' + err.message)
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