-- Add previous_clients column to profiles if missing
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS previous_clients TEXT [] DEFAULT '{}';
-- Add previous_clients column to candidates if missing
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS previous_clients TEXT [] DEFAULT '{}';
-- Force a schema cache reload for PostgREST
NOTIFY pgrst,
'reload config';