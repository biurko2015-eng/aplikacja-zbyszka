
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

async function testLogin() {
    const email = 'konsultant@b2bnetwork.pl';
    const password = 'Password123!';

    console.log(`Testing login for ${email}...`);

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        console.error('Login Error:', error.message);
        console.error('Error Code:', error.code || error.status);
    } else {
        console.log('Login Successful!');
        console.log('Session user ID:', data.user?.id);
    }
}

testLogin();
