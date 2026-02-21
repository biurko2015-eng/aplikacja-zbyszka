import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { LayoutPreferencesProvider } from '@/lib/contexts/LayoutPreferencesContext'
import { AIAssistantPreferencesProvider } from '@/lib/contexts/AIAssistantPreferencesContext'
import { getPermissions } from '@/lib/actions/permissions'
import type { PermissionRole } from '@/lib/types/permissions'
import dynamic from 'next/dynamic'

const InternalCommunicator = dynamic(() => import('@/components/communicator/InternalCommunicator').then(m => m.InternalCommunicator), { ssr: false })
const AIAssistantWidget = dynamic(() => import('@/components/ai-assistant/AIAssistantWidget').then(m => m.AIAssistantWidget), { ssr: false })
const ScreenGlowEffect = dynamic(() => import('@/components/ui/ScreenGlowEffect').then(m => m.ScreenGlowEffect), { ssr: false })

export default async function ProtectedLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = createClient()

    // ─── STEP 1: Auth check (must run first) ──────────────────────────────────
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser()

    if (error || !user) {
        redirect('/login')
    }

    // ─── STEP 2: PARALLEL fetch — profile + permissions simultaneously ────────
    // PERF: Previously sequential (profile → wait → permissions → wait)
    //       Now parallel: saves ~150-300ms per page load
    const [{ data: profile }, permissionsMap] = await Promise.all([
        supabase
            .from('profiles')
            .select('id, full_name, avatar_url, email, bio, role, cv_url, gdpr_consent')
            .eq('id', user.id)
            .single(),
        getPermissions(),
    ])

    const role = (profile?.role as 'consultant' | 'admin' | 'centrala' | 'administrator') || 'consultant'

    // ─── MFA CHECK (elevated roles only) ──────────────────────────────────────
    if (role === 'centrala' || role === 'administrator' || role === 'admin') {
        const { cookies } = await import('next/headers')
        const cookieStore = cookies()
        const mfaVerified = cookieStore.get('mfa_verified')?.value === 'true'

        if (!mfaVerified) {
            redirect('/login')
        }
    }

    // ─── STEP 3: Permission role resolution ───────────────────────────────────
    let permissionRole: PermissionRole = 'consultant'
    if (role === 'centrala') {
        const { data: accessEntry } = await supabase
            .from('centrala_access_list')
            .select('centrala_role')
            .eq('email', user.email!)
            .maybeSingle()
        permissionRole = (accessEntry?.centrala_role as PermissionRole) || 'recruiter'
    } else if (role === 'administrator' || role === 'admin') {
        permissionRole = 'recruiter'
    }

    const userPermissions = permissionsMap[permissionRole]

    // ─── Build user data for UI ───────────────────────────────────────────────
    const userData = {
        ...user,
        full_name: profile?.full_name || user.user_metadata?.full_name,
        avatar_url: profile?.avatar_url,
        email: user.email,
        bio: profile?.bio,
    }

    return (
        <AIAssistantPreferencesProvider>
            <AppLayout user={userData} role={role} permissions={userPermissions}>
                <LayoutPreferencesProvider>
                    {children}
                </LayoutPreferencesProvider>
                <AIAssistantWidget />
                <InternalCommunicator currentUser={userData} />
                <ScreenGlowEffect />
            </AppLayout>
        </AIAssistantPreferencesProvider>
    )
}
