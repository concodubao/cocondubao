import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// ─── Integration test chạm DB thật ───────────────────────────────────────────────
// ⚠️ AN TOÀN: test này INSERT/UPDATE/DELETE dữ liệu thật → KHÔNG được chạy trên DB
// production. Vì vậy nó CHỈ chạy khi có ĐỦ 3 điều kiện (nếu không → skip êm):
//   1. RUN_DB_INTEGRATION=1            (opt-in rõ ràng)
//   2. SUPABASE_TEST_URL              (DB test RIÊNG, khác SUPABASE_URL prod)
//   3. SUPABASE_TEST_SERVICE_KEY      (service key của DB test đó)
// Cố tình KHÔNG fallback về SUPABASE_URL/SUPABASE_SERVICE_KEY (đang trỏ prod) để
// `npm test` ở máy dev / CI không bao giờ ghi bậy vào prod.
//
// Chạy có chủ đích (PowerShell):
//   $env:RUN_DB_INTEGRATION='1'; $env:SUPABASE_TEST_URL='...'; $env:SUPABASE_TEST_SERVICE_KEY='...'; npm test -- integration

const TEST_URL = process.env.SUPABASE_TEST_URL;
const TEST_KEY = process.env.SUPABASE_TEST_SERVICE_KEY;
const ENABLED  = process.env.RUN_DB_INTEGRATION === '1' && !!TEST_URL && !!TEST_KEY;

// Chốt chặn cuối: nếu lỡ trỏ test vào đúng URL prod thì dừng, không chạy.
const POINTS_AT_PROD = TEST_URL && process.env.SUPABASE_URL && TEST_URL === process.env.SUPABASE_URL;

describe.skipIf(!ENABLED || POINTS_AT_PROD)('Database Integration Tests (DB test riêng)', () => {
  let supabase;

  beforeAll(() => {
    supabase = createClient(TEST_URL, TEST_KEY);
  });

  it('có thể kết nối và query bảng users', async () => {
    const { data, error } = await supabase.from('users').select('id').limit(1);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it('thực hiện luồng insert, update, và delete an toàn', async () => {
    // SĐT test có tiền tố rõ ràng để dễ nhận diện & dọn nếu sót.
    const testPhone = '+84900000000';

    // 1. Dọn dẹp nếu test trước fail chưa kịp xoá
    await supabase.from('users').delete().eq('phone', testPhone);

    // 2. Insert
    const { data: insertData, error: insertError } = await supabase
      .from('users')
      .insert({ phone: testPhone, role: 'farmer', name: 'Test DB Integration' })
      .select('id')
      .single();

    expect(insertError).toBeNull();
    expect(insertData).toHaveProperty('id');
    const newUserId = insertData.id;

    // 3. Update
    const { data: updateData, error: updateError } = await supabase
      .from('users')
      .update({ name: 'Test DB Integration Updated' })
      .eq('id', newUserId)
      .select('name')
      .single();

    expect(updateError).toBeNull();
    expect(updateData.name).toBe('Test DB Integration Updated');

    // 4. Delete (dọn sạch)
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', newUserId);

    expect(deleteError).toBeNull();
  });
});
