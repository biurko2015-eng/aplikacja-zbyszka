import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
import { AppLayout } from '@/components/layout/AppLayout'
import { LayoutPreferencesProvider } from '@/lib/contexts/LayoutPreferencesContext'
import { AIAssistantPreferencesProvider } from '@/lib/contexts/AIAssistantPreferencesContext'
import { ThemeProvider } from '@/lib/contexts/ThemeContext'
import { getPermissions } from '@/lib/actions/permissions'
import type { PermissionRole } from '@/lib/types/permissions'
import { isSuperAdmin } from '@/lib/auth/super-admins'
import nextDynamic from 'next/dynamic'

const InternalCommunicator = nextDynamic(() => import('@/components/communicator/InternalCommunicator').then(m => m.InternalCommunicator), { ssr: false })
const AIAssistantWidget = nextDynamic(() => import('@/components/ai-assistant/AIAssistantWidget').then(m => m.AIAssistantWidget), { ssr: false })
const ScreenGlowEffect = nextDynamic(() => import('@/components/ui/ScreenGlowEffect').then(m => m.ScreenGlowEffect), { ssr: false })

export default async function ProtectedLayout({
    children,
}: {
    children: React.ReactNode
}) {
    try {
        const supabase = createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            redirect('/login')
        }

        let profile: { full_name?: string | null; avatar_url?: string | null; role?: string; bio?: string | null } | null = null
        let permissionsMap: Record<string, Record<string, string>> = {}
        try {
            const [profileRes, perms] = await Promise.all([
                supabase.from('profiles').select('id, full_name, avatar_url, email, bio, role, cv_url, gdpr_consent').eq('id', user.id).single(),
                getPermissions(),
            ])
            profile = (profileRes as { data?: typeof profile } | undefined)?.data ?? null
            permissionsMap = perms ?? {}
        } catch {
            const { DEFAULT_PERMISSIONS } = await import('@/lib/types/permissions')
            permissionsMap = DEFAULT_PERMISSIONS
        }

        const baseRole = (profile?.role as 'consultant' | 'admin' | 'centrala' | 'administrator') || 'consultant'
        const role = isSuperAdmin(user.email) ? 'administrator' : baseRole

        if (role === 'centrala' || role === 'administrator' || role === 'admin') {
            try {
                const mfaVerified = (await import('next/headers')).cookies().get('mfa_verified')?.value === 'true'
                if (!mfaVerified) redirect('/login')
            } catch {
                redirect('/login')
            }
        }

        let permissionRole: PermissionRole = 'consultant'
        if (role === 'centrala') {
            const { data: accessEntry } = await supabase.from('centrala_access_list').select('centrala_role').eq('email', user.email!).maybeSingle()
            permissionRole = (accessEntry?.centrala_role as PermissionRole) || 'recruiter'
        } else if (role === 'administrator' || role === 'admin') {
            permissionRole = 'recruiter'
        }

        const userPermissions = permissionsMap[permissionRole]
        const userData = {
            ...user,
            full_name: profile?.full_name || (user as { user_metadata?: { full_name?: string } }).user_metadata?.full_name,
            avatar_url: profile?.avatar_url,
            email: user.email,
            bio: profile?.bio,
        }

        return (
            <ThemeProvider>
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
            </ThemeProvider>
        )
    } catch (e) {
        const err = e as { digest?: string }
        if (err?.digest !== 'NEXT_REDIRECT') {
            console.error('[ProtectedLayout]', e)
        }
        redirect('/login')
    }
}
