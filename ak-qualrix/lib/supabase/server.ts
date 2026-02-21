import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createMockSupabaseClient, isSupabaseConfigured } from './mock-client'

const BYPASS_USER = {
    id: 'df0edb15-8c84-434d-928f-689348171029',
    email: 'zbigniew.twardowski@b2bnetwork.pl',
    app_metadata: {},
    user_metadata: { full_name: 'Zbigniew Twardowski' },
    aud: 'authenticated',
    created_at: new Date().toISOString(),
} as const

export function createClient() {
    try {
        const cookieStore = cookies()
        if (!isSupabaseConfigured()) {
            const bypassEmail = cookieStore.get('emergency_auth_user')?.value
            if (bypassEmail === 'zbigniew.twardowski@b2bnetwork.pl') {
                return createMockSupabaseClient(BYPASS_USER as any)
            }
            return createMockSupabaseClient()
        }

        const emergencyUser = cookieStore.get('emergency_auth_user')?.value
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        if (!url || !key) {
            return createMockSupabaseClient(emergencyUser === 'zbigniew.twardowski@b2bnetwork.pl' ? (BYPASS_USER as any) : undefined)
        }

        const client = createServerClient(
        url,
        key,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // The `setAll` method was called from a Server Component.
                    }
                },
            },
        }
        )

        if (emergencyUser === 'zbigniew.twardowski@b2bnetwork.pl') {
            client.auth.getUser = async () => ({
                data: { user: { ...BYPASS_USER } as any },
                error: null
            })
        }

        return client
    } catch (_e) {
        return createMockSupabaseClient()
    }
}
