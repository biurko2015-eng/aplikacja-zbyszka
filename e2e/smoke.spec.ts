import { test, expect } from '@playwright/test'

test.describe('Smoke', () => {
  test('strona główna przekierowuje', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/(home|login)/)
  })

  test('strona logowania się ładuje', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveTitle(/Compass|Logowanie|Login/i)
    await expect(page.getByRole('textbox', { name: /e-mail|email/i }).or(page.getByPlaceholder(/e-mail|email/i))).toBeVisible({ timeout: 10000 })
  })

  test('strona /home wymaga auth lub pokazuje dashboard', async ({ page }) => {
    await page.goto('/home')
    await expect(page).toHaveURL(/\/(home|login)/)
  })
})
