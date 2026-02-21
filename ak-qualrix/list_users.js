
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load env vars
const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const supabase = createClient(
    envConfig.NEXT_PUBLIC_SUPABASE_URL,
    envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function listUsers() {
    console.log('Listing users from "profiles" table...');
    const { data, error } = await supabase
        .from('profiles')
        .select('email, role, full_name')
        .limit(10);

    if (error) {
        console.error('Error fetching profiles:', error);
        return;
    }

    if (data && data.length > 0) {
        console.table(data);
    } else {
        console.log('No users found in profiles.');
    }
}

listUsers();
