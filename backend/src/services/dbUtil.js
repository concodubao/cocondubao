// Tiện ích dùng chung cho route/service gọi Supabase.

// PostgREST cắt mỗi truy vấn ở 1000 dòng (mặc định của Supabase) mà KHÔNG báo lỗi → thống
// kê, xuất CSV, danh sách thiết bị nhận push… âm thầm thiếu dữ liệu khi vượt 1000. Hàm này
// lặp .range() tới khi hết. `build` trả về 1 query builder MỚI mỗi lần gọi (đã có
// select/filter/order ổn định); maxRows chặn trường hợp bảng phình bất thường.
export async function fetchAllRows(build, { pageSize = 1000, maxRows = 20_000 } = {}) {
  const rows = []
  for (let from = 0; from < maxRows; from += pageSize) {
    const { data, error } = await build().range(from, from + pageSize - 1)
    if (error) return { data: rows, error }
    rows.push(...(data || []))
    if (!data || data.length < pageSize) break
  }
  return { data: rows, error: null }
}

// Lỗi 500 thống nhất: log chi tiết ở server, trả thông báo chung cho client. Trước đây
// nhiều route trả thẳng error.message của Postgres/PostgREST (lộ tên bảng, cột, ràng buộc).
export const GENERIC_ERROR = 'Có lỗi xảy ra, vui lòng thử lại sau.'
export function fail500(res, err, where = 'API') {
  console.error(`[${where}]`, err?.message || err)
  return res.status(500).json({ error: GENERIC_ERROR })
}
