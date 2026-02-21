'use client'

import { AIAppearanceSettings } from '@/components/settings/AIAppearanceSettings'

export default function AppearanceSettingsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Personalizacja</h3>
                <p className="text-sm text-muted-foreground">
                    Dostosuj wygląd widgetu Asystenta AI. Ustawienia zapisywane lokalnie w przeglądarce.
                </p>
            </div>
            <AIAppearanceSettings />
        </div>
    )
}
