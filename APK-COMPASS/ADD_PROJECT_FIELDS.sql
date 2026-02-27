-- Run this in Supabase SQL Editor
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS position TEXT,
    ADD COLUMN IF NOT EXISTS max_rate TEXT,
    ADD COLUMN IF NOT EXISTS location TEXT,
    ADD COLUMN IF NOT EXISTS work_type TEXT,
    ADD COLUMN IF NOT EXISTS required_languages TEXT [],
    ADD COLUMN IF NOT EXISTS start_date TEXT,
    ADD COLUMN IF NOT EXISTS recommendation_deadline TEXT,
    ADD COLUMN IF NOT EXISTS manager_name TEXT;