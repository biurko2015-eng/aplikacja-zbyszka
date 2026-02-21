/**
 * Standalone test for backend actions (DB + RPC).
 * Run from project root: npx tsx scripts/debug/test-actions.ts
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials')
    process.exit(1)
}
const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
    console.log('--- TESTING BACKEND (candidates + match_projects RPC) ---')
    const { data: candidates, error: ce } = await supabase
        .from('candidates')
        .select('id, full_name, embedding')
        .limit(1)

    if (ce) {
        console.error('Candidates fetch error:', ce.message)
        return
    }
    if (!candidates || candidates.length === 0) {
        console.log('No candidates found')
        return
    }

    const c = candidates[0]
    console.log(`Candidate: ${c.full_name} (${c.id})`)

    if (!c.embedding) {
        console.log('Candidate has no embedding – skipping match_projects RPC')
        return
    }

    const { data: projects, error: rpcError } = await supabase.rpc('match_projects', {
        query_embedding: c.embedding,
        match_threshold: 0.3,
        match_count: 5,
    })

    if (rpcError) {
        console.error('RPC match_projects error:', rpcError.message)
        return
    }
    const list = (projects ?? []) as { id: string; title?: string; similarity?: number }[]
    console.log(`Found ${list.length} matching projects`)
    if (list.length > 0) {
        console.log('First:', list[0].title, 'Similarity:', list[0].similarity)
    }
    console.log('--- BACKEND TEST OK ---')
}

test()
