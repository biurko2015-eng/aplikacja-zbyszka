
const { Client } = require('pg');

const connectionString = 'postgres://postgres.txzflesacqvlyhxwfjxk:W10lett%401976Twardowska@aws-0-eu-central-1.pooler.supabase.com:6543/postgres';

const client = new Client({
    connectionString: connectionString,
    connectionTimeoutMillis: 10000,
});

async function runFix() {
    const email = 'zbigniew.twardowski@b2bnetwork.pl';
    try {
        console.log('Connecting to database...');
        await client.connect();
        console.log('Connected!');

        const now = new Date().toISOString();
        const res = await client.query(
            'UPDATE auth.users SET confirmed_at = $1, email_confirmed_at = $2 WHERE email = $3 RETURNING id',
            [now, now, email]
        );

        if (res.rowCount > 0) {
            console.log(`✅ User ${email} confirmed! ID: ${res.rows[0].id}`);
        } else {
            console.log('❌ User not found in auth.users.');
        }

    } catch (err) {
        console.error('Database Error:', err.message);
    } finally {
        await client.end();
    }
}

runFix();
