-- Nhật ký thao tác của admin (khóa/mở user, đổi vai trò, reset PIN, tạo nhân sự).
-- Lưu sẵn admin_name/target_name để hiển thị không cần join (đơn giản & bền).
create table if not exists public.admin_audit_log (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid,
  admin_name  text,
  action      text not null,   -- lock_user | unlock_user | change_role | reset_pin | create_staff
  target_id   uuid,
  target_name text,
  detail      text,
  created_at  timestamptz default now()
);

create index if not exists idx_admin_audit_created on public.admin_audit_log (created_at desc);

-- RLS bật, không tạo policy cho client → chỉ service key (backend) đọc/ghi được.
alter table public.admin_audit_log enable row level security;
