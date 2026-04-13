-- Migration: Fix infinite recursion in profiles RLS policies
-- Purpose: Admin check policies caused infinite recursion when checking role
-- Run this in Supabase Dashboard → SQL Editor

-- Drop problematic policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;

-- Create a helper function that bypasses RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  )
$$ LANGUAGE sql SECURITY DEFINER;

-- Recreate policies using the helper function
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (
    auth.uid() = id OR public.is_admin()
  );

CREATE POLICY "Admins can manage all profiles" ON profiles
  FOR ALL USING (
    auth.uid() = id OR public.is_admin()
  );

-- Refresh RLS cache
NOTIFY pgrst, 'reload schema';
