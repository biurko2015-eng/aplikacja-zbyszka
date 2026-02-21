
import { createClient } from './lib/supabase/server'
import { getMatchingProjectsForCandidate } from './lib/actions/candidates'
import { analyzeMatch } from './lib/actions/match-analysis'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function test() {
    console.log('--- TESTING BACKEND ACTIONS ---')
    const supabase = createClient()
    const { data: candidates } = await supabase.from('candidates').select('id, full_name').limit(1)

    if (!candidates || candidates.length === 0) {
        console.log('No candidates found')
        return
    }

    const candidateId = candidates[0].id
    console.log(`Testing for Candidate: ${candidates[0].full_name} (${candidateId})`)

    try {
        const matches = await getMatchingProjectsForCandidate(candidateId)
        console.log(`Found ${matches.length} matching projects`)

        if (matches.length > 0) {
            console.log('First match:', matches[0].title, 'Similarity:', matches[0].similarity)
            console.log('Testing analysis...')
            const analysis = await analyzeMatch(matches[0].id, candidateId)
            console.log('Analysis Success:', analysis.recommendation)
        }
    } catch (err) {
        console.error('Action failed:', err)
    }
}

test()
