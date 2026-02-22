'use client'

import React, { useState, useMemo } from 'react'
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import type { ConsultantAnalysis } from '@/lib/actions/admin-dashboard'

interface ConsultantAnalysisTabProps {
    consultants: ConsultantAnalysis[]
}

function getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    'active': { label: 'Na projekcie', color: 'text-primary', bg: 'bg-burgundy/20 border-burgundy/30' },
    'on_project': { label: 'Na projekcie', color: 'text-primary', bg: 'bg-burgundy/20 border-burgundy/30' },
    'bench': { label: 'Bench', color: 'text-amber-400', bg: 'bg-amber-500/20 border-amber-500/30' },
    'available': { label: 'Bench', color: 'text-amber-400', bg: 'bg-amber-500/20 border-amber-500/30' },
    'recruitment': { label: 'Rekrutacja', color: 'text-foreground', bg: 'bg-foreground/20 border-foreground/30' },
    'inactive': { label: 'Nieaktywny', color: 'text-muted-foreground', bg: 'bg-muted-foreground/20 border-muted-foreground/30' },
}

const tierConfig: Record<string, { label: string; color: string; bg: string }> = {
    'bronze': { label: 'Bronze', color: 'text-amber-600', bg: 'bg-amber-900/20 border-amber-600/30' },
    'silver': { label: 'Silver', color: 'text-foreground', bg: 'bg-muted-foreground/20 border-foreground/30' },
    'gold': { label: 'Gold', color: 'text-yellow-400', bg: 'bg-yellow-500/20 border-yellow-400/30' },
    'platinum': { label: 'Platinum', color: 'text-foreground', bg: 'bg-foreground/20 border-foreground/30' },
}

type FilterType = 'all' | 'on_project' | 'bench' | 'recruitment'

