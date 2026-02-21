
import { createClient } from './lib/supabase/server'

async function testFavorites() {
    const supabase = createClient()
    const { data, error } = await supabase.from('favorite_projects').select('*').limit(1)
    if (error) {
        console.error('Table or access error:', error)
    } else {
        console.log('Successfully connected to favorite_projects. Data:', data)
    }
}

testFavorites()
