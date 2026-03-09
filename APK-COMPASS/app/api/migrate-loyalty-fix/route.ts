import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

export const dynamic = 'force-dynamic'

/**
 * GET /api/migrate-loyalty-fix?secret=<SUPABASE_SERVICE_ROLE_KEY>
 *
 * Fixes the loyalty tier trigger to include Platinum and align thresholds:
 * Bronze 0, Silver 500, Gold 2000, Platinum 5000
 */
export async function GET(req: NextRequest) {
    const secret = req.nextUrl.searchParams.get('secret')
    const expectedSecret = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!secret || secret !== expectedSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const results: { step: string; status: string; detail?: string }[] = []

    // Build connection string — use DATABASE_URL if available, otherwise construct from SUPABASE_URL
    let connectionString = process.env.DATABASE_URL
    if (!connectionString) {
        // Fallback: construct from Supabase URL pattern
        // https://txzflesacqvlyhxwfjxk.supabase.co → db.txzflesacqvlyhxwfjxk.supabase.co
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
        const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)
        if (match) {
            const ref = match[1]
            connectionString = `postgresql://postgres.${ref}:${secret}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`
        }
    }

    if (!connectionString) {
        return NextResponse.json({
            error: 'Cannot determine database connection',
            env_keys: Object.keys(process.env).filter(k => k.includes('DATABASE') || k.includes('SUPABASE') || k.includes('PG')),
        }, { status: 500 })
    }

    let pool: Pool | null = null

    try {
        pool = new Pool({
            connectionString,
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 10000,
        })

        // Test connection
        await pool.query('SELECT 1')
        results.push({ step: 'Database connection', status: 'OK' })

        // Step 1: Replace trigger function
        try {
            await pool.query(`
                CREATE OR REPLACE FUNCTION update_loyalty_status() RETURNS TRIGGER AS $$
                DECLARE
                    new_total_points INTEGER;
                    new_tier TEXT;
                    old_tier TEXT;
                BEGIN
                    SELECT COALESCE(SUM(points), 0) INTO new_total_points
                    FROM loyalty_transactions
                    WHERE user_id = NEW.user_id;

                    IF new_total_points >= 5000 THEN
                        new_tier := 'platinum';
                    ELSIF new_total_points >= 2000 THEN
                        new_tier := 'gold';
                    ELSIF new_total_points >= 500 THEN
                        new_tier := 'silver';
                    ELSE
                        new_tier := 'bronze';
                    END IF;

                    SELECT loyalty_tier INTO old_tier
                    FROM profiles
                    WHERE id = NEW.user_id;

                    UPDATE profiles
                    SET loyalty_points = new_total_points,
                        loyalty_tier = new_tier
                    WHERE id = NEW.user_id;

                    IF new_tier != COALESCE(old_tier, 'bronze') AND (
                        (old_tier = 'bronze' AND new_tier IN ('silver', 'gold', 'platinum')) OR
                        (old_tier = 'silver' AND new_tier IN ('gold', 'platinum')) OR
                        (old_tier = 'gold' AND new_tier = 'platinum')
                    ) THEN
                        BEGIN
                            INSERT INTO notifications (user_id, type, title, message)
                            VALUES (
                                NEW.user_id,
                                'loyalty_upgrade',
                                'Awans w Programie Lojalnościowym!',
                                'Gratulacje! Twój nowy poziom to ' || UPPER(new_tier) || ' (' || new_total_points || ' pkt).'
                            );
                        EXCEPTION WHEN OTHERS THEN
                            NULL;
                        END;
                    END IF;

                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql SECURITY DEFINER;
            `)
            results.push({ step: 'Replace trigger function (Bronze 0, Silver 500, Gold 2000, Platinum 5000)', status: 'OK' })
        } catch (err: any) {
            results.push({ step: 'Replace trigger function', status: 'ERROR', detail: err.message })
        }

        // Step 2: Verify trigger exists on loyalty_transactions
        try {
            const { rows } = await pool.query(`
                SELECT trigger_name FROM information_schema.triggers
                WHERE event_object_table = 'loyalty_transactions'
                AND trigger_name LIKE '%loyalty%'
            `)
            if (rows.length > 0) {
                results.push({ step: 'Verify trigger', status: 'OK', detail: `Found: ${rows.map((r: any) => r.trigger_name).join(', ')}` })
            } else {
                await pool.query(`
                    CREATE TRIGGER update_loyalty_status_trigger
                    AFTER INSERT OR DELETE ON loyalty_transactions
                    FOR EACH ROW EXECUTE FUNCTION update_loyalty_status();
                `)
                results.push({ step: 'Create missing trigger', status: 'OK' })
            }
        } catch (err: any) {
            results.push({ step: 'Verify/create trigger', status: 'ERROR', detail: err.message })
        }

        // Step 3: Recalculate existing users' tiers
        try {
            const { rowCount } = await pool.query(`
                UPDATE profiles p
                SET loyalty_tier = CASE
                    WHEN p.loyalty_points >= 5000 THEN 'platinum'
                    WHEN p.loyalty_points >= 2000 THEN 'gold'
                    WHEN p.loyalty_points >= 500 THEN 'silver'
                    ELSE 'bronze'
                END
                WHERE p.loyalty_points IS NOT NULL AND p.loyalty_points > 0
            `)
            results.push({ step: 'Recalculate tiers', status: 'OK', detail: `${rowCount} profiles updated` })
        } catch (err: any) {
            results.push({ step: 'Recalculate tiers', status: 'ERROR', detail: err.message })
        }

        return NextResponse.json({
            migration: '20260309_fix_loyalty_tier_trigger',
            results,
            timestamp: new Date().toISOString(),
        })
    } catch (err: any) {
        return NextResponse.json({
            error: 'Migration failed',
            message: err.message,
            stack: err.stack?.split('\n').slice(0, 3),
            results,
        }, { status: 500 })
    } finally {
        if (pool) await pool.end().catch(() => {})
    }
}