export function ConsultantAnalysisTab({ consultants }: ConsultantAnalysisTabProps) {
    const [filter, setFilter] = useState<FilterType>('all')
    const [searchQuery, setSearchQuery] = useState('')

    const counts = useMemo(() => ({
        all: consultants.length,
        on_project: consultants.filter(c => c.current_status === 'active' || c.current_status === 'on_project').length,
        bench: consultants.filter(c => c.current_status === 'bench' || c.current_status === 'available' || !c.current_status).length,
        recruitment: consultants.filter(c => c.current_status === 'recruitment').length,
    }), [consultants])

    const filtered = useMemo(() => {
        let list = [...consultants]

        if (filter === 'on_project') {
            list = list.filter(c => c.current_status === 'active' || c.current_status === 'on_project')
        } else if (filter === 'bench') {
            list = list.filter(c => c.current_status === 'bench' || c.current_status === 'available' || !c.current_status)
        } else if (filter === 'recruitment') {
            list = list.filter(c => c.current_status === 'recruitment')
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase()
            list = list.filter(c =>
                c.full_name.toLowerCase().includes(q) ||
                c.email.toLowerCase().includes(q) ||
                (c.tech_stack && c.tech_stack.toLowerCase().includes(q)) ||
                (c.recruiter_name && c.recruiter_name.toLowerCase().includes(q)) ||
                (c.dl_name && c.dl_name.toLowerCase().includes(q))
            )
        }

        return list
    }, [consultants, filter, searchQuery])

    const filters: { id: FilterType; label: string; count: number; color: string }[] = [
        { id: 'all', label: 'Wszyscy', count: counts.all, color: 'text-white' },
        { id: 'on_project', label: 'Na projekcie', count: counts.on_project, color: 'text-primary' },
        { id: 'bench', label: 'Bench', count: counts.bench, color: 'text-amber-400' },
        { id: 'recruitment', label: 'Rekrutacja', count: counts.recruitment, color: 'text-foreground' },
    ]

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
                {filters.map(f => (
                    <button
                        key={f.id}
                        onClick={() => setFilter(f.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                            filter === f.id
                                ? 'bg-white/10 border-white/20 text-white'
                                : 'bg-transparent border-white/5 text-muted-foreground hover:border-white/10 hover:text-white'
                        }`}
                    >
                        <span className={f.color}>{f.label}</span>
                        <span className="ml-1.5 text-muted-foreground">({f.count})</span>
                    </button>
                ))}
                <div className="ml-auto">
                    <input
                        type="text"
                        placeholder="Szukaj konsultanta..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="px-3 py-1.5 rounded-lg text-xs bg-muted border border-white/10 text-white placeholder:text-muted-foreground focus:outline-none focus:border-burgundy/50 w-48"
                    />
                </div>
            </div>

            <Card className="bg-background/50 border-white/10 overflow-hidden">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/10">
                                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Konsultant</th>
                                    <th className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-3">Status</th>
                                    <th className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-3">Tier</th>
                                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-3">Projekt</th>
                                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-3">Rekruter</th>
                                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-3">Delivery Lead</th>
                                    <th className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-3">Bench (dni)</th>
                                    <th className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-3">Match</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.slice(0, 20).map((c) => {
                                    const status = statusConfig[c.current_status] || statusConfig['bench']
                                    const tier = tierConfig[c.loyalty_tier.toLowerCase()] || tierConfig['bronze']

                                    return (
                                        <tr key={c.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-8 w-8 border border-white/10">
                                                        <AvatarImage src={c.avatar_url || ''} />
                                                        <AvatarFallback className="bg-card text-foreground text-xs">
                                                            {getInitials(c.full_name)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="text-sm font-medium text-white">{c.full_name}</p>
                                                        {c.tech_stack && (
                                                            <p className="text-xs text-muted-foreground">{c.tech_stack}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 text-center">
                                                <Badge variant="outline" className={`text-xs ${status.bg} ${status.color}`}>
                                                    {status.label}
                                                </Badge>
                                            </td>
                                            <td className="px-3 py-3 text-center">
                                                <Badge variant="outline" className={`text-xs ${tier.bg} ${tier.color}`}>
                                                    {tier.label}
                                                </Badge>
                                            </td>
                                            <td className="px-3 py-3">
                                                <span className={`text-sm ${c.project_name ? 'text-white' : 'text-muted-foreground italic'}`}>
                                                    {c.project_name || '—'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3">
                                                <span className={`text-sm ${c.recruiter_name ? 'text-white' : 'text-muted-foreground'}`}>
                                                    {c.recruiter_name || '—'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3">
                                                <span className={`text-sm ${c.dl_name ? 'text-white' : 'text-muted-foreground'}`}>
                                                    {c.dl_name || '—'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 text-center">
                                                {c.bench_days > 0 ? (
                                                    <span className={`text-sm font-medium ${
                                                        c.bench_days > 30 ? 'text-red-400' :
                                                        c.bench_days > 14 ? 'text-amber-400' : 'text-foreground'
                                                    }`}>
                                                        {c.bench_days}
                                                    </span>
                                                ) : (
                                                    <span className="text-sm text-muted-foreground">—</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-3 text-center">
                                                {c.match_score ? (
                                                    <MatchScoreBadge score={c.match_score} />
                                                ) : (
                                                    <span className="text-sm text-muted-foreground">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                    {filtered.length > 20 && (
                        <div className="px-4 py-3 text-center border-t border-white/5">
                            <p className="text-xs text-muted-foreground">
                                Wyświetlono 20 z {filtered.length} konsultantów
                            </p>
                        </div>
                    )}
                    {filtered.length === 0 && (
                        <div className="px-4 py-8 text-center">
                            <p className="text-sm text-muted-foreground">Brak konsultantów spełniających kryteria filtrowania</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

function MatchScoreBadge({ score }: { score: number }) {
    const size = 36
    const radius = (size - 5) / 2
    const circumference = 2 * Math.PI * radius
    const offset = circumference - (score / 100) * circumference
    const color = score >= 85 ? 'hsl(var(--primary))' : score >= 70 ? '#f59e0b' : '#ef4444'

    return (
        <div className="relative inline-flex" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="transform -rotate-90">
                <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#1e293b" strokeWidth={2.5} />
                <circle
                    cx={size/2} cy={size/2} r={radius} fill="none"
                    stroke={color} strokeWidth={2.5}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                {score}
            </span>
        </div>
    )
}
