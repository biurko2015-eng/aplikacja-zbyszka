const { Client } = require('pg');
const client = new Client({
    connectionString: 'postgresql://postgres:xBf88BXZtf6QXJPa@db.txzflesacqvlyhxwfjxk.supabase.co:5432/postgres?sslmode=no-verify'
});

(async () => {
    await client.connect();

    const userId = 'd75f1a73-7927-4505-821f-c233b1a378ff';

    // Test 1: Check what auth.uid() returns with different JWT settings
    console.log('=== TEST 1: auth.uid() behavior ===');
    try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE authenticated');
        await client.query(`SET LOCAL request.jwt.claims = '{"sub": "${userId}", "role": "authenticated"}'`);

        const uidRes = await client.query('SELECT auth.uid() as uid, auth.role() as role');
        console.log('auth.uid():', uidRes.rows[0].uid);
        console.log('auth.role():', uidRes.rows[0].role);
        await client.query('ROLLBACK');
    } catch (err) {
        console.log('auth.uid() test failed:', err.message);
        await client.query('ROLLBACK');
    }

    // Test 2: Try with request.jwt.claim.sub directly
    console.log('\n=== TEST 2: with request.jwt.claim.sub ===');
    try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE authenticated');
        await client.query(`SET LOCAL request.jwt.claim.sub = '${userId}'`);
        await client.query(`SET LOCAL request.jwt.claim.role = 'authenticated'`);

        const uidRes = await client.query('SELECT auth.uid() as uid');
        console.log('auth.uid():', uidRes.rows[0].uid);

        const insertResult = await client.query(
            "INSERT INTO conversations (type) VALUES ('direct') RETURNING id"
        );
        console.log('INSERT SUCCESS! ID:', insertResult.rows[0].id);
        await client.query('ROLLBACK');
    } catch (err) {
        console.log('INSERT FAILED:', err.message);
        await client.query('ROLLBACK');
    }

    // Test 3: Check auth.uid() function definition
    console.log('\n=== TEST 3: auth.uid() function definition ===');
    const funcRes = await client.query(`
        SELECT pg_get_functiondef(oid)
        FROM pg_proc
        WHERE proname = 'uid' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth');
    `);
    if (funcRes.rows.length > 0) {
        console.log(funcRes.rows[0].pg_get_functiondef);
    } else {
        console.log('auth.uid() function not found in pg_proc');
    }

    // Test 4: Bypass - try INSERT as postgres (table owner) to confirm data model works
    console.log('\n=== TEST 4: INSERT as postgres (bypassing RLS) ===');
    try {
        await client.query('BEGIN');
        const insertResult = await client.query(
            "INSERT INTO conversations (type) VALUES ('direct') RETURNING id"
        );
        console.log('INSERT as postgres SUCCESS! ID:', insertResult.rows[0].id);
        await client.query('ROLLBACK');
    } catch (err) {
        console.log('INSERT as postgres FAILED:', err.message);
        await client.query('ROLLBACK');
    }

    await client.end();
})();
