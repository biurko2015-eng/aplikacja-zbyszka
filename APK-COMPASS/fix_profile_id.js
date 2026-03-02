
const { Client } = require('pg');

const connectionString = 'postgres://postgres.txzflesacqvlyhxwfjxk:W10lett%401976Twardowska@aws-0-eu-central-1.pooler.supabase.com:6543/postgres';

const client = new Client({
    connectionString: connectionString,
});

async function fixProfileId() {
    const email = 'zbigniew.twardowski@b2bnetwork.pl';
    const newId = 'df0edb15-8c84-434d-928f-689348171029'; // The ID from my successful signup
    const oldId = 'd75f1a73-7927-4505-821f-c233b1a378ff'; // The ID currently in the profiles table

    try {
        console.log('Connecting to database...');
        await client.connect();
        console.log('Connected!');

        // 1. Check if the profile exists
        const checkRes = await client.query('SELECT * FROM profiles WHERE email = $1', [email]);
        if (checkRes.rows.length === 0) {
            console.log('No profile found for email:', email);
            return;
        }

        const profile = checkRes.rows[0];
        console.log('Current profile ID:', profile.id);

        if (profile.id === newId) {
            console.log('Profile already has the correct ID.');
            return;
        }

        // 2. Update the profile ID. 
        // Note: profiles.id is the primary key and references auth.users(id).
        // Since we already created the new user in auth.users, this reference will be valid.
        console.log(`Updating profile ID from ${profile.id} to ${newId}...`);

        // We might need to use a transaction if there are other dependent tables.
        // For now, let's try a simple update.
        await client.query('UPDATE profiles SET id = $1 WHERE email = $2', [newId, email]);

        console.log('✅ Profile ID updated successfully!');

    } catch (err) {
        console.error('Error fixing profile ID:', err);
    } finally {
        await client.end();
    }
}

fixProfileId();
