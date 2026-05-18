// Role-Based Access Control — kiểm tra quyền hạn
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Chưa đăng nhập' })
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Không có quyền thực hiện thao tác này' })
    }
    next()
  }
}