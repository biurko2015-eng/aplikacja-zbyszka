'use client'

import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'

export default function GlobalError({
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    return (
        <html>
            <body>
                <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background p-4">
                    <div className="flex flex-col items-center gap-2 text-center">
                        <div className="rounded-full bg-destructive/10 p-4">
                            <AlertCircle className="h-8 w-8 text-destructive" />
                        </div>
                        <h2 className="text-2xl font-bold tracking-tight">Krytyczny błąd systemu</h2>
                        <p className="text-muted-foreground">
                            Wystąpił błąd, którego nie można obsłużyć.
                        </p>
                    </div>
                    <Button onClick={() => reset()} variant="default">
                        Spróbuj ponownie
                    </Button>
                </div>
            </body>
        </html>
    )
}
