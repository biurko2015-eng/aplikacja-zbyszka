'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

export type ThemeId = 'inframinds' | 'qualrix' | 'b2bnetwork'

export interface ThemeConfig {
    id: ThemeId
    label: string
    brandName: string
    className: string
    preview: {
        bg: string
        primary: string
        card: string
    }
}

export const THEMES: Record<ThemeId, ThemeConfig> = {
    inframinds: {
        id: 'inframinds',
        label: 'Inframinds',
        brandName: 'Inframinds',
        className: '',
        preview: { bg: '#1D121B', primary: '#3A8DFF', card: '#241625' },
    },
    qualrix: {
        id: 'qualrix',
        label: 'Qualrix',
        brandName: 'Qualrix',
        className: 'theme-qualrix',
        preview: { bg: '#0A0A14', primary: '#10B981', card: '#101018' },
    },
    b2bnetwork: {
        id: 'b2bnetwork',
        label: 'B2BNETWORK',
        brandName: 'B2BNETWORK',
        className: 'theme-b2bnetwork',
        preview: { bg: '#0B1628', primary: '#0066CC', card: '#122240' },
    },
}

const STORAGE_KEY = 'compass-theme'
const THEME_IDS: ThemeId[] = ['inframinds', 'qualrix', 'b2bnetwork']

interface ThemeContextValue {
    theme: ThemeId
    themeConfig: ThemeConfig
    setTheme: (id: ThemeId) => void
    brandName: string
}

const ThemeContext = createContext<ThemeContextValue>({
    theme: 'inframinds',
    themeConfig: THEMES.inframinds,
    setTheme: () => {},
    brandName: 'Inframinds',
})

function applyThemeClass(themeId: ThemeId) {
    const root = document.documentElement
    THEME_IDS.forEach(id => {
        const cls = THEMES[id].className
        if (cls) root.classList.remove(cls)
    })
    const cls = THEMES[themeId].className
    if (cls) root.classList.add(cls)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<ThemeId>('inframinds')

    useEffect(() => {
        let localTheme: ThemeId | null = null
        try {
            const stored = localStorage.getItem(STORAGE_KEY) as ThemeId | null
            if (stored && THEMES[stored]) {
                localTheme = stored
                setThemeState(stored)
                applyThemeClass(stored)
            }
        } catch {}

        if (!localTheme) {
            ;(async () => {
                try {
                    const supabase = createClient()
                    const { data: { user } } = await supabase.auth.getUser()
                    if (user) {
                        const { data } = await supabase.from('profiles').select('theme').eq('id', user.id).single()
                        const dbTheme = data?.theme as ThemeId | null
                        if (dbTheme && THEMES[dbTheme]) {
                            setThemeState(dbTheme)
                            applyThemeClass(dbTheme)
                            try { localStorage.setItem(STORAGE_KEY, dbTheme) } catch {}
                        }
                    }
                } catch {}
            })()
        }
    }, [])

    const setTheme = useCallback((id: ThemeId) => {
        setThemeState(id)
        applyThemeClass(id)
        try { localStorage.setItem(STORAGE_KEY, id) } catch {}

        // Sync to Supabase in background
        ;(async () => {
            try {
                const supabase = createClient()
                const { data: { user } } = await supabase.auth.getUser()
                if (user) {
                    await supabase.from('profiles').update({ theme: id }).eq('id', user.id)
                }
            } catch {}
        })()
    }, [])

    const themeConfig = THEMES[theme]

    return (
        <ThemeContext.Provider value={{ theme, themeConfig, setTheme, brandName: themeConfig.brandName }}>
            {children}
        </ThemeContext.Provider>
    )
}

export function useTheme() {
    return useContext(ThemeContext)
}
