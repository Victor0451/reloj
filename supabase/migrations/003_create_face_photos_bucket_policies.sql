-- Migration: Create face-photos storage bucket + RLS policies
-- Purpose: Enable photo upload for person face photos
-- Run this in Supabase Dashboard → SQL Editor
-- Note: The bucket itself must be created via Dashboard UI first (Storage → New Bucket → "face-photos", private)

-- ─── Storage RLS Policies ─────────────────────────────────────────

-- Authenticated users can upload photos to face-photos bucket
CREATE POLICY "Users can upload face photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'face-photos'
    AND auth.role() = 'authenticated'
  );

-- Authenticated users can view photos in face-photos bucket
CREATE POLICY "Users can view face photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'face-photos'
    AND auth.role() = 'authenticated'
  );

-- Only admins can delete photos from face-photos bucket
CREATE POLICY "Admins can delete face photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'face-photos'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Unique partial index on employee_id (prevent duplicates, allow NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS idx_persons_employee_id
  ON persons(employee_id)
  WHERE employee_id IS NOT NULL;
