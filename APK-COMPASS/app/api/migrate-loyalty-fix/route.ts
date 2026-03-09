import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabase = createClient(supabaseUrl, expectedSecret, {
        db: { schema: 'public' },
        auth: { persistSession: false },
    })

    const results: { step: string; status: string; error?: string }[] = []

    // Step 1: Replace the trigger function
    const { error: e1 } = await supabase.rpc('exec_sql', { sql: '' }).catch(() => ({ error: null })) as any
    // rpc won't work — use raw pg via supabase admin
    // Instead, we'll use the Supabase SQL query directly via fetch

    const pgRes = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
        method: 'POST',
        headers: {
            'apikey': expectedSecret,
            'Authorization': `Bearer ${expectedSecret}`,
            'Content-Type': 'application/json',
        },
    }).catch(() => null)

    // Since we can't run raw SQL via REST, let's create a workaround:
    // Use the Database URL directly with pg
    const DATABASE_URL = process.env.DATABASE_URL

    if (!DATABASE_URL) {
        return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 500 })
    }

    try {
        // Dynamic import of pg (needs to be installed)
        const { Pool } = await import('pg')
        const pool = new Pool({ connectionString: DATABASE_URL })

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
            results.push({ step: 'Replace trigger function', status: 'ERROR', error: err.message })
        }

        // Step 2: Verify trigger exists on loyalty_transactions
        try {
            const { rows } = await pool.query(`
                SELECT trigger_name FROM information_schema.triggers
                WHERE event_object_table = 'loyalty_transactions'
                AND trigger_name LIKE '%loyalty%'
            `)
            if (rows.length > 0) {
                results.push({ step: 'Verify trigger on loyalty_transactions', status: 'OK', error: `Found: ${rows.map((r: any) => r.trigger_name).join(', ')}` })
            } else {
                // Create trigger if missing
                await pool.query(`
                    CREATE TRIGGER update_loyalty_status_trigger
                    AFTER INSERT OR DELETE ON loyalty_transactions
                    FOR EACH ROW EXECUTE FUNCTION update_loyalty_status();
                `)
                results.push({ step: 'Create missing trigger on loyalty_transactions', status: 'OK' })
            }
        } catch (err: any) {
            results.push({ step: 'Verify/create trigger', status: 'ERROR', error: err.message })
        }

        // Step 3: Recalculate existing users' tiers based on new thresholds
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
            results.push({ step: `Recalculate tiers for existing users`, status: 'OK', error: `${rowCount} profiles updated` })
        } catch (err: any) {
            results.push({ step: 'Recalculate tiers', status: 'ERROR', error: err.message })
        }

        await pool.end()

        return NextResponse.json({
            migration: '20260309_fix_loyalty_tier_trigger',
            results,
            timestamp: new Date().toISOString(),
        })
    } catch (err: any) {
        return NextResponse.json({
            error: 'Migration failed',
            message: err.message,
            results,
        }, { status: 500 })
    }
}
