
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

async function checkColumns() {
    console.log('Checking columns for "profiles" table...');
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching profiles:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Columns found in profiles:', Object.keys(data[0]));
    } else {
        console.log('No data found in profiles, checking via another method...');
        // Try to select a non-existent column to see the error message which might list columns
        const { error: error2 } = await supabase.from('profiles').select('non_existent_column_test');
        console.log('PostgREST error hint:', error2?.message);
    }

    console.log('\nChecking columns for "candidates" table...');
    const { data: dataC, error: errorC } = await supabase
        .from('candidates')
        .select('*')
        .limit(1);

    if (errorC) {
        console.error('Error fetching candidates:', errorC);
    } else if (dataC && dataC.length > 0) {
        console.log('Columns found in candidates:', Object.keys(dataC[0]));
    }
}

checkColumns();
