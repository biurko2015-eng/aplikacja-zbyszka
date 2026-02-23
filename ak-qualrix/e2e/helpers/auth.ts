import { Page, expect } from '@playwright/test'

/**
 * Loguje użytkownika przez UI (email + hasło).
 * Po logowaniu oczekuje przekierowania na /home.
 */
export async function loginViaUI(page: Page, email?: string, password?: string) {
    const userEmail = email || process.env.TEST_USER_EMAIL || 'zbigniew.twardowski@b2bnetwork.pl'
    const userPass = password || process.env.TEST_USER_PASSWORD || 'ComPass2026!Admin'

    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    // Wypełnij formularz logowania
    await page.locator('[data-testid="login-email"]').fill(userEmail)
    await page.locator('[data-testid="login-password"]').fill(userPass)
    await page.locator('[data-testid="login-submit"]').click()

    // Czekaj na MFA dialog lub redirect
    // Admin/centrala wymaga MFA — sprawdź czy pojawi się MFA input
    try {
        const mfaInput = page.locator('[data-testid="mfa-code"]')
        await mfaInput.waitFor({ state: 'visible', timeout: 5000 })

        // MFA required — wpisz kod (pin: 000000 for test/bypass)
        // W produkcji admin musi mieć prawdziwy TOTP
        // Na razie czekamy na redirect bez MFA (konto testowe)
        console.log('MFA detected — may need manual handling')
    } catch {
        // No MFA — login should redirect to /home
    }

    // Poczekaj na dashboard
    await page.waitForURL(/\/(home|admin)/, { timeout: 30000 })
}

/**
 * Loguje przez Supabase API i ustawia cookies na stronie.
 * Szybsza alternatywa do loginViaUI.
 */
export async function loginViaAPI(page: Page) {
    const supabaseUrl = process.env.SUPABASE_URL || 'https://txzflesacqvlyhxwfjxk.supabase.co'
    const anonKey = process.env.SUPABASE_ANON_KEY || ''
    const email = process.env.TEST_USER_EMAIL || 'zbigniew.twardowski@b2bnetwork.pl'
    const password = process.env.TEST_USER_PASSWORD || 'ComPass2026!Admin'

    // Signup/login via Supabase REST API
    const response = await page.request.post(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        headers: {
            'apikey': anonKey,
            'Content-Type': 'application/json',
        },
        data: { email, password },
    })

    if (!response.ok()) {
        throw new Error(`Login API failed: ${response.status()} ${await response.text()}`)
    }

    const data = await response.json()
    const accessToken = data.access_token
    const refreshToken = data.refresh_token

    // Ustawienie cookies Supabase Auth na stronie
    await page.goto('/login')
    await page.evaluate(({ accessToken, refreshToken, supabaseUrl }) => {
        // Supabase SSR przechowuje sesję w cookies
        const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
        const cookieName = `sb-${projectRef}-auth-token`
        const session = JSON.stringify({
            access_token: accessToken,
            refresh_token: refreshToken,
            token_type: 'bearer',
        })
        document.cookie = `${cookieName}=${encodeURIComponent(session)}; path=/; max-age=3600; SameSite=Lax`
    }, { accessToken, refreshToken, supabaseUrl })

    // Nawiguj na stronę główną
    await page.goto('/home')
    await page.waitForLoadState('networkidle')
}
