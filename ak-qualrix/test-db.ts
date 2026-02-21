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

async function testFavorites() {
    const { data, error } = await supabase.from('favorite_projects').select('*').limit(1)
    if (error) {
        console.error('Table or access error:', error)
    } else {
        console.log('Successfully connected to favorite_projects. Data:', data)
    }
}

testFavorites()
