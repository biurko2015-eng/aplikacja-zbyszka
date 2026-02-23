import { test, expect } from '@playwright/test'

/**
 * Testy RLS policies — weryfikacja bezpośrednio na Supabase API.
 * Sprawdzają, czy polityki bezpieczeństwa na tabelach bazy danych
 * są poprawnie skonfigurowane po każdym deploymencie.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://txzflesacqvlyhxwfjxk.supabase.co'
const ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4emZsZXNhY3F2bHloeHdmanhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1NTI1NjMsImV4cCI6MjA4NjEyODU2M30.kNdYiSuhqKQusnBurIhKVfwF5LmIiJ0iZO-u78Qy_vo'

async function getAuthToken(): Promise<string> {
    const email = process.env.TEST_USER_EMAIL || 'zbigniew.twardowski@b2bnetwork.pl'
    const password = process.env.TEST_USER_PASSWORD || 'ComPass2026!Admin'

    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    })

    if (!response.ok) throw new Error(`Auth failed: ${response.status}`)
    const data = await response.json()
    return data.access_token
}

async function supabaseQuery(token: string, table: string, method: string = 'GET', body?: object, extra?: string) {
    const url = `${SUPABASE_URL}/rest/v1/${table}${extra || ''}`
    const headers: Record<string, string> = {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal',
    }

    const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    })

    return {
        status: response.status,
        data: response.status !== 204 ? await response.json().catch(() => null) : null,
        ok: response.ok,
    }
}

test.describe('RLS Policy Verification', () => {
    let token: string

    test.beforeAll(async () => {
        token = await getAuthToken()
    })

    // --- PROFILES ---
    test('profiles: authenticated user can SELECT own profile', async () => {
        const result = await supabaseQuery(token, 'profiles', 'GET', undefined, '?select=id,email,role&limit=1')
        expect(result.ok).toBe(true)
        expect(result.data).toBeTruthy()
        expect(Array.isArray(result.data)).toBe(true)
        expect(result.data.length).toBeGreaterThan(0)
    })

    // --- CONVERSATIONS ---
    test('conversations: authenticated user can SELECT conversations', async () => {
        const result = await supabaseQuery(token, 'conversations', 'GET', undefined, '?select=id,type&limit=5')
        expect(result.ok).toBe(true)
        expect(Array.isArray(result.data)).toBe(true)
    })

    test('conversations: authenticated user can INSERT (create conversation)', async () => {
        const result = await supabaseQuery(token, 'conversations', 'POST', {
            type: 'direct',
        })
        // Should succeed (201) or conflict — NOT 403/RLS error
        expect([201, 409]).toContain(result.status)

        // Cleanup: delete the test conversation if created
        if (result.status === 201 && result.data?.[0]?.id) {
            await supabaseQuery(token, 'conversations', 'DELETE', undefined, `?id=eq.${result.data[0].id}`)
        }
    })

    // --- CONVERSATION PARTICIPANTS ---
    test('conversation_participants: authenticated user can SELECT own participations', async () => {
        const result = await supabaseQuery(token, 'conversation_participants', 'GET', undefined, '?select=conversation_id,user_id,role&limit=5')
        expect(result.ok).toBe(true)
        expect(Array.isArray(result.data)).toBe(true)
    })

    // --- MESSAGES ---
    test('messages: authenticated user can SELECT messages from own conversations', async () => {
        const result = await supabaseQuery(token, 'messages', 'GET', undefined, '?select=id,content,conversation_id&limit=5')
        expect(result.ok).toBe(true)
        expect(Array.isArray(result.data)).toBe(true)
    })

    // --- RPC FUNCTIONS ---
    test('RPC: create_direct_conversation function is callable', async () => {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/create_direct_conversation`, {
            method: 'POST',
            headers: {
                'apikey': ANON_KEY,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                p_user_id: '00000000-0000-0000-0000-000000000000',
                p_target_user_id: '00000000-0000-0000-0000-000000000001',
            }),
        })

        // Should be 200 or error FK constraint — NOT 404 (function not found)
        expect(response.status).not.toBe(404)
    })

    // --- ANON ACCESS (negative tests) ---
    test('anon: unauthenticated user CANNOT select profiles', async () => {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id,email&limit=1`, {
            headers: { 'apikey': ANON_KEY },
        })
        const data = await response.json()
        // Should return empty array (RLS blocks) or 401
        if (response.ok) {
            expect(data).toEqual([])
        }
    })

    test('anon: unauthenticated user CANNOT insert conversations', async () => {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/conversations`, {
            method: 'POST',
            headers: {
                'apikey': ANON_KEY,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal',
            },
            body: JSON.stringify({ type: 'direct' }),
        })
        // Should be 401 or RLS violation (403)
        expect([401, 403]).toContain(response.status)
    })

    // --- RATE LIMIT CHECK ---
    test('auth: signup rate limit returns proper error (not generic 500)', async () => {
        const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
            method: 'POST',
            headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: `ratelimit-test-${Date.now()}@b2bnetwork.pl`,
                password: 'TestPassword123!',
            }),
        })

        // 200 (success) or 429 (rate limited) or 422 (validation) — NOT 500
        expect(response.status).not.toBe(500)
    })
})
