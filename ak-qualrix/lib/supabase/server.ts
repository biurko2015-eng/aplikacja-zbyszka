import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
    const cookieStore = cookies()

    // --- EMERGENCY BYPASS FOR DEV ---
    const emergencyUser = cookieStore.get('emergency_auth_user')?.value
    const client = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
        // Mock the auth object for the bypass user
        const originalGetUser = client.auth.getUser.bind(client.auth)
        client.auth.getUser = async (token?: string) => {
            return {
                data: {
                    user: {
                        id: 'df0edb15-8c84-434d-928f-689348171029',
                        email: 'zbigniew.twardowski@b2bnetwork.pl',
                        app_metadata: {},
                        user_metadata: { full_name: 'Zbigniew Twardowski' },
                        aud: 'authenticated',
                        created_at: new Date().toISOString()
                    } as any
                },
                error: null
            }
        }
    }

    return client
}
