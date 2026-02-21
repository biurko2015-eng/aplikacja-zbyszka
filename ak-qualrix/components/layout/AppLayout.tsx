import { Sidebar } from './Sidebar'
import { MobileMenu } from './MobileMenu'
import { TopBar } from './TopBar'
import { LanguageProvider } from '@/lib/i18n/context'
import { Logo } from '@/components/common/Logo'
import { PermissionsProvider } from '@/lib/hooks/usePermissions'
import type { PermissionFeature, PermissionValue } from '@/lib/types/permissions'

interface AppLayoutProps {
    children: React.ReactNode
    user: any
    role: 'consultant' | 'admin' | 'centrala' | 'administrator'
    permissions?: Record<PermissionFeature, PermissionValue>
}

export function AppLayout({ children, user, role, permissions }: AppLayoutProps) {
    return (
        <LanguageProvider>
            <PermissionsProvider permissions={permissions ?? null} role={role}>
                <div className="flex min-h-screen bg-background">
                    {/* Sidebar - Hidden on Mobile */}
                    <Sidebar role={role} user={user} permissions={permissions} />

                    <div className="flex flex-1 flex-col">
                        {/* TopBar - Visible on all, handles its own responsiveness */}
                        <TopBar user={user} />

                        {/* Main Content */}
                        <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 overflow-y-auto">
                            {children}
                        </main>

                        {/* Footer */}
                        <footer className="border-t border-border p-6 bg-background/40">
                            <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
                                <div className="flex items-center gap-2">
                                    <Logo size="sm" variant="monochrome" showText={false} />
                                    <span>© {new Date().getFullYear()} APK Compass. All rights reserved.</span>
                                </div>
                                <div className="flex gap-4">
                                    <a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a>
                                    <a href="#" className="hover:text-foreground transition-colors">Terms of Service</a>
                                    <a href="#" className="hover:text-foreground transition-colors">Support</a>
                                </div>
                            </div>
                        </footer>
                    </div>

                    {/* Mobile Menu - Visible only on Mobile */}
                    <MobileMenu role={role} user={null} />
                </div>
            </PermissionsProvider>
        </LanguageProvider>
    )
}
