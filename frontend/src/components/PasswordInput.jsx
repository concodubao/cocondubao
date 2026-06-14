import { useState } from 'react'

// Input mật khẩu có nút ẩn/hiện (con mắt). Nhận mọi prop của <input>, trừ `type`.
// className giữ nguyên style của nơi gọi; tự thêm pr-12 chừa chỗ cho nút mắt.
export default function PasswordInput({ className = '', ...props }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input {...props} type={show ? 'text' : 'password'} className={`${className} pr-12`} />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        tabIndex={-1}
        aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7a6358] flex items-center"
      >
        <span className="material-symbols-outlined text-[20px]">
          {show ? 'visibility_off' : 'visibility'}
        </span>
      </button>
    </div>
  )
}
