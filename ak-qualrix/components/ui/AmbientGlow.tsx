'use client'

import { useEffect, useState } from 'react'

export function AmbientGlow() {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) return null

    return (
        <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-[#3A8DFF]/5 via-transparent to-[#3A8DFF]/5 opacity-50" />
            <div className="absolute inset-0 shadow-[inset_0_0_100px_rgba(58,141,255,0.15)] animate-pulse" />
            <style jsx global>{`
                @keyframes pulse-glow {
                    0%, 100% { box-shadow: inset 0 0 50px rgba(58,141,255,0.1); }
                    50% { box-shadow: inset 0 0 120px rgba(58,141,255,0.25); }
                }
                .animate-pulse-glow {
                    animation: pulse-glow 4s ease-in-out infinite;
                }
            `}</style>
            <div className="absolute inset-0 animate-pulse-glow pointer-events-none" />
        </div>
    )
}
