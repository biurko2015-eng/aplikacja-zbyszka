import { test, expect } from '@playwright/test'

test.describe('Smoke Tests', () => {
    test('1. Strona logowania ładuje się poprawnie', async ({ page }) => {
        await page.goto('/login')
        await expect(page).toHaveTitle(/ComPass/i)

        // Logo i formularz widoczne
        await expect(page.locator('[data-testid="login-email"]')).toBeVisible()
        await expect(page.locator('[data-testid="login-password"]')).toBeVisible()
        await expect(page.locator('[data-testid="login-submit"]')).toBeVisible()
    })

    test('2. Auth guard: /home bez logowania → redirect do /login', async ({ page }) => {
        await page.goto('/home')
        await page.waitForURL(/\/login/, { timeout: 15000 })
        await expect(page).toHaveURL(/\/login/)
    })

    test('3. Auth guard: /messages bez logowania → redirect do /login', async ({ page }) => {
        await page.goto('/messages')
        await page.waitForURL(/\/login/, { timeout: 15000 })
        await expect(page).toHaveURL(/\/login/)
    })

    test('4. Auth guard: /admin/settings bez logowania → redirect do /login', async ({ page }) => {
        await page.goto('/admin/settings')
        await page.waitForURL(/\/login/, { timeout: 15000 })
        await expect(page).toHaveURL(/\/login/)
    })

    test('5. Strona /login wyświetla błąd przy złych danych', async ({ page }) => {
        await page.goto('/login')
        await page.locator('[data-testid="login-email"]').fill('nieistnieje@test.pl')
        await page.locator('[data-testid="login-password"]').fill('zlehaslo123')
        await page.locator('[data-testid="login-submit"]').click()

        // Powinien pojawić się komunikat o błędzie
        await expect(page.locator('[data-testid="login-error"]')).toBeVisible({ timeout: 15000 })
    })
})
