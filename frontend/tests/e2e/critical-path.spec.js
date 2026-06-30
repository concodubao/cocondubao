import { test, expect } from '@playwright/test'

// E2E luồng đăng nhập — viết theo ĐÚNG code thật (Login.jsx + App.jsx routes + api.js).
// Tất cả API đều được mock (page.route) nên test KHÔNG cần backend chạy thật.
//
// Lưu ý khớp với UI thật:
//  - Vai trò: nút "Nông dân" / "Kỹ sư / Admin".
//  - Nông dân: ô SĐT placeholder "Nhập số điện thoại"; PIN = 6 ô input[type=password] (DigitBoxes mask).
//  - PHẢI tick checkbox đồng ý (#consent) thì nút "Đăng nhập" mới bật (disabled || !agreed).
//  - Đăng nhập thành công điều hướng bằng window.location.href: nông dân → /home, kỹ sư → /engineer/queue.
//  - Endpoint thật: POST /auth/login-phone, POST /auth/login-email, GET /engineer/queue.

// Nút submit và tab cùng chữ "Đăng nhập" → submit luôn là phần tử cuối (.last()).
const submitBtn = (page) => page.getByRole('button', { name: /Đăng nhập/ }).last()

test.describe('Luồng đăng nhập (critical path)', () => {
  test('Checkbox đồng ý chặn nút đăng nhập tới khi tick (nông dân)', async ({ page }) => {
    await page.goto('/login')
    await page.getByText('Nông dân').click()

    // Chưa tick consent → nút Đăng nhập bị khoá
    await expect(submitBtn(page)).toBeDisabled()

    // Tick consent → nút mở
    await page.locator('#consent').check()
    await expect(submitBtn(page)).toBeEnabled()
  })

  test('Nông dân đăng nhập bằng SĐT + PIN → vào /home', async ({ page }) => {
    await page.route('**/api/v1/auth/login-phone', route =>
      route.fulfill({ json: {
        token: 'fake-jwt-farmer',
        user: { id: 'u1', role: 'farmer', name: 'Test Farmer', crops: ['rice'] },
        isNewUser: false,
      } }),
    )

    await page.goto('/login')
    await page.getByText('Nông dân').click()

    await page.getByPlaceholder('Nhập số điện thoại').fill('0987654321')
    const pinBoxes = page.locator('input[type="password"]')
    for (let i = 0; i < 6; i++) await pinBoxes.nth(i).fill('1')

    await page.locator('#consent').check()
    await submitBtn(page).click()

    // Điều hướng sang trang chủ nông dân
    await expect(page).toHaveURL(/\/home$/)
  })

  test('Kỹ sư đăng nhập bằng email → vào hàng đợi /engineer/queue', async ({ page }) => {
    await page.route('**/api/v1/auth/login-email', route =>
      route.fulfill({ json: {
        token: 'fake-jwt-eng',
        user: { id: 'u2', role: 'engineer', name: 'Test Engineer' },
        isNewUser: false,
      } }),
    )
    // Queue tải danh sách khi mount — mock rỗng để trang lên ổn định, không phụ thuộc shape item.
    await page.route('**/api/v1/engineer/queue**', route =>
      route.fulfill({ json: { queue: [] } }),
    )

    await page.goto('/login')
    await page.getByText('Kỹ sư / Admin').click()

    await page.getByPlaceholder('email@example.com').fill('engineer@test.com')
    await page.getByPlaceholder('••••••••').fill('password123')

    await page.locator('#consent').check()
    await submitBtn(page).click()

    await expect(page).toHaveURL(/\/engineer\/queue$/)
    // Trang hàng đợi đã mount (nút Tải lại có aria-label cố định).
    await expect(page.getByRole('button', { name: 'Tải lại' })).toBeVisible()
  })
})
