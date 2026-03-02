
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

async function verifyTables() {
    console.log('--- VERIFYING COMMUNICATOR TABLES ---')
    const tables = ['conversations', 'conversation_participants', 'messages']
    let allExist = true

    for (const table of tables) {
        const { error } = await supabase.from(table).select('id').limit(1)
        if (error && error.code === '42P01') { // undefined_table
            console.error(`❌ Table '${table}' does NOT exist.`)
            allExist = false
        } else if (error) {
            console.error(`⚠️ Error checking '${table}':`, error.message)
            // It might exist but be empty or have RLS blocking, but 42P01 is the key absence indicator
        } else {
            console.log(`✅ Table '${table}' exists.`)
        }
    }

    if (allExist) {
        console.log('\nSUCCESS: All communicator tables are present.')
    } else {
        console.log('\nFAILURE: Some tables are missing. Please run the migration SQL.')
    }
}

verifyTables()
