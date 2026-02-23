const { Client } = require('pg');
const client = new Client({
    connectionString: 'postgresql://postgres:xBf88BXZtf6QXJPa@db.txzflesacqvlyhxwfjxk.supabase.co:5432/postgres?sslmode=no-verify'
});

(async () => {
    await client.connect();
    const userId = 'd75f1a73-7927-4505-821f-c233b1a378ff';

    // Test: Check if maybe the issue is table-level GRANT for INSERT
    console.log('=== CHECK GRANTS for authenticated on conversations ===');
    const grantRes = await client.query(`
        SELECT privilege_type
        FROM information_schema.table_privileges
        WHERE table_name = 'conversations'
          AND grantee = 'authenticated'
        ORDER BY privilege_type;
    `);
    console.log('Grants:', grantRes.rows.map(r => r.privilege_type));

    // Test: Try with explicit SET ROLE and check current_user
    console.log('\n=== DEBUG CONTEXT ===');
    try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE authenticated');
        await client.query(`SET LOCAL request.jwt.claims = '{"sub": "${userId}", "role": "authenticated"}'`);

        const ctx = await client.query(`
            SELECT current_user, current_role, session_user, 
                   auth.uid() as uid,
                   auth.uid() IS NOT NULL as uid_not_null
        `);
        console.log(ctx.rows[0]);

        // Try the WITH CHECK expression directly
        const checkRes = await client.query('SELECT (auth.uid() IS NOT NULL) as check_result');
        console.log('WITH CHECK evaluates to:', checkRes.rows[0].check_result);

        // Check if there are any RESTRICTIVE policies
        const restrictRes = await client.query(`
            SELECT policyname, permissive, cmd, qual, with_check
            FROM pg_policies
            WHERE tablename = 'conversations' AND permissive = 'RESTRICTIVE';
        `);
        console.log('\nRestrictive policies:', restrictRes.rows.length > 0 ? restrictRes.rows : 'NONE');

        // Check if the policy roles match
        const policyRoles = await client.query(`
            SELECT policyname, cmd, roles
            FROM pg_policies
            WHERE tablename = 'conversations';
        `);
        for (const p of policyRoles.rows) {
            console.log(`Policy "${p.policyname}" (${p.cmd}): roles=${JSON.stringify(p.roles)}`);
        }

        // Try INSERT with explicit column listing
        console.log('\n=== TRYING INSERT ===');
        try {
            const r = await client.query(
                "INSERT INTO conversations (id, type, last_message_at, created_at) VALUES (gen_random_uuid(), 'direct', now(), now()) RETURNING id"
            );
            console.log('SUCCESS:', r.rows[0]);
        } catch (e) {
            console.log('FAILED:', e.message);
            console.log('Detail:', e.detail);
            console.log('Hint:', e.hint);
        }

        await client.query('ROLLBACK');
    } catch (err) {
        console.log('Context setup error:', err.message);
        await client.query('ROLLBACK');
    }

    // Test: Try with a SECURITY DEFINER function
    console.log('\n=== TEST: Direct insert bypassing RLS ===');
    try {
        await client.query('BEGIN');

        // Create a temp function to test
        await client.query(`
            CREATE OR REPLACE FUNCTION public.test_create_conversation()
            RETURNS uuid
            LANGUAGE plpgsql
            SECURITY DEFINER
            AS $$
            DECLARE
                new_id uuid;
            BEGIN
                INSERT INTO conversations (type) VALUES ('direct') RETURNING id INTO new_id;
                RETURN new_id;
            END;
            $$;
        `);

        await client.query('SET LOCAL ROLE authenticated');
        await client.query(`SET LOCAL request.jwt.claims = '{"sub": "${userId}", "role": "authenticated"}'`);

        const funcRes = await client.query('SELECT test_create_conversation() as id');
        console.log('SECURITY DEFINER INSERT SUCCESS:', funcRes.rows[0].id);

        await client.query('ROLLBACK');
    } catch (err) {
        console.log('SECURITY DEFINER test error:', err.message);
        await client.query('ROLLBACK');
    }

    // Cleanup
    await client.query('DROP FUNCTION IF EXISTS public.test_create_conversation()');

    await client.end();
})();
