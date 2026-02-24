import { test, expect } from '@playwright/test'

// Render cold start może trwać 30-60s — dlatego pierwszy test "rozgrzewa" serwer
test.describe('Smoke Tests', () => {
    // Warmup: osobny test, który czeka na Render cold start
    test('0. Warmup: serwer Render odpowiada', async ({ page }) => {
        // Render cold start: daj do 90s na odpowiedź
        await page.goto('/login', { timeout: 90_000, waitUntil: 'networkidle' })
        await expect(page).toHaveURL(/\/(login|home)/)
    })

    test('1. Strona logowania ładuje się poprawnie', async ({ page }) => {
        await page.goto('/login', { waitUntil: 'networkidle' })
        await expect(page).toHaveTitle(/ComPass/i)

        // Logo i formularz widoczne
        await expect(page.locator('[data-testid="login-email"]')).toBeVisible({ timeout: 15_000 })
        await expect(page.locator('[data-testid="login-password"]')).toBeVisible()
        await expect(page.locator('[data-testid="login-submit"]')).toBeVisible()
    })

    test('2. Auth guard: /home bez logowania → redirect do /login', async ({ page }) => {
        await page.goto('/home', { waitUntil: 'networkidle' })
        await page.waitForURL(/\/login/, { timeout: 30_000 })
        await expect(page).toHaveURL(/\/login/)
    })

    test('3. Auth guard: /messages bez logowania → redirect do /login', async ({ page }) => {
        await page.goto('/messages', { waitUntil: 'networkidle' })
        await page.waitForURL(/\/login/, { timeout: 30_000 })
        await expect(page).toHaveURL(/\/login/)
    })

    test('4. Auth guard: /admin/settings bez logowania → redirect do /login', async ({ page }) => {
        await page.goto('/admin/settings', { waitUntil: 'networkidle' })
        await page.waitForURL(/\/login/, { timeout: 30_000 })
        await expect(page).toHaveURL(/\/login/)
    })

    test('5. Strona /login wyświetla błąd przy złych danych', async ({ page }) => {
        await page.goto('/login', { waitUntil: 'networkidle' })
        await page.locator('[data-testid="login-email"]').fill('nieistnieje@test.pl')
        await page.locator('[data-testid="login-password"]').fill('zlehaslo123')
        await page.locator('[data-testid="login-submit"]').click()

        // Powinien pojawić się komunikat o błędzie
        await expect(page.locator('[data-testid="login-error"]')).toBeVisible({ timeout: 15_000 })
    })
})
