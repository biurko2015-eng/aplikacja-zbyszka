'use server'

import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'mock-key',
})

interface MarketRate {
    id: string
    position_title: string
    category: string | null
    seniority: string | null
    rate_min: number
    rate_median: number | null
    rate_max: number
    currency: string
    rate_type: string
    source: string | null
    region: string | null
}

interface RateVerification {
    id: string
    position_title: string
    profile_description: string | null
    expected_rate: number
    currency: string
    rate_type: string
    market_rate_min: number | null
    market_rate_max: number | null
    market_rate_median: number | null
    market_sources: string[] | null
    compass_rate_min: number | null
    compass_rate_max: number | null
    compass_rate_avg: number | null
    compass_sample_size: number
    verdict: 'below_market' | 'within_market' | 'above_market' | null
    notes: string | null
    created_at: string
    verified_by: string
}

interface VerifyRateInput {
    position_title: string
    profile_description?: string
    expected_rate: number
    rate_type: 'hourly' | 'monthly'
    currency?: string
}

interface VerifyRateResult {
    market: {
        min: number | null
        median: number | null
        max: number | null
        sources: string[]
        count: number
    }
    compass: {
        min: number | null
        avg: number | null
        max: number | null
        sample_size: number
    }
    verdict: 'below_market' | 'within_market' | 'above_market'
    expected_rate: number
    rate_type: string
    summary: string
}

async function requireCentralaOrAdmin() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!['administrator', 'admin', 'centrala'].includes(profile?.role || '')) {
        throw new Error('Brak dostępu do modułu Stawki')
    }

    return { supabase, user, role: profile?.role || '' }
}

async function requireAdmin() {
    const { supabase, user, role } = await requireCentralaOrAdmin()
    if (!['administrator', 'admin'].includes(role)) {
        throw new Error('Tylko administrator może zarządzać bazą stawek rynkowych')
    }
    return { supabase, user }
}

export async function getMarketRates(filters?: {
    category?: string
    source?: string
    search?: string
}): Promise<MarketRate[]> {
    const { supabase } = await requireCentralaOrAdmin()

    let query = supabase
        .from('market_rates')
        .select('*')
        .order('category', { ascending: true })
        .order('position_title', { ascending: true })

    if (filters?.category) {
        query = query.eq('category', filters.category)
    }
    if (filters?.source) {
        query = query.eq('source', filters.source)
    }
    if (filters?.search) {
        query = query.ilike('position_title', `%${filters.search}%`)
    }

    const { data, error } = await query

    if (error) {
        console.error('[getMarketRates]', error)
        return []
    }

    return data || []
}

export async function getMarketRateCategories(): Promise<string[]> {
    const { supabase } = await requireCentralaOrAdmin()

    const { data, error } = await supabase
        .from('market_rates')
        .select('category')
        .not('category', 'is', null)

    if (error || !data) return []

    const unique = Array.from(new Set(data.map(d => d.category).filter(Boolean))) as string[]
    return unique.sort()
}

export async function getMarketRateSources(): Promise<string[]> {
    const { supabase } = await requireCentralaOrAdmin()

    const { data, error } = await supabase
        .from('market_rates')
        .select('source')
        .not('source', 'is', null)

    if (error || !data) return []

    const unique = Array.from(new Set(data.map(d => d.source).filter(Boolean))) as string[]
    return unique.sort()
}

