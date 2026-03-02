-- Add avatar_url to candidates if it doesn't exist
alter table candidates
add column if not exists avatar_url text;
-- Also ensure profiles has it (it should, but good to be safe)
alter table profiles
add column if not exists avatar_url text;