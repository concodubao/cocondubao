// Khoá chống dò mật khẩu/PIN (in-memory; backstop cùng rate-limit theo IP).
// PIN 6 số (1 triệu tổ hợp) nên cần chặn dò: sai 5 lần/1 tài khoản → khoá 10 phút.
// Dùng chung cho đăng nhập SĐT lẫn email, key dạng 'phone:<sđt>' / 'email:<email>'.
// Tách khỏi routes/auth.js để admin "Đặt lại PIN" xoá được khoá của số đó (thông báo
// khoá bảo nông dân "nhờ quản trị viên đặt lại mã PIN" — đặt lại xong phải vào được ngay).
const MAX_ATTEMPTS = 5
const LOCK_MS      = 10 * 60 * 1000
const FAIL_WINDOW  = 30 * 60 * 1000  // lần sai cũ hơn 30 phút thì quên (đếm lại từ 0)
const MAX_TRACKED  = 10_000          // trần bộ nhớ: dò hàng loạt số không làm phình Map
const _loginAttempts = new Map() // key → { count, lockedUntil, lastFail }

export function lockMinutesLeft(key) {
  const a = _loginAttempts.get(key)
  if (a?.lockedUntil && Date.now() < a.lockedUntil) {
    return Math.ceil((a.lockedUntil - Date.now()) / 60000)
  }
  return 0
}

export function recordFail(key) {
  const now = Date.now()
  let a = _loginAttempts.get(key)
  if (!a || (now - a.lastFail > FAIL_WINDOW && now >= a.lockedUntil)) a = { count: 0, lockedUntil: 0, lastFail: 0 }
  a.count += 1
  a.lastFail = now
  if (a.count >= MAX_ATTEMPTS) { a.lockedUntil = now + LOCK_MS; a.count = 0 }
  _loginAttempts.delete(key) // set lại để key vừa sai nằm cuối thứ tự chèn
  _loginAttempts.set(key, a)
  if (_loginAttempts.size > MAX_TRACKED) {
    // Bỏ entry cũ nhất không còn đang khoá
    for (const [k, v] of _loginAttempts) {
      if (now >= v.lockedUntil) { _loginAttempts.delete(k); break }
    }
  }
}

export function clearFail(key) { _loginAttempts.delete(key) }

// PIN quá dễ đoán: kẻ xấu không cần dò 1 tài khoản mà thử vài PIN phổ biến trên NHIỀU số
// (khoá theo từng tài khoản không chặn được kiểu dò rải này). Chặn ngay lúc đặt PIN.
export function isWeakPin(pin) {
  if (typeof pin !== 'string' || !/^\d{6}$/.test(pin)) return false
  if (/^(\d)\1{5}$/.test(pin)) return true                       // 000000, 111111…
  if ('0123456789'.includes(pin) || '9876543210'.includes(pin)) return true // 123456, 654321…
  if (/^(\d{2})\1\1$/.test(pin) || /^(\d{3})\1$/.test(pin)) return true     // 121212, 123123
  if (/^(\d)\1(\d)\2(\d)\3$/.test(pin)) return true              // 112233
  return false
}
export const WEAK_PIN_MSG = 'Mã PIN này quá dễ đoán (như 123456, 111111). Bạn chọn 6 số khác nhé.'
