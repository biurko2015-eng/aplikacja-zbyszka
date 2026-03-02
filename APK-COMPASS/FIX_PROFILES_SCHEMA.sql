-- Add skills column to profiles if missing (it was likely only on candidates before)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS skills TEXT [] DEFAULT '{}';
-- Ensure previous_clients is there too
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS previous_clients TEXT [] DEFAULT '{}';
-- Ensure candidates table has skills too (just in case)
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS skills TEXT [] DEFAULT '{}';
-- Force a schema cache reload for PostgREST
NOTIFY pgrst,
'reload config';