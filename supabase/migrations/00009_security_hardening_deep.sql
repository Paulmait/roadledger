-- ============================================
-- RoadLedger Security Hardening Deep Pass
-- ============================================
-- Migration: 00009_security_hardening_deep.sql
-- Red-team style security enhancements
-- Created: 2026-01-14
-- ============================================

-- ============================================
-- 1. ADDITIONAL NOT NULL CONSTRAINTS
-- ============================================

-- Ensure storage_path is never null (documents)
ALTER TABLE documents
ALTER COLUMN storage_path SET NOT NULL;

-- Ensure amount is never null (transactions)
ALTER TABLE transactions
ALTER COLUMN amount SET NOT NULL;

-- ============================================
-- 2. TEXT LENGTH CONSTRAINTS
-- ============================================

-- Prevent extremely long text in user-controlled fields
ALTER TABLE documents
ADD CONSTRAINT documents_vendor_max_length
CHECK (vendor IS NULL OR length(vendor) <= 500);

ALTER TABLE documents
ADD CONSTRAINT documents_raw_text_max_length
CHECK (raw_text IS NULL OR length(raw_text) <= 500000);

ALTER TABLE transactions
ADD CONSTRAINT transactions_vendor_max_length
CHECK (vendor IS NULL OR length(vendor) <= 500);

ALTER TABLE transactions
ADD CONSTRAINT transactions_description_max_length
CHECK (description IS NULL OR length(description) <= 2000);

ALTER TABLE trips
ADD CONSTRAINT trips_notes_max_length
CHECK (notes IS NULL OR length(notes) <= 5000);

-- ============================================
-- 3. ADDITIONAL SECURITY INDEXES
-- ============================================

-- Fast lookup for ownership verification (documents)
CREATE INDEX IF NOT EXISTS idx_documents_user_id_id
ON documents(user_id, id);

-- Fast lookup for ownership verification (trips)
CREATE INDEX IF NOT EXISTS idx_trips_user_id_id
ON trips(user_id, id);

-- Fast lookup for ownership verification (transactions)
CREATE INDEX IF NOT EXISTS idx_transactions_user_id_id
ON transactions(user_id, id);

-- Fast rate limit lookups
CREATE INDEX IF NOT EXISTS idx_function_invocations_user_function_time
ON function_invocations(user_id, function_name, invoked_at DESC);

-- ============================================
-- 4. ENHANCED RATE LIMITING
-- ============================================

