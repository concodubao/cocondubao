import { useState, useEffect } from 'react'

// True khi màn hình >= breakpoint (mặc định 768px = md). Dùng để ẩn nút "Quay lại"
// trên desktop (đã có sidebar điều hướng) và đổi layout cho hợp màn lớn.
export function useIsDesktop(breakpoint = 768) {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= breakpoint : false
  )
  useEffect(() => {
    const fn = () => setIsDesktop(window.innerWidth >= breakpoint)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [breakpoint])
  return isDesktop
}
