'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { generateEmbedding } from '@/lib/ai/embeddings'

export async function matchProjectsForUser(userId: string, limit: number = 5) {
    const supabase = createClient()

    // 1. Get user profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('bio, embedding')
        .eq('id', userId)
        .single()

    if (!profile) throw new Error('Profile not found')

    let embedding = profile.embedding

    // 2. If no embedding but bio exists, generate it
    if (!embedding && profile.bio) {
        embedding = await generateEmbedding(profile.bio)
        // Save it for future
        await supabase
            .from('profiles')
            .update({ embedding })
            .eq('id', userId)
    }

    if (!embedding) return []

    // 3. Match projects using cosine similarity
    const { data: projects, error } = await supabase.rpc('match_projects', {
        query_embedding: embedding,
        match_threshold: 0.5, // 50% similarity threshold
        match_count: limit,
    })

    if (error) {
        console.error('Error matching projects:', error)
        return []
    }

    return projects
}

export async function updateUserBio(bio: string) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Not authenticated')

    const embedding = await generateEmbedding(bio)

    const { error } = await supabase
        .from('profiles')
        .update({ bio, embedding })
        .eq('id', user.id)

    if (error) throw new Error(error.message)

    return { success: true }
}

export interface ProfileUpdateData {
    bio?: string
    experience_years?: number
    current_status?: string
    capacity_percentage?: number
    project_sentiment?: string[]
    verifier_status?: string
    ambassador_status?: string
    sales_support_status?: string
    previous_clients?: string[]
    available_from?: string | null
    fte_status?: string | null
    max_monthly_hours?: number
    gdpr_consent?: boolean
    full_name?: string
    phone?: string
    embedding?: number[]
    skills?: string[]
    avatar_url?: string
    cv_url?: string
}

export async function updateProfileFull(data: ProfileUpdateData): Promise<{ success: true; warning?: string } | { success: false; error: string }> {
    try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) return { success: false, error: 'Nie jesteś zalogowany.' }

    const updates: ProfileUpdateData = { ...data }

    // Fix: available_from as empty string will fail on DATE column
    if (updates.available_from === '') {
        updates.available_from = null
    }

    // If bio is updated, regenerate embedding
    if (data.bio) {
        try {
            updates.embedding = await generateEmbedding(data.bio)
        } catch (e) {
            console.warn('[ProfileUpdate] Failed to generate embedding:', e)
            // Continue without embedding update if AI fails
        }
    }

    console.log('[ProfileUpdate] Updating profile for user:', user.id, updates)

    let { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)

    // Fallback: jeśli błąd sugeruje brak kolumny (np. phone), ponów update bez tego pola
    if (error) {
        const msg = (error as { message?: string }).message?.toLowerCase() ?? ''
        const looksLikeMissingColumn = msg.includes('column') && (msg.includes('phone') || msg.includes('does not exist') || msg.includes('undefined'))
        if (looksLikeMissingColumn && updates.phone !== undefined) {
            const { phone: _p, ...updatesWithoutPhone } = updates
            console.warn('[ProfileUpdate] Retrying without phone (column may be missing):', _p)
            const retry = await supabase.from('profiles').update(updatesWithoutPhone).eq('id', user.id)
            if (retry.error) {
                console.error('[ProfileUpdate] Error updating profiles table:', retry.error)
                return { success: false, error: `Błąd zapisu: ${retry.error.message}` }
            }
            revalidatePath('/home')
            revalidatePath('/profile')
            revalidatePath('/more')
            return { success: true, warning: 'Imię i nazwisko zapisane. Numer telefonu nie został zapisany — w bazie brakuje kolumny "phone". Poproś administratora o wykonanie migracji.' }
        }
        console.error('[ProfileUpdate] Error updating profiles table:', error)
        return { success: false, error: `Błąd zapisu do bazy: ${error.message}` }
    }

        revalidatePath('/home')
        revalidatePath('/profile')
        revalidatePath('/more')

        try {
            await syncProfileToCandidate(user.id, data)
        } catch (syncError: unknown) {
            const syncErr = syncError as Error
            console.warn('[ProfileUpdate] Sync to candidates skipped or failed:', syncErr.message)
            return {
                success: true,
                warning: `Profil zaktualizowany. Synchronizacja z CRM nie powiodła się.`
            }
        }

        return { success: true }
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error('[ProfileUpdate] Unexpected error:', e)
        return { success: false, error: msg || 'Nie udało się zapisać zmian. Spróbuj ponownie.' }
    }
}

export async function deleteMyProfile() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id)

    if (error) {
        throw new Error(`Failed to delete profile: ${error.message}`)
    }

    // Ideally we would verify if we can sign them out server-side, 
    // but usually client handles redirect after this.
    return { success: true }
}

