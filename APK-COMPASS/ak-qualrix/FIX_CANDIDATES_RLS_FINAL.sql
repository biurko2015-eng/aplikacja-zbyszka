-- FINAL FIX for Candidates RLS Policy
-- This completely resets and fixes all RLS policies for the candidates table
-- Step 1: Add user_id column if it doesn't exist
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
-- Step 2: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_candidates_user_id ON candidates(user_id);
CREATE INDEX IF NOT EXISTS idx_candidates_email ON candidates(email);
-- Step 3: DISABLE RLS temporarily to clean up
ALTER TABLE candidates DISABLE ROW LEVEL SECURITY;
-- Step 4: DROP ALL existing policies (to avoid conflicts)
DROP POLICY IF EXISTS "Admins can manage candidates" ON candidates;
DROP POLICY IF EXISTS "Users can insert their own candidate record" ON candidates;
DROP POLICY IF EXISTS "Users can update their own candidate record" ON candidates;
DROP POLICY IF EXISTS "Users can view their own candidate record" ON candidates;
-- Step 5: RE-ENABLE RLS
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
-- Step 6: Create NEW policies in correct order
-- Policy 1: Admins have full access (most permissive first)
CREATE POLICY "Admins can manage candidates" ON candidates FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1
        FROM profiles
        WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
    )
) WITH CHECK (
    EXISTS (
        SELECT 1
        FROM profiles
        WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
    )
);
-- Policy 2: Users can SELECT their own candidate record
CREATE POLICY "Users can view their own candidate record" ON candidates FOR
SELECT TO authenticated USING (user_id = auth.uid());
-- Policy 3: Users can INSERT their own candidate record
CREATE POLICY "Users can insert their own candidate record" ON candidates FOR
INSERT TO authenticated WITH CHECK (user_id = auth.uid());
-- Policy 4: Users can UPDATE their own candidate record
CREATE POLICY "Users can update their own candidate record" ON candidates FOR
UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- Step 7: Verify the setup
SELECT 'Policies created:' as status,
    COUNT(*) as policy_count
FROM pg_policies
WHERE tablename = 'candidates';
-- Show all policies
SELECT policyname,
    cmd,
    roles
FROM pg_policies
WHERE tablename = 'candidates'
ORDER BY policyname;