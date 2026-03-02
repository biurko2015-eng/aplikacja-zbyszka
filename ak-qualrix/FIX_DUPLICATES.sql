-- Add user_id column to candidates table to link with auth.users/profiles
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_candidates_user_id ON candidates(user_id);
-- Force schema cache reload
NOTIFY pgrst,
'reload config';