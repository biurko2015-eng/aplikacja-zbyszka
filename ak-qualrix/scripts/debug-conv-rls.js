const { Client } = require('pg');
const client = new Client({
    connectionString: 'postgresql://postgres:xBf88BXZtf6QXJPa@db.txzflesacqvlyhxwfjxk.supabase.co:5432/postgres?sslmode=no-verify'
});

(async () => {
    await client.connect();

    // 1. Check ALL policies
    const res = await client.query(`
        SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
        FROM pg_policies
        WHERE tablename = 'conversations'
        ORDER BY policyname;
    `);
    console.log('=== ALL POLICIES ON conversations ===');
    for (const row of res.rows) {
        console.log(`Policy: ${row.policyname}`);
        console.log(`  CMD: ${row.cmd}, Permissive: ${row.permissive}, Roles: ${row.roles}`);
        console.log(`  USING: ${row.qual}`);
        console.log(`  WITH CHECK: ${row.with_check}`);
        console.log('---');
    }

    // 2. Check if RLS is enabled
    const rlsRes = await client.query(`
        SELECT relname, relrowsecurity, relforcerowsecurity
        FROM pg_class
        WHERE relname = 'conversations';
    `);
    console.log('\n=== RLS STATUS ===');
    console.log(rlsRes.rows[0]);

    // 3. Test INSERT as authenticated role with a real user ID
    const userRes = await client.query(`
        SELECT id FROM auth.users WHERE email = 'zbigniew.twardowski@b2bnetwork.pl' LIMIT 1;
    `);
    const userId = userRes.rows[0]?.id;
    console.log('\nUser ID for test:', userId);

    if (userId) {
        console.log('\n=== TESTING INSERT as authenticated ===');
        try {
            await client.query('BEGIN');
            await client.query('SET LOCAL ROLE authenticated');
            await client.query(`SET LOCAL request.jwt.claims = '{"sub": "${userId}", "role": "authenticated"}'`);

            const insertResult = await client.query(
                "INSERT INTO conversations (type) VALUES ('direct') RETURNING id"
            );
            console.log('INSERT SUCCESS! ID:', insertResult.rows[0].id);
            await client.query('ROLLBACK');
        } catch (err) {
            console.log('INSERT FAILED:', err.message);
            await client.query('ROLLBACK');
        }
    }

    // 4. Force PostgREST reload
    console.log('\n=== FORCE PGRST RELOAD ===');
    await client.query("NOTIFY pgrst, 'reload schema'");
    await client.query("NOTIFY pgrst, 'reload config'");
    console.log('NOTIFY sent');

    await client.end();
})();
