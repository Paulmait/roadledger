-- ============================================
-- RoadLedger Production Hardening Migration
-- ============================================
-- Security constraints, idempotency, audit improvements
-- Created: 2026-01-14
-- ============================================

-- ============================================
-- 1. IDEMPOTENCY: Prevent duplicate transactions per document
-- ============================================

-- Unique index to prevent duplicate transactions for same document
-- This ensures doc_ingest cannot create multiple transactions for the same doc
CREATE UNIQUE INDEX IF NOT EXISTS transactions_unique_doc_type
ON public.transactions(document_id, type)
WHERE document_id IS NOT NULL;

-- ============================================
-- 2. DATA INTEGRITY CONSTRAINTS
-- ============================================

-- Ensure amounts are positive
ALTER TABLE transactions
ADD CONSTRAINT transactions_amount_positive
CHECK (amount >= 0) NOT VALID;

ALTER TABLE transactions VALIDATE CONSTRAINT transactions_amount_positive;

-- Ensure gallons are positive if present
ALTER TABLE transactions
ADD CONSTRAINT transactions_gallons_positive
CHECK (gallons IS NULL OR gallons >= 0) NOT VALID;

ALTER TABLE transactions VALIDATE CONSTRAINT transactions_gallons_positive;

-- Ensure document total_amount is positive if present
ALTER TABLE documents
ADD CONSTRAINT documents_total_positive
CHECK (total_amount IS NULL OR total_amount >= 0) NOT VALID;

ALTER TABLE documents VALIDATE CONSTRAINT documents_total_positive;

-- ============================================
-- 3. SECURITY: Prevent user_id tampering
-- ============================================

-- Trigger to prevent documents.user_id from being changed after creation
CREATE OR REPLACE FUNCTION prevent_user_id_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.user_id IS NOT NULL AND NEW.user_id != OLD.user_id THEN
    RAISE EXCEPTION 'Cannot change user_id after document creation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS prevent_documents_user_change ON documents;
CREATE TRIGGER prevent_documents_user_change
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION prevent_user_id_change();

DROP TRIGGER IF EXISTS prevent_transactions_user_change ON transactions;
CREATE TRIGGER prevent_transactions_user_change
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_user_id_change();

-- ============================================
-- 4. ADDITIONAL INDEXES FOR PERFORMANCE
-- ============================================

-- Index for document list queries (user + status + date)
CREATE INDEX IF NOT EXISTS idx_documents_user_status_date
ON documents(user_id, parsed_status, uploaded_at DESC);

-- Index for transaction list queries (user + date)
CREATE INDEX IF NOT EXISTS idx_transactions_user_date
ON transactions(user_id, date DESC);

-- Index for trip points lookup
CREATE INDEX IF NOT EXISTS idx_trip_points_trip_ts
ON trip_points(trip_id, ts DESC);

-- ============================================
-- 5. RATE LIMITING SUPPORT
-- ============================================

-- Function invocation tracking for rate limiting
CREATE TABLE IF NOT EXISTS function_invocations (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  function_name TEXT NOT NULL,
  invoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_id UUID DEFAULT gen_random_uuid(),
  success BOOLEAN DEFAULT true,
  error_code TEXT,
  elapsed_ms INTEGER
);

-- Index for rate limit checking
CREATE INDEX IF NOT EXISTS idx_function_invocations_rate_limit
ON function_invocations(user_id, function_name, invoked_at DESC);

-- Auto-cleanup old invocation records (keep 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_invocations()
RETURNS void AS $$
BEGIN
  DELETE FROM function_invocations
  WHERE invoked_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Rate limiting check function
CREATE OR REPLACE FUNCTION check_function_rate_limit(
  p_user_id UUID,
  p_function_name TEXT,
  p_max_per_minute INTEGER DEFAULT 10,
  p_max_per_hour INTEGER DEFAULT 100
) RETURNS BOOLEAN AS $$
DECLARE
  v_minute_count INTEGER;
  v_hour_count INTEGER;
BEGIN
  -- Count last minute
  SELECT COUNT(*) INTO v_minute_count
  FROM function_invocations
  WHERE user_id = p_user_id
    AND function_name = p_function_name
    AND invoked_at > NOW() - INTERVAL '1 minute';

  IF v_minute_count >= p_max_per_minute THEN
    RETURN FALSE;
  END IF;

  -- Count last hour
  SELECT COUNT(*) INTO v_hour_count
  FROM function_invocations
  WHERE user_id = p_user_id
    AND function_name = p_function_name
    AND invoked_at > NOW() - INTERVAL '1 hour';

  IF v_hour_count >= p_max_per_hour THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS for function_invocations
ALTER TABLE function_invocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own invocations" ON function_invocations
  FOR SELECT USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "System can insert invocations" ON function_invocations
  FOR INSERT WITH CHECK (true);

-- ============================================
-- 6. DOCUMENT PROCESSING AUDIT
-- ============================================

-- Add processing metadata columns to documents
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS processing_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_error TEXT,
ADD COLUMN IF NOT EXISTS ai_provider TEXT; -- 'openai', 'anthropic'

-- ============================================
-- 7. INPUT VALIDATION HELPERS
-- ============================================

-- Function to validate UUID format
CREATE OR REPLACE FUNCTION is_valid_uuid(input TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN input ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- 8. SAFE LOGGING (redact sensitive data)
-- ============================================

-- Create a sanitized audit view for admin monitoring
CREATE OR REPLACE VIEW admin_document_audit AS
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

-- Grant access to admin view
GRANT SELECT ON admin_document_audit TO authenticated;
