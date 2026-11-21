import { test, expect } from '@playwright/test'

const submitBtn = page => page.getByRole('button', { name: /Đăng nhập/ }).last()

async function fillPins(page, digits) {
  const boxes = page.locator('input[type="password"]')
  await expect(boxes).toHaveCount(digits.length)
  for (let i = 0; i < digits.length; i++) await boxes.nth(i).fill(digits[i])
}

test.describe('Luồng đăng nhập (critical path)', () => {
  test('Nông dân cần đồng ý điều khoản khi đăng ký', async ({ page }) => {
    let registrations = 0
    await page.route('**/api/v1/auth/register-phone', route => {
      registrations++
      return route.fulfill({ json: {
        token: 'fake-jwt-farmer', user: { id: 'u1', role: 'farmer' }, isNewUser: true,
      } })
    })
    await page.goto('/login')
    await page.getByText('Nông dân').click()
    await page.getByRole('button', { name: 'Đăng ký', exact: true }).first().click()
    await page.getByRole('textbox', { name: 'Số điện thoại', exact: true }).fill('0987654321')
    await fillPins(page, '123456123456')
    const register = page.getByRole('button', { name: /Đăng ký/ }).last()
    await register.click()
    await expect(page.getByText(/Bạn cần đánh dấu đồng ý/)).toBeVisible()
    expect(registrations).toBe(0)

    await page.getByRole('checkbox').check()
    await register.click()
    await expect(page).toHaveURL(/\/profile\?onboard=true$/)
    expect(registrations).toBe(1)
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

    await page.getByRole('textbox', { name: 'Số điện thoại', exact: true }).fill('0987654321')
    await fillPins(page, '111111')

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

    await page.getByLabel('Email', { exact: true }).fill('engineer@test.com')
    await page.getByLabel('Mật khẩu', { exact: true }).fill('password123')

    await submitBtn(page).click()

    await expect(page).toHaveURL(/\/engineer\/queue$/)
    // Trang hàng đợi đã mount (nút Tải lại có aria-label cố định).
    await expect(page.getByRole('button', { name: 'Tải lại' })).toBeVisible()
  })
})
