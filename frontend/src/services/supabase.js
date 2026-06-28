import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// LƯU Ý: KHÔNG dùng Supabase Realtime trên engineer_queue. Client này chỉ có anon key
// (app đăng nhập bằng JWT tự ký, không qua Supabase Auth) → auth.uid()=NULL; bảng bật
// RLS không policy nên anon bị chặn SELECT → Realtime không gửi event. Hàng đợi dùng
// polling thay thế (Queue.jsx, Dashboard.jsx, WaitEngineer.jsx).