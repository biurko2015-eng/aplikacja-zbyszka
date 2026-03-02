
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase URL or Key missing')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function verify() {
    console.log('--- VERIFYING COMMUNICATOR TABLES (Standalone) ---')
    const tables = ['conversations', 'conversation_participants', 'messages']
    let allExist = true

    for (const table of tables) {
        const { error } = await supabase.from(table).select('id').limit(1)
        if (error && error.code === '42P01') {
            console.error(`❌ Table '${table}' MISSING`)
            allExist = false
        } else {
            console.log(`✅ Table '${table}' FOUND`)
        }
    }

    if (allExist) {
        console.log('\nSUCCESS: All tables ready.')
    } else {
        console.log('\nFAILURE: Missing tables.')
    }
}

verify()
