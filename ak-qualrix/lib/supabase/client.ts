import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// Singleton — one instance per browser tab to avoid auth lock conflicts
let client: SupabaseClient | null = null

export function createClient() {
  if (client) return client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    console.error('Supabase Env Vars missing!', { url, key })
    throw new Error('Supabase configuration missing. Check .env.local')
  }

  client = createBrowserClient(url, key)
  return client
}
