import { test, expect } from '@playwright/test'
import { loginViaUI } from './helpers/auth'

test.describe('Authentication Flow', () => {
    test('1. Login z poprawnymi danymi → dashboard /home', async ({ page }) => {
        await loginViaUI(page)

        // Powinniśmy być na /home
        await expect(page).toHaveURL(/\/home/)

        // Dashboard powinien zawierać nawigację (sidebar z linkami)
        await expect(page.locator('nav').first()).toBeVisible()
        await expect(page.locator('a[href="/home"]')).toBeVisible()
    })

    test('2. Po loginie widoczne kluczowe elementy nawigacji', async ({ page }) => {
        await loginViaUI(page)

        // Sprawdź podstawowe linki w sidebar
        await expect(page.locator('a[href="/home"]')).toBeVisible()
        await expect(page.locator('a[href="/messages"]')).toBeVisible()
    })

    test('3. Przejście na /messages po loginie działa', async ({ page }) => {
        await loginViaUI(page)

        await page.locator('a[href="/messages"]').click()
        await page.waitForURL(/\/messages/, { timeout: 15000 })
        await expect(page).toHaveURL(/\/messages/)

        // Nagłówek "Wiadomości" widoczny
        await expect(page.getByText('Wiadomości')).toBeVisible()
    })
})
