-- ============================================
-- HIKVISION BIOMETRIC SYSTEM - DATABASE SCHEMA
-- Ejecutar en el SQL Editor de Supabase
-- ============================================

-- 1. ENUMS
CREATE TYPE person_status AS ENUM ('active', 'inactive', 'pending_sync');
CREATE TYPE device_status AS ENUM ('online', 'offline', 'unknown');
CREATE TYPE user_role AS ENUM ('admin', 'hr_operator', 'supervisor', 'technician');

-- 2. TABLE: profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role user_role NOT NULL DEFAULT 'hr_operator',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TABLE: persons
CREATE TABLE persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT,
  name TEXT NOT NULL,
  department TEXT,
  card_number TEXT,
  face_photo_url TEXT,
  device_employee_no INTEGER,
  status person_status NOT NULL DEFAULT 'pending_sync',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. TABLE: access_events
CREATE TABLE access_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_serial TEXT,
  person_id UUID REFERENCES persons(id) ON DELETE SET NULL,
  employee_id TEXT,
  event_time TIMESTAMPTZ NOT NULL,
  major INTEGER,
  minor INTEGER,
  event_type TEXT NOT NULL,
  verify_mode TEXT,
  raw_payload JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX idx_access_events_event_time ON access_events(event_time DESC);
CREATE INDEX idx_access_events_person_id ON access_events(person_id);
CREATE INDEX idx_access_events_event_type ON access_events(event_type);

-- 5. TABLE: devices
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  serial_number TEXT UNIQUE NOT NULL,
  model TEXT,
  ip_address TEXT,
  firmware_version TEXT,
  status device_status NOT NULL DEFAULT 'unknown',
  last_seen_at TIMESTAMPTZ,
  location TEXT
);

-- 6. TABLE: audit_logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for audit queries
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROFILES POLICIES
-- ============================================

-- Users can read their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Users can update their own profile (except role)
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can manage all profiles
CREATE POLICY "Admins can manage all profiles" ON profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- PERSONS POLICIES
-- ============================================

-- All authenticated users can view persons
CREATE POLICY "Authenticated users can view persons" ON persons
  FOR SELECT USING (auth.role() = 'authenticated');

-- HR Operators and Admins can insert/update persons
CREATE POLICY "HR and Admins can manage persons" ON persons
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'hr_operator')
    )
  );

-- ============================================
-- ACCESS EVENTS POLICIES
-- ============================================

-- All authenticated users can view events
CREATE POLICY "Authenticated users can view events" ON access_events
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only system (service role) can insert events (agent bridge)
CREATE POLICY "System can insert events" ON access_events
  FOR INSERT WITH CHECK (true);

-- ============================================
-- DEVICES POLICIES
-- ============================================

-- All authenticated users can view devices
CREATE POLICY "Authenticated users can view devices" ON devices
  FOR SELECT USING (auth.role() = 'authenticated');

-- Admins and Technicians can manage devices
CREATE POLICY "Admins and Technicians can manage devices" ON devices
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'technician')
    )
  );

-- ============================================
-- AUDIT LOGS POLICIES
-- ============================================

-- All authenticated users can view audit logs (read-only)
CREATE POLICY "Authenticated users can view audit logs" ON audit_logs
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only system can insert audit logs
CREATE POLICY "System can insert audit logs" ON audit_logs
  FOR INSERT WITH CHECK (true);

-- No one can delete or update audit logs (immutability)

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to automatically create profile on signup
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

-- Trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_persons
  BEFORE UPDATE ON persons
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 9. TABLE: sync_config (configuración del cron)
CREATE TABLE IF NOT EXISTS sync_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  enabled BOOLEAN DEFAULT false,
  interval_minutes INTEGER DEFAULT 5,
  options TEXT[] DEFAULT ARRAY['eventos'],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default config
INSERT INTO sync_config (id, enabled, interval_minutes, options) 
VALUES (1, false, 5, ARRAY['eventos'])
ON CONFLICT (id) DO NOTHING;
