'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Add loyalty points to a user
 * @param userId User ID
 * @param points Points amount (can be negative)
 * @param sourceType Source type code (e.g. 'manual_bonus', 'referral')
 * @param description Description for the user
 * @param sourceId Optional source UUID
 */
export async function addLoyaltyPoints(
    userId: string,
    points: number,
    sourceType: string,
    description: string,
    sourceId?: string
) {
    try {
        const supabase = createClient()

        // Security check - primarily for admin use or internal system calls
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: 'Unauthorized' }

        // Check role
        const { data: callerProfile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        const allowedRoles = ['admin', 'administrator', 'centrala']
        const hasPermission = allowedRoles.includes(callerProfile?.role || '')

        // If not admin, maybe allow self-triggering for specific system events? 
        // For now, let's enforce admin/centrala for MANUAL adds via this server action if it's used by the UI.
        // However, if this action is used by other system events (e.g. referral), it might need to bypass this check 
        // or be split into "adminAddPoints" vs internal "systemAddPoints".
        // Assuming this function is for the Admin UI manual add:
        if (!hasPermission) {
            return { success: false, error: 'Insufficient permissions' }
        }

        const { error } = await supabase.from('loyalty_transactions').insert({
            user_id: userId,
            points,
            source_type: sourceType,
            description,
            source_id: sourceId
        })

        if (error) throw error

        // Also update the profile total points/tier? 
        // The trigger should handle it, but let's confirm trigger existence. 
        // Based on migrations, there is a trigger `update_loyalty_status`. So we are good.

        revalidatePath('/profile')
        revalidatePath('/admin')
        return { success: true }
    } catch (error: any) {
        console.error('Error adding points:', error)
        return { success: false, error: error.message }
    }
}

export async function searchUsers(query: string) {
    const supabase = createClient()

    // Check auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    if (!query || query.length < 2) return []

    const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, loyalty_points, loyalty_tier')
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(10)

    if (error) {
        console.error('Search error:', error)
        return []
    }

    return data
}

// --- Loyalty Rules Configuration ---

export interface LoyaltyRule {
    id: string
    code: string
    name: string
    points: number
    category: string
    description: string | null
    is_active: boolean
}

const DEFAULT_RULES: Omit<LoyaltyRule, 'id' | 'created_at' | 'updated_at'>[] = [
    { code: 'referral_hired', name: 'Referral (Zatrudnienie)', points: 1000, category: 'Recruitment', description: 'Zatrudnienie osoby poleconej', is_active: true },
    { code: 'role_ambassador', name: 'Rola Compass: Ambasador', points: 200, category: 'Compass', description: 'Miesięczny bonus za rolę', is_active: true },
    { code: 'role_verifier', name: 'Rola Compass: Weryfikator', points: 100, category: 'Compass', description: 'Miesięczny bonus za rolę', is_active: true },
    { code: 'role_sales', name: 'Rola Compass: Wsparcie Sprzedaży', points: 300, category: 'Compass', description: 'Miesięczny bonus za rolę', is_active: true },
    { code: 'anniversary', name: 'Rocznica zatrudnienia', points: 500, category: 'Loyalty', description: 'Nagroda roczna', is_active: true },
    { code: 'contract_extension', name: 'Przedłużenie umowy (Annex)', points: 500, category: 'Loyalty', description: 'Za każdy aneks', is_active: true },
    { code: 'smooth_transition', name: 'Gładkie przejście', points: 300, category: 'Loyalty', description: 'Gap między projektami ≤ 14 dni', is_active: true },
    { code: 'positive_feedback', name: 'Pozytywna ankieta kwartalna', points: 200, category: 'Quality', description: 'Rating ≥ 4.5', is_active: true },
    { code: 'certification', name: 'Nowa certyfikacja', points: 150, category: 'Development', description: 'Uzyskanie certyfikatu (np. AWS, Azure)', is_active: true },
    { code: 'perfect_attendance', name: 'Pełny miesiąc na projekcie', points: 100, category: 'Performance', description: 'Frekwencja ≥ 90%', is_active: true },
]

export async function getLoyaltyRules() {
    const supabase = createClient()

    try {
        const { data, error } = await supabase
            .from('loyalty_rules')
            .select('*')
            .order('category', { ascending: true })
            .order('points', { ascending: false })

        if (error) {
            console.warn('Error fetching loyalty rules (table might generally be missing, using defaults):', error.message)
            // Return defaults with fake IDs if table assumes missing
            return DEFAULT_RULES.map((r, i) => ({ ...r, id: `mock-${i}` }))
        }

        return data as LoyaltyRule[]
    } catch (e) {
        console.error('Exception fetching rules:', e)
        return DEFAULT_RULES.map((r, i) => ({ ...r, id: `mock-${i}` }))
    }
}

export async function updateLoyaltyRule(id: string, updates: Partial<LoyaltyRule>) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    // Check admin role
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!['admin', 'administrator', 'centrala'].includes(profile?.role || '')) {
        return { success: false, error: 'Insufficient permissions' }
    }

    if (id.startsWith('mock-')) {
        return { success: false, warning: 'Changes cannot be saved (Database table "loyalty_rules" is missing). Please run the migration script.' }
    }

    const { error } = await supabase
        .from('loyalty_rules')
        .update(updates)
        .eq('id', id)

    if (error) return { success: false, error: error.message }

    return { success: true }
}


/**
 * Get loyalty transaction history for a user
 */
export async function getLoyaltyHistory(limit = 10) {
    try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: 'Unauthorized' }

        const { data, error } = await supabase
            .from('loyalty_transactions')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(limit)

        if (error) throw error

        return { success: true, history: data }
    } catch (error: any) {
        console.error('Error fetching loyalty history:', error)
        return { success: false, error: error.message }
    }
}

/**
 * Get progress to next tier
 */
export async function getTierProgress() {
    try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: 'Unauthorized' }

        const { data: profile } = await supabase
            .from('profiles')
            .select('loyalty_points, loyalty_tier')
            .eq('id', user.id)
            .single()

        if (!profile) return { success: false, error: 'Profile not found' }

        const points = profile.loyalty_points || 0
        const currentTier = profile.loyalty_tier || 'bronze'

        let nextTier = 'silver'
        let threshold = 500

        if (points >= 2000) {
            nextTier = 'platinum' // or max
            threshold = 10000 // unreachable cap
        } else if (points >= 500) {
            nextTier = 'gold'
            threshold = 2000
        }

        const missing = Math.max(0, threshold - points)
        const progressPercent = Math.min(100, (points / threshold) * 100)

        return {
            success: true,
            currentPoints: points,
            currentTier,
            nextTier,
            nextTierThreshold: threshold,
            pointsToNextTier: missing,
            progressPercent
        }

    } catch (error: any) {
        return { success: false, error: error.message }
    }
}
