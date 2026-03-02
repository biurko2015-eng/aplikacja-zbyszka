
const { Client } = require('pg');

// Password decoded: W10lett@1976Twardowska
const connectionString = 'postgres://postgres.txzflesacqvlyhxwfjxk:W10lett%401976Twardowska@aws-0-eu-central-1.pooler.supabase.com:6543/postgres';

const client = new Client({
    connectionString: connectionString,
});

async function checkAndConfirmUser() {
    const email = 'zbigniew.twardowski@b2bnetwork.pl';
    try {
        console.log('Connecting to database...');
        await client.connect();
        console.log('Connected!');

        // 1. Check user in auth.users
        const res = await client.query('SELECT id, email, confirmed_at, email_confirmed_at FROM auth.users WHERE email = $1', [email]);

        if (res.rows.length === 0) {
            console.log('User not found in auth.users.');
            return;
        }

        const user = res.rows[0];
        console.log('User found in auth.users:', user);

        if (!user.confirmed_at || !user.email_confirmed_at) {
            console.log('Email not confirmed. Confirming now...');
            const now = new Date().toISOString();
            await client.query('UPDATE auth.users SET confirmed_at = $1, email_confirmed_at = $2, last_sign_in_at = $3 WHERE email = $4', [now, now, now, email]);
            console.log('✅ User email confirmed in auth.users.');
        } else {
            console.log('User email is already confirmed.');
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

checkAndConfirmUser();
