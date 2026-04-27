-- Migration: Fix auth trigger RLS bypass for profile creation
-- Problem: handle_new_user() trigger fails with "Database error saving new user"
-- because RLS policies on profiles table block the auth trigger INSERT

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Recreate the function with proper security attributes
-- SECURITY DEFINER makes it run as the function owner, not the caller
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'hr_operator')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Drop any conflicting profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;
DROP POLICY IF EXISTS "Auth trigger can insert profiles" ON profiles;

-- Create a permissive policy that allows all INSERT operations
-- This is the key fix - the trigger's INSERT must pass the RLS check
CREATE POLICY "Allow all inserts on profiles" ON profiles
  FOR INSERT WITH CHECK (true);

-- Recreate view policies (for logged-in users)
CREATE POLICY "Authenticated users can view profiles" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Recreate admin helper and admin policies
DROP FUNCTION IF EXISTS public.is_admin();

CREATE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  )
$$ LANGUAGE sql SECURITY DEFINER;

CREATE POLICY "Admins can manage all profiles" ON profiles
  FOR ALL USING (public.is_admin());

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
