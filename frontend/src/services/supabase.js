import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// Realtime subscription cho engineer (dùng ở màn E-01)
export function subscribeEngineerQueue(callback) {
  return supabase
    .channel('engineer_queue')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'engineer_queue'
    }, callback)
    .subscribe()
}