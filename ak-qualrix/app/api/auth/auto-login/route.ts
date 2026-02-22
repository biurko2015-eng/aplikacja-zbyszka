import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
    const cookieStore = cookies()

    // 1. Clear bypass cookies
    cookieStore.delete('emergency_auth_user')
    cookieStore.delete('mfa_verified')

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!url || !key) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    // 2. Create Supabase client with cookie support
    const response = NextResponse.redirect(new URL('/home', process.env.NEXT_PUBLIC_SITE_URL || 'https://compass-14fg.onrender.com'))

    const supabase = createServerClient(url, key, {
        cookies: {
            getAll() {
                return cookieStore.getAll()
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value, options }) => {
                    response.cookies.set(name, value, options)
                })
            },
        },
    })

    // 3. Sign in with real credentials
    const { data, error } = await supabase.auth.signInWithPassword({
        email: 'zbigniew.twardowski@b2bnetwork.pl',
        password: 'Password123!',
    })

    if (error) {
        return NextResponse.json({
            error: error.message,
            hint: 'Haslo moglo zostac zmienione. Zaloguj sie recznie na /login.',
        }, { status: 401 })
    }

    // 4. Set onboarding cookie for admin
    response.cookies.set('onboarding_done', 'true', {
        httpOnly: true,
        secure: true,
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
    })
    response.cookies.set('mfa_verified', 'true', {
        httpOnly: true,
        secure: true,
        path: '/',
        maxAge: 60 * 60 * 24,
    })

    return response
}
