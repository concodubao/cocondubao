import jwt from 'jsonwebtoken'

export function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Chưa đăng nhập.' })
  }

  try {
    const token = authHeader.split(' ')[1]
    req.user = jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' })
  }
}

// Dùng: requireRole('engineer', 'admin')
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Chưa đăng nhập.' })
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Không có quyền thực hiện thao tác này.' })
    }
    next()
  }
}