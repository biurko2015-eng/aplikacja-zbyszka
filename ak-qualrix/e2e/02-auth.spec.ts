import { test, expect } from '@playwright/test'
import { loginViaUI } from './helpers/auth'

test.describe('Authentication Flow', () => {
    test('1. Login z poprawnymi danymi → dashboard /home', async ({ page }) => {
        await loginViaUI(page)

        // Powinniśmy być na /home
        await expect(page).toHaveURL(/\/home/)

        // Dashboard powinien zawierać nawigację
        await expect(page.locator('[data-testid="sidebar-nav"]')).toBeVisible()
        await expect(page.locator('[data-testid="nav-home"]')).toBeVisible()
    })

    test('2. Po loginie widoczne kluczowe elementy nawigacji', async ({ page }) => {
        await loginViaUI(page)

        // Sprawdź podstawowe linki w sidebar
        await expect(page.locator('[data-testid="nav-home"]')).toBeVisible()
        await expect(page.locator('[data-testid="nav-messages"]')).toBeVisible()
    })

    test('3. Przejście na /messages po loginie działa', async ({ page }) => {
        await loginViaUI(page)

        await page.locator('[data-testid="nav-messages"]').click()
        await page.waitForURL(/\/messages/, { timeout: 15000 })
        await expect(page).toHaveURL(/\/messages/)

        // Nagłówek "Wiadomości" widoczny
        await expect(page.getByText('Wiadomości')).toBeVisible()
    })
})
