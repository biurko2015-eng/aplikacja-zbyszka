-- Add previous_clients column to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS previous_clients TEXT [] DEFAULT '{}';
-- Add previous_clients column to candidates
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS previous_clients TEXT [] DEFAULT '{}';