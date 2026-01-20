-- ============================================
-- RoadLedger - Fix Security Definer View
-- Migration: 00012_fix_security_definer_view.sql
-- ============================================
-- Fixes: View public.admin_document_audit is defined with SECURITY DEFINER
-- Solution: Recreate view with SECURITY INVOKER (default, safer option)
-- ============================================

-- Drop the existing view
DROP VIEW IF EXISTS admin_document_audit;

-- Recreate with SECURITY INVOKER (explicit for clarity)
-- This ensures RLS policies of the querying user are enforced
CREATE VIEW admin_document_audit
WITH (security_invoker = true)
AS
SELECT
  d.id,
  d.user_id,
  d.type,
  d.parsed_status,
  d.ai_provider,
  d.processing_attempts,
  d.processing_started_at,
  d.processing_completed_at,
  d.uploaded_at,
  -- Redact sensitive data
  CASE WHEN d.vendor IS NOT NULL THEN LEFT(d.vendor, 3) || '***' ELSE NULL END as vendor_redacted,
  CASE WHEN d.total_amount IS NOT NULL THEN 'PRESENT' ELSE 'NULL' END as has_amount,
  CASE WHEN d.last_error IS NOT NULL THEN LEFT(d.last_error, 50) ELSE NULL END as error_preview
FROM documents d;

-- Grant access to authenticated users (RLS on documents table will filter results)
GRANT SELECT ON admin_document_audit TO authenticated;

-- Add comment explaining the security model
COMMENT ON VIEW admin_document_audit IS 'Admin view for document audit - uses SECURITY INVOKER so RLS policies on documents table are enforced for the querying user';
