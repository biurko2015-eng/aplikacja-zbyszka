-- Fix RLS Policy for Candidates Table
-- This fixes the "new row violates row-level security policy" error when uploading CV
-- Step 1: Add user_id column to candidates table (if not exists)
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
-- Step 2: Create index for performance
CREATE INDEX IF NOT EXISTS idx_candidates_user_id ON candidates(user_id);
-- Step 3: Drop existing user policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can insert their own candidate record" ON candidates;
DROP POLICY IF EXISTS "Users can update their own candidate record" ON candidates;
DROP POLICY IF EXISTS "Users can view their own candidate record" ON candidates;
-- Step 4: Create policies for authenticated users to manage their own records
-- Allow users to INSERT their own candidate record (linked by user_id)
CREATE POLICY "Users can insert their own candidate record" ON candidates FOR
INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
-- Allow users to UPDATE their own candidate record (linked by user_id)
CREATE POLICY "Users can update their own candidate record" ON candidates FOR
UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- Allow users to VIEW their own candidate record (linked by user_id)
CREATE POLICY "Users can view their own candidate record" ON candidates FOR
SELECT TO authenticated USING (auth.uid() = user_id);
-- Note: The existing "Admins can manage candidates" policy remains in place for admin access