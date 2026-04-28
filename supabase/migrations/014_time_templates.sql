-- Migration 014: Create time_templates table for attendance schedule templates

CREATE TABLE time_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  schedule_config JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_time_templates_name ON time_templates(name);
CREATE INDEX idx_time_templates_active ON time_templates(is_active);
ALTER TABLE time_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage time_templates" ON time_templates
  FOR ALL USING (auth.role() = 'authenticated');
