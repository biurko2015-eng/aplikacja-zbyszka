'use client'

import { useTheme, THEMES, type ThemeId } from '@/lib/contexts/ThemeContext'

export function ThemeQuickPicker() {
    const { theme, setTheme } = useTheme()
    const themeList = Object.values(THEMES)

    return (
        <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground mr-1">Motyw:</span>
            {themeList.map((t) => {
                const active = theme === t.id
                return (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => setTheme(t.id)}
                        title={t.label}
                        className={`
                            w-7 h-7 rounded-full transition-all duration-200 flex items-center justify-center
                            ${active
                                ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-110'
                                : 'hover:scale-110 opacity-70 hover:opacity-100'
                            }
                        `}
                        style={{ backgroundColor: t.preview.primary }}
                    >
                        {active && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                    </button>
                )
            })}
        </div>
    )
}
