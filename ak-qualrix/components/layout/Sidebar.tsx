'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n/context'
import {
    LayoutDashboard,
    Briefcase,
    FileText,
    Users,
    Settings,
    Building2,
    BookOpen,
    Box,
    Trophy,
    Rocket,
    MessageCircle,
} from 'lucide-react'
import { Logo } from '@/components/common/Logo'
import type { PermissionFeature, PermissionValue } from '@/lib/types/permissions'

interface SidebarProps {
    role: 'consultant' | 'admin' | 'centrala' | 'administrator'
    isOpen?: boolean
    setIsOpen?: (isOpen: boolean) => void
    user: {
        email?: string | null
        full_name?: string | null
        avatar_url?: string | null
    } | null
    permissions?: Record<PermissionFeature, PermissionValue>
}

// Map each sidebar link to its permission feature key
const LINK_PERMISSION_MAP: Record<string, PermissionFeature> = {
    '/home': 'dashboard',
    '/centrala': 'service_hub',
    '/admin/centrala': 'service_hub',
    '/messages': 'messages',
    '/projects': 'projects',
    '/admin/projects': 'projects',
    '/loyalty': 'loyalty',
    '/documents': 'documents',
    '/development': 'development',
    '/admin/candidates': 'candidates',
    '/admin/referrals': 'referrals',
    '/admin/import': 'import',
    '/admin/settings': 'settings',
}

export function Sidebar({ role, user, permissions }: SidebarProps) {
    const pathname = usePathname()
    const { t } = useTranslation()

    const consultantLinks = [
        { name: 'Mój Panel', href: '/home', icon: LayoutDashboard },
        { name: 'Service Hub', href: '/centrala', icon: Box },
        { name: 'Wiadomości', href: '/messages', icon: MessageCircle },
        { name: t('projects'), href: '/projects', icon: Briefcase },
        { name: 'Program lojalnościowy', href: '/loyalty', icon: Trophy },
        { name: t('documents'), href: '/documents', icon: FileText },
        { name: 'Strefa Rozwoju', href: '/development', icon: BookOpen },
        { name: 'Ustawienia', href: '/more', icon: Settings },
    ]

    const adminLinks = [
        { name: 'Mój Panel', href: '/home', icon: LayoutDashboard },
        { name: 'Service Hub', href: '/admin/centrala', icon: Building2 },
        { name: 'Wiadomości', href: '/messages', icon: MessageCircle },
        { name: 'Konsultanci', href: '/admin/candidates', icon: Users },
        { name: t('projects'), href: '/admin/projects', icon: Briefcase },
        { name: t('referrals'), href: '/admin/referrals', icon: Users },
        { name: 'Import', href: '/admin/import', icon: FileText },
        { name: 'Program lojalnościowy', href: '/loyalty', icon: Trophy },
        { name: 'Strefa Rozwoju', href: '/development', icon: Rocket },
        { name: t('settings'), href: '/admin/settings', icon: Settings },
    ]

    const baseLinks = (role === 'admin' || role === 'centrala' || role === 'administrator') ? adminLinks : consultantLinks

    // Filter links based on permissions
    // Administrators always see everything, no filtering applied
    const isAdmin = role === 'administrator' || role === 'admin'
    const links = isAdmin ? baseLinks : baseLinks.filter(link => {
        const featureKey = LINK_PERMISSION_MAP[link.href]
        if (!featureKey) return true // No mapping = always show
        if (!permissions) return true // No permissions loaded = show all (fallback)
        const value = permissions[featureKey]
        // Show link unless permission is explicitly 'false'
        return value !== 'false'
    })

    return (
        <div className="hidden border-r bg-[#160E15] md:block md:w-64 lg:w-72 h-screen sticky top-0 left-0 overflow-y-auto">
            <div className="flex h-20 items-center px-6 border-b border-white/10 gap-3">
                <Logo size="md" />
            </div>
            <nav className="flex flex-col gap-1 p-4">
                {links.map((link) => {
                    const Icon = link.icon
                    const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`)

                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={cn(
                                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all hover:text-primary",
                                isActive
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:bg-muted"
                            )}
                        >
                            <Icon className="h-4 w-4" />
                            {link.name}
                        </Link>
                    )
                })}
            </nav>
            <div className="p-4 border-t border-white/10 text-xs text-center text-muted-foreground/50">
                ComPass by Inframinds
            </div>
        </div>
    )
}
