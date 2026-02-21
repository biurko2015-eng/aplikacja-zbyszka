/**
 * Mock Supabase client used when NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
 * are not set (e.g. on Render without env, or local demo). App runs without backend;
 * auth returns no user, queries return empty data.
 */

const emptyList = { data: [], error: null }
const emptySingle = { data: null, error: null }

function chain(single = false) {
  const result = single ? emptySingle : emptyList
  const thenable = Promise.resolve(result)
  const o: Record<string, unknown> = {}
  ;['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'in', 'is', 'order', 'limit', 'range', 'abortSignal'].forEach((m) => {
    o[m] = () => o
  })
  o.single = () => chain(true)
  o.maybeSingle = () => chain(true)
  o.then = (onFulfilled: (v: typeof emptyList) => unknown, onRejected?: (e: unknown) => unknown) =>
    thenable.then(onFulfilled, onRejected)
  o.catch = (onRejected: (e: unknown) => unknown) => thenable.catch(onRejected)
  return o as { then: Promise<typeof emptyList>['then']; catch: Promise<typeof emptyList>['catch']; single: () => typeof o; maybeSingle: () => typeof o; [k: string]: unknown }
}

function from(_table: string) {
  return chain()
}

const BYPASS_USER = {
  id: 'df0edb15-8c84-434d-928f-689348171029',
  email: 'zbigniew.twardowski@b2bnetwork.pl',
  app_metadata: {},
  user_metadata: { full_name: 'Zbigniew Twardowski' },
  aud: 'authenticated',
  created_at: new Date().toISOString(),
} as const

export function createMockSupabaseClient(overrideUser?: typeof BYPASS_USER | null) {
  const user = overrideUser ?? null
  return {
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
      signIn: async () => ({ data: { user: null, session: null }, error: { message: 'Supabase not configured' } }),
      signOut: async () => ({ error: null }),
      signUp: async () => ({ data: { user: null, session: null }, error: { message: 'Supabase not configured' } }),
      resetPasswordForEmail: async () => ({ data: {}, error: { message: 'Supabase not configured' } }),
      updateUser: async () => ({ data: { user: null }, error: { message: 'Supabase not configured' } }),
    },
    from,
    storage: {
      from: () => ({
        upload: async () => ({ data: null, error: { message: 'Supabase not configured' } }),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
        list: async () => ({ data: [], error: null }),
        remove: async () => ({ data: null, error: null }),
        createSignedUrl: async () => ({ data: null, error: { message: 'Supabase not configured' } }),
      }),
    },
    channel: () => ({
      on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
      subscribe: () => ({ unsubscribe: () => {} }),
    }),
  } as unknown as import('@supabase/supabase-js').SupabaseClient
}

export function isSupabaseConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}
