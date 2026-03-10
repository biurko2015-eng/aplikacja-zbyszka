import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    try {
        const { secret } = await request.json()
        if (secret !== 'migrate-360-candidates-2026') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const dbUrl = process.env.DATABASE_URL
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

        if (dbUrl) {
            const { Client } = await import('pg')
            const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
            await client.connect()

            const statements = [
                "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS tech_stack jsonb DEFAULT '[]'",
                "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS certifications jsonb DEFAULT '[]'",
                "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS work_preferences jsonb DEFAULT '{}'",
                "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS admin_notes jsonb DEFAULT '[]'",
            ]

            const results: string[] = []
            for (const sql of statements) {
                try {
                    await client.query(sql)
                    results.push(`OK: ${sql}`)
                } catch (e: any) {
                    results.push(`FAIL: ${sql} => ${e.message}`)
                }
            }

            const verify = await client.query(
                "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'candidates' AND column_name IN ('tech_stack', 'certifications', 'work_preferences', 'admin_notes') ORDER BY column_name"
            )

            await client.end()
            return NextResponse.json({ method: 'pg', results, columns: verify.rows })
        }

        if (supabaseUrl && serviceKey) {
            const match = supabaseUrl.match(/https:\/\/([^.]+)\./)
            const projectRef = match ? match[1] : null
            if (!projectRef) {
                return NextResponse.json({ error: 'Could not extract project ref' }, { status: 500 })
            }

            const { Client } = await import('pg')
            const connConfigs = [
                { host: `db.${projectRef}.supabase.co`, port: 5432, user: 'postgres', database: 'postgres' },
                { host: `aws-0-eu-central-1.pooler.supabase.com`, port: 6543, user: `postgres.${projectRef}`, database: 'postgres' },
            ]

            const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.POSTGRES_PASSWORD || ''

            if (!dbPassword) {
                return NextResponse.json({
                    error: 'No DATABASE_URL or SUPABASE_DB_PASSWORD set',
                    hint: 'Set DATABASE_URL in Render env vars. Get it from Supabase > Settings > Database > Connection string',
                    env_available: { DATABASE_URL: !!dbUrl, SUPABASE_DB_PASSWORD: !!process.env.SUPABASE_DB_PASSWORD }
                }, { status: 500 })
            }

            for (const conf of connConfigs) {
                try {
                    const client = new Client({ ...conf, password: dbPassword, ssl: { rejectUnauthorized: false } })
                    await client.connect()

                    await client.query("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS tech_stack jsonb DEFAULT '[]'")
                    await client.query("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS certifications jsonb DEFAULT '[]'")
                    await client.query("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS work_preferences jsonb DEFAULT '{}'")
                    await client.query("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS admin_notes jsonb DEFAULT '[]'")

                    const verify = await client.query(
                        "SELECT column_name FROM information_schema.columns WHERE table_name = 'candidates' AND column_name IN ('tech_stack', 'certifications', 'work_preferences', 'admin_notes')"
                    )
                    await client.end()
                    return NextResponse.json({ method: 'pg-fallback', columns: verify.rows })
                } catch {
                    continue
                }
            }

            return NextResponse.json({ error: 'All pg connections failed', hint: 'Set DATABASE_URL env var' }, { status: 500 })
        }

        return NextResponse.json({ error: 'No database credentials available' }, { status: 500 })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