export async function verifyRate(input: VerifyRateInput): Promise<VerifyRateResult> {
    const { supabase, user } = await requireCentralaOrAdmin()

    const searchTerm = input.position_title.toLowerCase()

    // 1. Search market_rates by position title (fuzzy)
    const { data: marketRates } = await supabase
        .from('market_rates')
        .select('*')
        .ilike('position_title', `%${searchTerm}%`)

    // If no direct match, try broader search with individual keywords
    let matchedRates = marketRates || []
    if (matchedRates.length === 0 && searchTerm.includes(' ')) {
        const keywords = searchTerm.split(/\s+/).filter(k => k.length > 2)
        for (const keyword of keywords) {
            const { data } = await supabase
                .from('market_rates')
                .select('*')
                .ilike('position_title', `%${keyword}%`)
            if (data && data.length > 0) {
                matchedRates = [...matchedRates, ...data]
            }
        }
        // Deduplicate
        const seen = new Set<string>()
        matchedRates = matchedRates.filter(r => {
            if (seen.has(r.id)) return false
            seen.add(r.id)
            return true
        })
    }

    // Normalize rates to the requested type (hourly or monthly)
    const normalizedMarket = matchedRates.map(r => {
        let min = Number(r.rate_min)
        let max = Number(r.rate_max)
        let med = r.rate_median ? Number(r.rate_median) : (min + max) / 2

        if (input.rate_type === 'hourly' && r.rate_type?.includes('monthly')) {
            // monthly -> hourly: divide by 168 (21 days * 8h)
            min = Math.round(min / 168)
            max = Math.round(max / 168)
            med = Math.round(med / 168)
        } else if (input.rate_type === 'monthly' && r.rate_type?.includes('hourly')) {
            // hourly -> monthly: multiply by 168
            min = Math.round(min * 168)
            max = Math.round(max * 168)
            med = Math.round(med * 168)
        }

        return { min, max, med, source: r.source || 'Unknown' }
    })

    const marketSources = Array.from(new Set(normalizedMarket.map(r => r.source)))
    const allMins = normalizedMarket.map(r => r.min).filter(v => v > 0)
    const allMaxs = normalizedMarket.map(r => r.max).filter(v => v > 0)
    const allMeds = normalizedMarket.map(r => r.med).filter(v => v > 0)

    const marketMin = allMins.length > 0 ? Math.min(...allMins) : null
    const marketMax = allMaxs.length > 0 ? Math.max(...allMaxs) : null
    const marketMedian = allMeds.length > 0
        ? Math.round(allMeds.reduce((a, b) => a + b, 0) / allMeds.length)
        : null

    // 2. Search Compass rates (active contracts)
    const { data: contracts } = await supabase
        .from('contracts')
        .select('hourly_rate, monthly_rate')
        .eq('status', 'active')

    let compassRates: number[] = []
    if (contracts && contracts.length > 0) {
        compassRates = contracts
            .map(c => {
                if (input.rate_type === 'hourly') {
                    return c.hourly_rate ? Number(c.hourly_rate) : (c.monthly_rate ? Number(c.monthly_rate) / 168 : 0)
                } else {
                    return c.monthly_rate ? Number(c.monthly_rate) : (c.hourly_rate ? Number(c.hourly_rate) * 168 : 0)
                }
            })
            .filter(r => r > 0)
    }

    const compassMin = compassRates.length > 0 ? Math.round(Math.min(...compassRates)) : null
    const compassMax = compassRates.length > 0 ? Math.round(Math.max(...compassRates)) : null
    const compassAvg = compassRates.length > 0
        ? Math.round(compassRates.reduce((a, b) => a + b, 0) / compassRates.length)
        : null

    // 3. Determine verdict
    const referenceMedian = marketMedian || compassAvg
    let verdict: 'below_market' | 'within_market' | 'above_market' = 'within_market'

    if (referenceMedian) {
        const lowerBound = referenceMedian * 0.85
        const upperBound = referenceMedian * 1.15

        if (input.expected_rate < lowerBound) {
            verdict = 'below_market'
        } else if (input.expected_rate > upperBound) {
            verdict = 'above_market'
        }
    } else if (marketMin !== null && marketMax !== null) {
        if (input.expected_rate < marketMin) {
            verdict = 'below_market'
        } else if (input.expected_rate > marketMax) {
            verdict = 'above_market'
        }
    }

    // 4. Generate AI summary
    const summary = await generateRateSummary({
        position_title: input.position_title,
        profile_description: input.profile_description,
        expected_rate: input.expected_rate,
        rate_type: input.rate_type,
        market: { min: marketMin, median: marketMedian, max: marketMax, sources: marketSources, count: normalizedMarket.length },
        compass: { min: compassMin, avg: compassAvg, max: compassMax, sample_size: compassRates.length },
        verdict,
    })

    // 5. Save verification to history
    await supabase.from('rate_verifications').insert({
        verified_by: user.id,
        position_title: input.position_title,
        profile_description: input.profile_description || null,
        expected_rate: input.expected_rate,
        currency: input.currency || 'PLN',
        rate_type: input.rate_type,
        market_rate_min: marketMin,
        market_rate_max: marketMax,
        market_rate_median: marketMedian,
        market_sources: marketSources,
        compass_rate_min: compassMin,
        compass_rate_max: compassMax,
        compass_rate_avg: compassAvg,
        compass_sample_size: compassRates.length,
        verdict,
        notes: summary,
    })

    return {
        market: {
            min: marketMin,
            median: marketMedian,
            max: marketMax,
            sources: marketSources,
            count: normalizedMarket.length,
        },
        compass: {
            min: compassMin,
            avg: compassAvg,
            max: compassMax,
            sample_size: compassRates.length,
        },
        verdict,
        expected_rate: input.expected_rate,
        rate_type: input.rate_type,
        summary,
    }
}

