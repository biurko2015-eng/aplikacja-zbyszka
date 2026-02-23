const { Client } = require('pg');
const client = new Client({
    connectionString: 'postgresql://postgres:xBf88BXZtf6QXJPa@db.txzflesacqvlyhxwfjxk.supabase.co:5432/postgres?sslmode=no-verify'
});

(async () => {
    await client.connect();
    const userId = 'd75f1a73-7927-4505-821f-c233b1a378ff';

    // Test 1: Drop and recreate with `true`
    console.log('=== RECREATING INSERT POLICY WITH true ===');
    await client.query('DROP POLICY IF EXISTS "Users can create conversations" ON conversations');
    await client.query(`
        CREATE POLICY "Users can create conversations"
        ON conversations
        FOR INSERT
        TO authenticated
        WITH CHECK (true)
    `);
    console.log('Policy recreated with TO authenticated and WITH CHECK (true)');

    // Verify
    const pRes = await client.query(`
        SELECT policyname, roles, cmd, with_check
        FROM pg_policies WHERE tablename = 'conversations' AND cmd = 'INSERT'
    `);
    console.log('New policy:', pRes.rows[0]);

    // Test INSERT
    try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE authenticated');
        await client.query(`SET LOCAL request.jwt.claims = '{"sub": "${userId}", "role": "authenticated"}'`);

        const r = await client.query("INSERT INTO conversations (type) VALUES ('direct') RETURNING id");
        console.log('INSERT SUCCESS:', r.rows[0].id);
        await client.query('ROLLBACK');
    } catch (err) {
        console.log('INSERT FAILED:', err.message);
        await client.query('ROLLBACK');

        // If still fails, check if maybe the SELECT policy is being evaluated for RETURNING clause
        console.log('\n=== TEST WITHOUT RETURNING ===');
        try {
            await client.query('BEGIN');
            await client.query('SET LOCAL ROLE authenticated');
            await client.query(`SET LOCAL request.jwt.claims = '{"sub": "${userId}", "role": "authenticated"}'`);

            await client.query("INSERT INTO conversations (type) VALUES ('direct')");
            console.log('INSERT WITHOUT RETURNING: SUCCESS');
            await client.query('ROLLBACK');
        } catch (err2) {
            console.log('INSERT WITHOUT RETURNING: FAILED:', err2.message);
            await client.query('ROLLBACK');
        }
    }

    // Also fix conversation_participants INSERT policy
    console.log('\n=== FIXING conversation_participants INSERT ===');
    await client.query('DROP POLICY IF EXISTS "Users can add participants" ON conversation_participants');
    await client.query(`
        CREATE POLICY "Users can add participants"
        ON conversation_participants
        FOR INSERT
        TO authenticated
        WITH CHECK (true)
    `);
    console.log('conversation_participants INSERT policy fixed');

    // Test participants INSERT
    try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE authenticated');
        await client.query(`SET LOCAL request.jwt.claims = '{"sub": "${userId}", "role": "authenticated"}'`);

        // First insert conversation as postgres
        await client.query('SET LOCAL ROLE postgres');
        const conv = await client.query("INSERT INTO conversations (type) VALUES ('direct') RETURNING id");
        const convId = conv.rows[0].id;

        // Now try inserting participant as authenticated
        await client.query('SET LOCAL ROLE authenticated');
        await client.query(`SET LOCAL request.jwt.claims = '{"sub": "${userId}", "role": "authenticated"}'`);

        await client.query(
            "INSERT INTO conversation_participants (conversation_id, user_id, role) VALUES ($1, $2, 'member')",
            [convId, userId]
        );
        console.log('PARTICIPANT INSERT: SUCCESS');
        await client.query('ROLLBACK');
    } catch (err) {
        console.log('PARTICIPANT INSERT FAILED:', err.message);
        await client.query('ROLLBACK');
    }

    await client.query("NOTIFY pgrst, 'reload schema'");
    console.log('\nDone, PostgREST notified');

    await client.end();
})();
