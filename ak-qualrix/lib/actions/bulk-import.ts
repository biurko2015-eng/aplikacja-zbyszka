'use server'

import { createClient } from '@/lib/supabase/server'
import { parseFile } from '@/lib/files/parsers'
import { generateEmbedding } from '@/lib/ai/embeddings'
import { revalidatePath } from 'next/cache'
import { processDataWithAI } from '@/lib/ai/processor'

// --- Bulk Candidate Import (File) ---

export async function importCandidate(formData: FormData) {
    const file = formData.get('file') as File
    if (!file) throw new Error('No file')

    const supabase = createClient()

    // 1. Upload to Storage
    const fileExt = file.name.split('.').pop()
    const filePath = `candidates/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

    const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file)

    if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`)
    }

    // 2. Parse & AI Process
    const text = await parseFile(file)
    const data = await processDataWithAI(text, 'candidate')

    // Handle Images
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    let avatarUrl = null
    try {
        const { extractImagesFromDocx, extractImagesFromPdf } = await import('@/lib/files/image-parser')
        let imageBuffer: Buffer | null = null
        if (file.name.endsWith('.docx')) imageBuffer = await extractImagesFromDocx(buffer)
        else if (file.name.endsWith('.pdf')) imageBuffer = await extractImagesFromPdf(buffer)

        if (imageBuffer) {
            const avatarPath = `profiles/extracted-${Date.now()}.png`
            const { error: avatarUploadError } = await supabase.storage
                .from('avatars')
                .upload(avatarPath, imageBuffer, { contentType: 'image/png' })

            if (!avatarUploadError) {
                const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(avatarPath)
                avatarUrl = publicUrl
            }
        }
    } catch (e) { }

    return saveCandidate(data, text, filePath, avatarUrl)
}

// --- Import from Text ---
export async function importFromText(text: string, type: 'candidate' | 'project') {
    const data = await processDataWithAI(text, type)
    if (type === 'candidate') {
        return saveCandidate(data, text)
    } else {
        return saveProject(data, text)
    }
}

// --- Import from Link ---
export async function importFromLink(url: string, type: 'candidate' | 'project') {
    // In a real scenario, we would use a scraper tool or fetch the page content
    // For now, we simulate by fetching and taking a portion of the text or suggesting the user paste it
    try {
        const response = await fetch(url)
        const html = await response.text()
        const text = html.replace(/<[^>]*>?/gm, ' ').slice(0, 10000) // Simple tag removal

        const data = await processDataWithAI(text, type)
        if (type === 'candidate') return saveCandidate(data, text)
        return saveProject(data, text)
    } catch (error) {
        console.error('Link import error:', error)
        throw new Error('Could not fetch link content. Try Copy-Paste mode.')
    }
}

// --- Helper: Save Candidate ---
async function saveCandidate(data: any, rawText: string, cvUrl?: string, avatarUrl?: string | null) {
    const supabase = createClient()

    // Duplicate check
    if (data.email) {
        const { data: existing } = await supabase.from('candidates').select('id').eq('email', data.email).single()
        if (existing) return { success: false, name: data.full_name, message: 'Duplikat (Email)' }
    }

    const embedding = await generateEmbedding(rawText)
    const { error } = await supabase.from('candidates').insert({
        full_name: data.full_name || 'Unknown Candidate',
        email: data.email,
        phone: data.phone,
        skills: data.skills || [],
        bio: data.bio_summary,
        experience_years: data.experience_years,
        previous_clients: data.previous_clients || [],
        cv_url: cvUrl,
        avatar_url: avatarUrl,
        embedding,
        status: 'new'
    })

    if (error) throw new Error(`DB Error: ${error.message}`)
    revalidatePath('/admin/candidates')
    return { success: true, name: data.full_name, message: 'Sukces' }
}

// --- Bulk Project Import (File) ---

export async function importProject(formData: FormData) {
    const file = formData.get('file') as File
    if (!file) throw new Error('No file')

    const supabase = createClient()
    const filePath = `projects/${Date.now()}-${file.name}`
    await supabase.storage.from('documents').upload(filePath, file)

    const text = await parseFile(file)
    const data = await processDataWithAI(text, 'project')

    return saveProject(data, text, filePath)
}

// --- Helper: Save Project ---
async function saveProject(data: any, rawText: string, fileUrl?: string) {
    const supabase = createClient()
    const embedding = await generateEmbedding(`${data.title} ${data.description}`)

    const { error } = await supabase.from('projects').insert({
        title: data.title || 'New Project',
        description: data.description,
        description_pl: data.description_pl,
        required_skills: data.required_skills || [],
        budget_range: data.budget_range || data.max_rate,
        position: data.position,
        max_rate: data.max_rate,
        location: data.location,
        work_type: data.work_type,
        required_languages: data.required_languages || [],
        start_date: data.start_date,
        recommendation_deadline: data.recommendation_deadline,
        manager_name: data.manager_name,
        file_url: fileUrl,
        embedding
    })

    if (error) throw new Error(`DB Error: ${error.message}`)
    revalidatePath('/admin/projects')
    return { success: true, title: data.title }
}
