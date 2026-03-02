-- Add missing columns to PROFILES table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS experience_years INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS current_status TEXT DEFAULT 'open',
    ADD COLUMN IF NOT EXISTS capacity_percentage INTEGER DEFAULT 100,
    ADD COLUMN IF NOT EXISTS project_sentiment TEXT [] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS verifier_status TEXT DEFAULT 'not_interested',
    ADD COLUMN IF NOT EXISTS ambassador_status TEXT DEFAULT 'not_interested',
    ADD COLUMN IF NOT EXISTS sales_support_status TEXT DEFAULT 'not_interested',
    ADD COLUMN IF NOT EXISTS bio TEXT;
-- Add missing columns to CANDIDATES table
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS experience_years INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS current_status TEXT,
    ADD COLUMN IF NOT EXISTS capacity_percentage INTEGER,
    ADD COLUMN IF NOT EXISTS project_sentiment TEXT [],
    ADD COLUMN IF NOT EXISTS verifier_status TEXT,
    ADD COLUMN IF NOT EXISTS ambassador_status TEXT,
    ADD COLUMN IF NOT EXISTS sales_support_status TEXT,
    ADD COLUMN IF NOT EXISTS avatar_url TEXT;
-- Verify columns
SELECT column_name,
    table_name
FROM information_schema.columns
WHERE table_name IN ('profiles', 'candidates')
    AND column_name IN (
        'verifier_status',
        'ambassador_status',
        'sales_support_status'
    );