-- TEMPORARY FIX: Disable RLS on candidates table for testing
-- This allows us to test CV upload while we debug the RLS issue
-- WARNING: This should ONLY be used in development, not production!
ALTER TABLE candidates DISABLE ROW LEVEL SECURITY;
-- Verify RLS is disabled
SELECT tablename,
    rowsecurity
FROM pg_tables
WHERE tablename = 'candidates';
-- This should show rowsecurity = false