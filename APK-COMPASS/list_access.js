
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

async function listAccessLists() {
    console.log('--- admin_access_list ---');
    const { data: adminList, error: errorA } = await supabase.from('admin_access_list').select('*');
    if (errorA) console.error(errorA); else console.table(adminList);

    console.log('--- centrala_access_list ---');
    const { data: centralaList, error: errorC } = await supabase.from('centrala_access_list').select('*');
    if (errorC) console.error(errorC); else console.table(centralaList);
}

listAccessLists();
