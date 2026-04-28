-- Migration 015: Create schedule_assignments table for linking persons to time templates

CREATE TABLE schedule_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  time_template_id UUID NOT NULL REFERENCES time_templates(id),
  valid_from DATE NOT NULL,
  valid_to DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_schedule_assignments_person ON schedule_assignments(person_id);
CREATE INDEX idx_schedule_assignments_template ON schedule_assignments(time_template_id);
ALTER TABLE schedule_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage schedule_assignments" ON schedule_assignments
  FOR ALL USING (auth.role() = 'authenticated');
