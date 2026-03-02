
const { Client } = require('pg');

const connectionString = 'postgres://postgres.txzflesacqvlyhxwfjxk:W10lett%401976Twardowska@aws-0-eu-central-1.pooler.supabase.com:6543/postgres';

const client = new Client({
    connectionString: connectionString,
});

async function fixProfileId() {
    const email = 'zbigniew.twardowski@b2bnetwork.pl';
    const newId = 'df0edb15-8c84-434d-928f-689348171029';

    try {
        console.log('Connecting to database...');
        await client.connect();
        console.log('Connected!');

        await client.query('BEGIN');

        // 1. Check if the profile exists
        const checkRes = await client.query('SELECT * FROM profiles WHERE email = $1', [email]);
        if (checkRes.rows.length === 0) {
            console.log('No profile found for email:', email);
            await client.query('ROLLBACK');
            return;
        }

        const profile = checkRes.rows[0];
        console.log('Current profile ID:', profile.id);

        if (profile.id === newId) {
            console.log('Profile already has the correct ID.');
            await client.query('ROLLBACK');
            return;
        }

        // 2. We need to check if there are other tables referencing this profile ID
        // In the migration, we saw: candidates(user_id) references auth.users(id)
        // But in fix_db_auto we saw ALTER TABLE candidates ADD COLUMN user_id REFERENCES auth.users(id)

        // Let's try to update candidates first if it exists
        try {
            console.log('Updating candidates.user_id...');
            await client.query('UPDATE candidates SET user_id = $1 WHERE user_id = $2', [newId, profile.id]);
        } catch (e) {
            console.log('Candidates update skipped or failed (might not have candidate record):', e.message);
        }

        console.log(`Updating profile ID from ${profile.id} to ${newId}...`);
        // We use a trick: delete and insert to avoid some primary key update issues in certain environments
        const columns = Object.keys(profile).join(', ');
        const values = Object.values(profile);
        const placeholders = values.map((_, i) => '$' + (i + 1)).join(', ');

        // Update the ID in the profile object
        profile.id = newId;
        const newValues = Object.values(profile);

        console.log('Deleting old profile...');
        await client.query('DELETE FROM profiles WHERE id = $1', [checkRes.rows[0].id]);

        console.log('Inserting new profile...');
        await client.query(`INSERT INTO profiles (${columns}) VALUES (${placeholders})`, newValues);

        await client.query('COMMIT');
        console.log('✅ Profile fixed successfully!');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error fixing profile ID:', err);
    } finally {
        await client.end();
    }
}

fixProfileId();
