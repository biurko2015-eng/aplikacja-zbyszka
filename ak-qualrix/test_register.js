
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

async function testRegister() {
    const email = 'zbigniew.twardowski@b2bnetwork.pl';
    const password = 'KluczoweHaslo2026!';

    console.log(`Checking if ${email} can be registered...`);

    // Attempt sign in first to see if they exist
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: 'wrong-password-to-check-existence'
    });

    if (signInError) {
        console.log('SignIn Error (Expected if checking existence):', signInError.message);
        if (signInError.message.toLowerCase().includes('invalid login credentials')) {
            console.log('User might exist but password is wrong.');
        } else if (signInError.message.toLowerCase().includes('email not confirmed')) {
            console.log('User exists but email is not confirmed.');
        } else {
            console.log('User might not exist.');
        }
    }

    // Try signup
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: 'Zbigniew Twardowski',
                gdpr_consent: true,
                role: 'administrator'
            }
        }
    });

    if (signUpError) {
        console.error('Signup Error:', signUpError.message);
    } else {
        console.log('Signup Successful (or check your email if confirmation is required).');
        console.log('User ID:', signUpData.user?.id);
    }
}

testRegister();
