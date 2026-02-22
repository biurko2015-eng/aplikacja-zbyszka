'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    const [showDetails, setShowDetails] = useState(false)

    useEffect(() => {
        console.error('[Error boundary]', error)
    }, [error])

    return (
        <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4 p-4">
            <div className="flex flex-col items-center gap-2 text-center">
                <div className="rounded-full bg-destructive/10 p-4">
                    <AlertCircle className="h-8 w-8 text-destructive" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">Coś poszło nie tak!</h2>
                <p className="text-muted-foreground">
                    Wystąpił błąd podczas ładowania tej strony. Spróbuj odświeżyć.
                </p>
                {(process.env.NODE_ENV === 'development' || error.message) && (
                    <>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2 text-muted-foreground"
                            onClick={() => setShowDetails(!showDetails)}
                        >
                            {showDetails ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                            Szczegóły błędu
                        </Button>
                        {showDetails && (
                            <div className="mt-2 p-4 bg-slate-950 rounded-lg border border-red-500/20 text-left w-full max-w-lg overflow-auto">
                                <code className="text-xs text-red-400 font-mono break-all">
                                    {error.message}
                                </code>
                                {error.digest && (
                                    <p className="text-xs text-muted-foreground mt-2">Digest: {error.digest}</p>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
            <Button onClick={() => reset()} variant="default">
                Spróbuj ponownie
            </Button>
        </div>
    )
}