async function generateRateSummary(input: {
    position_title: string
    profile_description?: string
    expected_rate: number
    rate_type: 'hourly' | 'monthly'
    market: { min: number | null; median: number | null; max: number | null; sources: string[]; count: number }
    compass: { min: number | null; avg: number | null; max: number | null; sample_size: number }
    verdict: string
}): Promise<string> {
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'mock-key') {
        return 'Podsumowanie AI niedostępne — brak klucza OpenAI.'
    }

    const unit = input.rate_type === 'hourly' ? 'PLN/h' : 'PLN/mies.'
    const verdictPl = input.verdict === 'below_market' ? 'poniżej rynku'
        : input.verdict === 'above_market' ? 'powyżej rynku' : 'w normie rynkowej'

    const prompt = `Jesteś ekspertem ds. wynagrodzeń IT w Polsce, pracującym dla firmy outsourcingowej B2B.net.

Na podstawie poniższych danych sporządź zwięzłe podsumowanie i wnioski (4-6 zdań) po polsku.

DANE WEJŚCIOWE:
- Stanowisko: ${input.position_title}
- Opis profilu: ${input.profile_description || 'brak szczegółów'}
- Oczekiwana stawka: ${input.expected_rate} ${unit}

STAWKI RYNKOWE (${input.market.count} dopasowań, źródła: ${input.market.sources.join(', ') || 'brak'}):
- Minimum: ${input.market.min ?? 'brak danych'} ${unit}
- Mediana: ${input.market.median ?? 'brak danych'} ${unit}
- Maksimum: ${input.market.max ?? 'brak danych'} ${unit}

STAWKI WEWNĘTRZNE COMPASS (${input.compass.sample_size} aktywnych kontraktów):
- Minimum: ${input.compass.min ?? 'brak danych'} ${unit}
- Średnia: ${input.compass.avg ?? 'brak danych'} ${unit}
- Maksimum: ${input.compass.max ?? 'brak danych'} ${unit}

WERDYKT SYSTEMU: ${verdictPl}

INSTRUKCJE:
1. Oceń stawkę w kontekście danych rynkowych i wewnętrznych
2. Jeśli są dane Compass — porównaj z wewnętrznymi benchmarkami
3. Podaj konkretną rekomendację: AKCEPTACJA / NEGOCJACJA / ODRZUCENIE
4. Wskaż ewentualne ryzyka lub szanse
5. Bądź konkretny — podawaj liczby i procenty odchyleń
6. Pisz zwięźle, profesjonalnym językiem biznesowym`

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'Jesteś ekspertem ds. stawek IT w Polsce. Odpowiadaj krótko, konkretnie, po polsku.' },
                { role: 'user', content: prompt },
            ],
            max_tokens: 500,
            temperature: 0.3,
        })
        return response.choices[0]?.message?.content || 'Nie udało się wygenerować podsumowania.'
    } catch (err) {
        console.error('[generateRateSummary]', err)
        return 'Błąd generowania podsumowania AI.'
    }
}

export async function getVerificationHistory(): Promise<RateVerification[]> {
    const { supabase } = await requireCentralaOrAdmin()

    const { data, error } = await supabase
        .from('rate_verifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

    if (error) {
        console.error('[getVerificationHistory]', error)
        return []
    }

    return (data || []) as RateVerification[]
}

export async function deleteMarketRate(id: string) {
    const { supabase } = await requireAdmin()

    const { error } = await supabase
        .from('market_rates')
        .delete()
        .eq('id', id)

    if (error) throw new Error('Błąd usuwania: ' + error.message)
    return { success: true }
}

export async function addMarketRate(rate: {
    position_title: string
    category?: string
    seniority?: string
    rate_min: number
    rate_median?: number
    rate_max: number
    currency?: string
    rate_type?: string
    source?: string
    region?: string
}) {
    const { supabase, user } = await requireAdmin()

    const { error } = await supabase.from('market_rates').insert({
        ...rate,
        uploaded_by: user.id,
    })

    if (error) throw new Error('Błąd dodawania: ' + error.message)
    return { success: true }
}
