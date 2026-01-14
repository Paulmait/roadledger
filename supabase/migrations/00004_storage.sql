-- RoadLedger Storage Configuration
-- Migration: 00004_storage.sql
-- Description: Create storage buckets and policies

-- ============================================
-- CREATE STORAGE BUCKETS
-- ============================================

-- Create receipts bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  false,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- Create settlements bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'settlements',
  'settlements',
  false,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- Create exports bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'exports',
  'exports',
  false,
  52428800, -- 50MB limit for export bundles
  ARRAY['application/pdf', 'application/zip']
) ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STORAGE POLICIES FOR RECEIPTS BUCKET
-- ============================================

-- Users can upload to their own folder in receipts bucket
CREATE POLICY "Users can upload receipts to own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'receipts' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can view their own receipts
CREATE POLICY "Users can view own receipts"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'receipts' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can update their own receipts
CREATE POLICY "Users can update own receipts"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'receipts' AND
    (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'receipts' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own receipts
CREATE POLICY "Users can delete own receipts"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'receipts' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================
-- STORAGE POLICIES FOR SETTLEMENTS BUCKET
-- ============================================

-- Users can upload to their own folder in settlements bucket
CREATE POLICY "Users can upload settlements to own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'settlements' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can view their own settlements
CREATE POLICY "Users can view own settlements"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'settlements' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can update their own settlements
CREATE POLICY "Users can update own settlements"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'settlements' AND
    (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'settlements' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own settlements
CREATE POLICY "Users can delete own settlements"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'settlements' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================
-- STORAGE POLICIES FOR EXPORTS BUCKET
-- ============================================

-- Users can upload to their own folder in exports bucket
CREATE POLICY "Users can upload exports to own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'exports' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can view their own exports
CREATE POLICY "Users can view own exports"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'exports' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own exports
CREATE POLICY "Users can delete own exports"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'exports' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
