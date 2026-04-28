-- Migration 017: Create attendance_overrides table for manual attendance corrections

CREATE TABLE attendance_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_attendance_overrides_person ON attendance_overrides(person_id);
CREATE INDEX idx_attendance_overrides_date ON attendance_overrides(date);
ALTER TABLE attendance_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage attendance_overrides" ON attendance_overrides
  FOR ALL USING (auth.role() = 'authenticated');