-- More granular rate limit configuration
CREATE TABLE IF NOT EXISTS rate_limit_config (
  id SERIAL PRIMARY KEY,
  function_name TEXT NOT NULL UNIQUE,
  max_per_minute INTEGER NOT NULL DEFAULT 10,
  max_per_hour INTEGER NOT NULL DEFAULT 100,
  max_per_day INTEGER NOT NULL DEFAULT 500,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default rate limits
INSERT INTO rate_limit_config (function_name, max_per_minute, max_per_hour, max_per_day)
VALUES
  ('doc-ingest', 5, 50, 200),
  ('upload-signed-url', 20, 200, 1000),
  ('validate-receipt', 5, 30, 100),
  ('trip-finalize', 10, 100, 500),
  ('export-ifta', 3, 20, 50),
  ('export-tax-pack', 3, 20, 50),
  ('ai-profit-analyzer', 10, 100, 500),
  ('ai-smart-suggestions', 10, 100, 500)
ON CONFLICT (function_name) DO NOTHING;

-- Enhanced rate limit check with daily limit
CREATE OR REPLACE FUNCTION check_rate_limit_v2(
  p_user_id UUID,
  p_function_name TEXT
) RETURNS TABLE (
  allowed BOOLEAN,
  retry_after_seconds INTEGER,
  reason TEXT
) AS $$
DECLARE
  v_config rate_limit_config%ROWTYPE;
  v_minute_count INTEGER;
  v_hour_count INTEGER;
  v_day_count INTEGER;
BEGIN
  -- Get config
  SELECT * INTO v_config
  FROM rate_limit_config
  WHERE function_name = p_function_name;

  -- If no config or disabled, allow
  IF NOT FOUND OR NOT v_config.enabled THEN
    RETURN QUERY SELECT true, 0, NULL::TEXT;
    RETURN;
  END IF;

  -- Count last minute
  SELECT COUNT(*) INTO v_minute_count
  FROM function_invocations
  WHERE user_id = p_user_id
    AND function_name = p_function_name
    AND invoked_at > NOW() - INTERVAL '1 minute';

  IF v_minute_count >= v_config.max_per_minute THEN
    RETURN QUERY SELECT false, 60, 'Rate limit exceeded (per minute)'::TEXT;
    RETURN;
  END IF;

  -- Count last hour
  SELECT COUNT(*) INTO v_hour_count
  FROM function_invocations
  WHERE user_id = p_user_id
    AND function_name = p_function_name
    AND invoked_at > NOW() - INTERVAL '1 hour';

  IF v_hour_count >= v_config.max_per_hour THEN
    RETURN QUERY SELECT false, 3600, 'Rate limit exceeded (per hour)'::TEXT;
    RETURN;
  END IF;

  -- Count last day
  SELECT COUNT(*) INTO v_day_count
  FROM function_invocations
  WHERE user_id = p_user_id
    AND function_name = p_function_name
    AND invoked_at > NOW() - INTERVAL '1 day';

  IF v_day_count >= v_config.max_per_day THEN
    RETURN QUERY SELECT false, 86400, 'Rate limit exceeded (per day)'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, 0, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. SECURITY AUDIT LOG
-- ============================================

CREATE TABLE IF NOT EXISTS security_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  user_id UUID,
  ip_address TEXT,
  user_agent TEXT,
  request_path TEXT,
  details JSONB,
  severity TEXT NOT NULL DEFAULT 'info', -- info, warning, critical
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_events_type_time
ON security_events(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_events_user_time
ON security_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_events_severity_time
ON security_events(severity, created_at DESC);

-- Function to log security events
CREATE OR REPLACE FUNCTION log_security_event(
  p_event_type TEXT,
  p_user_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT NULL,
  p_severity TEXT DEFAULT 'info',
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_request_path TEXT DEFAULT NULL
) RETURNS BIGINT AS $$
DECLARE
  v_id BIGINT;
BEGIN
  INSERT INTO security_events (
    event_type, user_id, details, severity,
    ip_address, user_agent, request_path
  )
  VALUES (
    p_event_type, p_user_id, p_details, p_severity,
    p_ip_address, p_user_agent, p_request_path
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS for security_events (admin only)
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only admins can view security events" ON security_events;
CREATE POLICY "Only admins can view security events"
ON security_events FOR SELECT
USING (is_admin());

DROP POLICY IF EXISTS "System can insert security events" ON security_events;
CREATE POLICY "System can insert security events"
ON security_events FOR INSERT
WITH CHECK (true);

-- ============================================
-- 6. DOCUMENT PROCESSING LOCK
-- ============================================

-- Prevent concurrent processing of same document
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS processing_lock_id UUID,
ADD COLUMN IF NOT EXISTS processing_lock_expires TIMESTAMPTZ;

-- Function to acquire processing lock
CREATE OR REPLACE FUNCTION acquire_document_lock(
  p_document_id UUID,
  p_lock_duration_seconds INTEGER DEFAULT 300
) RETURNS BOOLEAN AS $$
DECLARE
  v_lock_id UUID := gen_random_uuid();
BEGIN
  UPDATE documents
  SET
    processing_lock_id = v_lock_id,
    processing_lock_expires = NOW() + (p_lock_duration_seconds || ' seconds')::INTERVAL
  WHERE id = p_document_id
    AND (processing_lock_id IS NULL OR processing_lock_expires < NOW());

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to release processing lock
CREATE OR REPLACE FUNCTION release_document_lock(
  p_document_id UUID
) RETURNS VOID AS $$
BEGIN
  UPDATE documents
  SET
    processing_lock_id = NULL,
    processing_lock_expires = NULL
  WHERE id = p_document_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. CLEANUP FUNCTIONS
-- ============================================

-- Clean up old rate limit records (run daily via cron)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limit_records()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM function_invocations
  WHERE invoked_at < NOW() - INTERVAL '7 days';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  -- Log cleanup
  PERFORM log_security_event('rate_limit_cleanup', NULL,
    jsonb_build_object('deleted_count', v_deleted), 'info');

  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clean up old security events (run weekly)
CREATE OR REPLACE FUNCTION cleanup_old_security_events()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM security_events
  WHERE created_at < NOW() - INTERVAL '90 days'
    AND severity = 'info';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. TRANSACTION FRAUD DETECTION
-- ============================================

-- Flag for suspicious transactions
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS flagged BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS flag_reason TEXT;

-- Function to detect suspicious patterns
CREATE OR REPLACE FUNCTION check_transaction_anomaly(
  p_user_id UUID,
  p_amount NUMERIC,
  p_category txn_category
) RETURNS TABLE (
  is_suspicious BOOLEAN,
  reason TEXT
) AS $$
DECLARE
  v_avg_amount NUMERIC;
  v_max_amount NUMERIC;
  v_daily_count INTEGER;
BEGIN
  -- Get user's average for this category
  SELECT AVG(amount), MAX(amount)
  INTO v_avg_amount, v_max_amount
  FROM transactions
  WHERE user_id = p_user_id
    AND category = p_category
    AND created_at > NOW() - INTERVAL '90 days';

  -- Check if amount is abnormally high (>5x average or >2x max)
  IF v_avg_amount IS NOT NULL AND p_amount > v_avg_amount * 5 THEN
    RETURN QUERY SELECT true, 'Amount significantly above average'::TEXT;
    RETURN;
  END IF;

  IF v_max_amount IS NOT NULL AND p_amount > v_max_amount * 2 THEN
    RETURN QUERY SELECT true, 'Amount significantly above historical max'::TEXT;
    RETURN;
  END IF;

  -- Check daily transaction velocity
  SELECT COUNT(*) INTO v_daily_count
  FROM transactions
  WHERE user_id = p_user_id
    AND created_at > NOW() - INTERVAL '24 hours';

  IF v_daily_count > 50 THEN
    RETURN QUERY SELECT true, 'High transaction velocity'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT false, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 9. INPUT SANITIZATION HELPERS
-- ============================================

-- Function to sanitize text for storage
CREATE OR REPLACE FUNCTION sanitize_text(
  p_text TEXT,
  p_max_length INTEGER DEFAULT 10000
) RETURNS TEXT AS $$
BEGIN
  IF p_text IS NULL THEN
    RETURN NULL;
  END IF;

  -- Remove control characters (except newlines/tabs)
  p_text := regexp_replace(p_text, E'[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]', '', 'g');

  -- Truncate to max length
  IF length(p_text) > p_max_length THEN
    p_text := substring(p_text, 1, p_max_length);
  END IF;

  RETURN p_text;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- 10. RLS POLICY FOR NEW TABLES
-- ============================================

-- Rate limit config is admin-only
ALTER TABLE rate_limit_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only admins can manage rate limit config" ON rate_limit_config;
CREATE POLICY "Only admins can manage rate limit config"
ON rate_limit_config FOR ALL
USING (is_admin());
