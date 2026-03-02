-- Verify RLS Policies and Table Structure
-- 1. Check if user_id column exists in candidates table
SELECT column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'candidates'
    AND column_name = 'user_id';
-- 2. List all RLS policies on candidates table
SELECT schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'candidates';
-- 3. Check if RLS is enabled on candidates table
SELECT tablename,
    rowsecurity
FROM pg_tables
WHERE tablename = 'candidates';