export async function syncProfileToCandidate(userId: string, overrideData: ProfileUpdateData = {}) {
    console.log('[Sync] syncProfileToCandidate called for user:', userId)
    console.log('[Sync] With overrides:', JSON.stringify(overrideData, null, 2))

    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()

    console.log('[Sync] Starting sync for user:', userId, 'Session UID:', authUser?.id)

    if (!authUser) {
        console.warn('[Sync] No auth session found. Sync skipped.')
        return
    }

    if (authUser.id !== userId) {
        console.warn('[Sync] User ID mismatch detected.', { session: authUser.id, target: userId })
        // If we're an admin, we might be syncing someone else's profile, but the sync MyProfile 
        // logic usually implies self-sync. In dev bypass, these might differ.
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

    if (profileError || !profile) {
        console.error('[Sync] Profile not found for sync:', userId, profileError)
        return
    }

    // 2. Prepare Candidate Data
    const candidateData = {
        email: authUser.email,
        full_name: overrideData.full_name || profile.full_name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0],
        phone: overrideData.phone || profile.phone,
        bio: overrideData.bio || profile.bio,
        skills: overrideData.skills || profile.skills || [],
        experience_years: overrideData.experience_years ?? profile.experience_years,
        current_status: overrideData.current_status || profile.current_status,
        capacity_percentage: overrideData.capacity_percentage ?? profile.capacity_percentage,
        project_sentiment: overrideData.project_sentiment || profile.project_sentiment,
        verifier_status: overrideData.verifier_status || profile.verifier_status,
        ambassador_status: overrideData.ambassador_status || profile.ambassador_status,
        sales_support_status: overrideData.sales_support_status || profile.sales_support_status,
        previous_clients: overrideData.previous_clients || profile.previous_clients || [],
        avatar_url: overrideData.avatar_url || profile.avatar_url,
        cv_url: overrideData.cv_url || profile.cv_url,
        embedding: overrideData.embedding || profile.embedding,
        available_from: (overrideData.available_from === '' || profile.available_from === '') ? null : (overrideData.available_from ?? profile.available_from),
        fte_status: overrideData.fte_status ?? profile.fte_status,
        max_monthly_hours: overrideData.max_monthly_hours ?? profile.max_monthly_hours
    }

    // 3. Upsert into Candidates (Match by user_id or Email)
    console.log('[Sync] Upserting candidate for user:', userId)

    // First, try to find by user_id (Strongest link)
    let { data: existingCandidate } = await supabase
        .from('candidates')
        .select('id, user_id')
        .eq('user_id', userId)
        .single()

    // If not found by user_id, try by email (Legacy/Import link)
    if (!existingCandidate && profile.email) {
        const { data: emailCandidate } = await supabase
            .from('candidates')
            .select('id, user_id')
            .eq('email', profile.email)
            .single()

        if (emailCandidate) {
            existingCandidate = emailCandidate
            // We found a match by email! We should "claim" this candidate by setting user_id
            console.log('[Sync] Found candidate by email, claiming with user_id...')
        }
    }

    let result
    const updateData = {
        ...candidateData,
        user_id: userId // Ensure user_id is set
    }

    try {
        if (existingCandidate) {
            console.log('[Sync] Updating existing candidate ID:', existingCandidate.id)
            result = await supabase
                .from('candidates')
                .update(updateData)
                .eq('id', existingCandidate.id)
                .select()
        } else {
            console.log('[Sync] Creating new candidate')
            result = await supabase
                .from('candidates')
                .insert({
                    ...updateData,
                    status: 'new'
                })
                .select()
        }
    } catch (e: unknown) {
        const error = e as Error
        console.error('[Sync] Exception during upsert:', error)
        throw new Error(`Sync failed due to exception: ${error.message}`)
    }

    const { revalidatePath } = await import('next/cache')
    revalidatePath('/admin/candidates')
    if (result.data?.[0]?.id) {
        revalidatePath(`/admin/candidates/${result.data[0].id}`)
    }
    revalidatePath('/profile')

    if (result.error) {
        console.error('[Sync] Failed to upsert candidate:', result.error)
        throw new Error(`Sync failed: ${result.error.message}`)
    } else {
        console.log('[Sync] Success! Candidate synced:', result.data?.[0]?.id)
        return { success: true, candidateId: result.data?.[0]?.id }
    }
}

export async function syncMyProfile(overrideData: ProfileUpdateData = {}) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    return await syncProfileToCandidate(user.id, overrideData)
}

export async function getMyProfile() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    return profile
}
