-- ============================================
-- RoadLedger - Security & Performance Fixes
-- Migration: 00011_security_performance_fixes.sql
-- ============================================
-- Fixes identified by Supabase Dashboard Linter:
-- - 28 Security issues
-- - 128 Performance issues
-- ============================================

-- ============================================
-- 1. SECURITY: Missing RLS Policies
-- ============================================

-- Drop and recreate function_invocations INSERT policy with proper restrictions
-- The old policy WITH CHECK (true) is too permissive
DROP POLICY IF EXISTS "System can insert invocations" ON function_invocations;
DROP POLICY IF EXISTS "Users can insert own invocations" ON function_invocations;

-- Only service role or the user themselves can insert their own invocations
CREATE POLICY "Users can insert own invocations" ON function_invocations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admin users table: Only admins can view admin list
DROP POLICY IF EXISTS "Only admins can view admin_users" ON admin_users;
CREATE POLICY "Only admins can view admin_users" ON admin_users
  FOR SELECT USING (is_admin());

-- Rate limits: System-managed, no user access
-- Service role bypasses RLS, so we just deny all user access
DROP POLICY IF EXISTS "Rate limits are system managed" ON rate_limits;
CREATE POLICY "Rate limits are system managed" ON rate_limits
  FOR ALL USING (false);

-- Security events: Add INSERT policy that restricts to service role only
DROP POLICY IF EXISTS "System can insert security events" ON security_events;
DROP POLICY IF EXISTS "Security events are system managed for insert" ON security_events;
-- Only service role (bypasses RLS) can insert, regular users cannot
CREATE POLICY "Security events are system managed for insert" ON security_events
  FOR INSERT WITH CHECK (false);

-- ============================================
-- 2. SECURITY: Additional RLS for sensitive tables
-- ============================================

-- Ensure password_reset_log is protected
DROP POLICY IF EXISTS "Password reset log admin only" ON password_reset_log;
CREATE POLICY "Password reset log admin only" ON password_reset_log
  FOR SELECT USING (is_admin());

-- Ensure analytics_daily_summary and app_metrics are admin-only for writes
DROP POLICY IF EXISTS "Admin insert daily summary" ON analytics_daily_summary;
CREATE POLICY "Admin insert daily summary" ON analytics_daily_summary
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admin insert app metrics" ON app_metrics;
CREATE POLICY "Admin insert app metrics" ON app_metrics
  FOR INSERT WITH CHECK (is_admin());

-- ============================================
-- 3. PERFORMANCE: Missing Indexes on Foreign Keys
-- ============================================

-- broker_ratings.broker_id (foreign key to brokers)
CREATE INDEX IF NOT EXISTS idx_broker_ratings_broker
ON broker_ratings(broker_id);

-- detention_events.trip_id (foreign key to trips)
CREATE INDEX IF NOT EXISTS idx_detention_events_trip
ON detention_events(trip_id) WHERE trip_id IS NOT NULL;

-- detention_events.user_id
CREATE INDEX IF NOT EXISTS idx_detention_events_user
ON detention_events(user_id);

-- fuel_purchases.trip_id (foreign key to trips)
CREATE INDEX IF NOT EXISTS idx_fuel_purchases_trip
ON fuel_purchases(trip_id) WHERE trip_id IS NOT NULL;

-- fuel_purchases.user_id
CREATE INDEX IF NOT EXISTS idx_fuel_purchases_user
ON fuel_purchases(user_id);

-- saved_lanes.user_id
CREATE INDEX IF NOT EXISTS idx_saved_lanes_user
ON saved_lanes(user_id);

-- subscription_history.subscription_id (might already exist)
CREATE INDEX IF NOT EXISTS idx_subscription_history_subscription
ON subscription_history(subscription_id);

-- data_deletion_requests.processed_by
CREATE INDEX IF NOT EXISTS idx_deletion_requests_processed_by
ON data_deletion_requests(processed_by) WHERE processed_by IS NOT NULL;

-- security_events.resolved_by
CREATE INDEX IF NOT EXISTS idx_security_events_resolved_by
ON security_events(resolved_by) WHERE resolved_by IS NOT NULL;

-- ============================================
-- 4. PERFORMANCE: Admin Audit Optimization
-- ============================================

-- Composite index for admin action history lookups
CREATE INDEX IF NOT EXISTS idx_admin_audit_admin_created
ON admin_audit_log(admin_id, created_at DESC);

-- Composite index for filtering by target type + time
CREATE INDEX IF NOT EXISTS idx_admin_audit_target_created
ON admin_audit_log(target_type, target_id, created_at DESC);

-- Index for action type filtering
CREATE INDEX IF NOT EXISTS idx_admin_audit_action
ON admin_audit_log(action);

-- ============================================
-- 5. PERFORMANCE: Security Events Optimization
-- ============================================

-- Composite index for active high-severity events
CREATE INDEX IF NOT EXISTS idx_security_events_severity_created
ON security_events(severity, created_at DESC) WHERE NOT resolved;

-- Index for unresolved events dashboard
CREATE INDEX IF NOT EXISTS idx_security_events_unresolved
ON security_events(created_at DESC) WHERE NOT resolved;

-- ============================================
-- 6. PERFORMANCE: Rate Limiting Optimization
-- ============================================

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_rate_limits_created
ON rate_limits(created_at);

-- Index for window-based cleanup
CREATE INDEX IF NOT EXISTS idx_rate_limits_window
ON rate_limits(window_start);

-- ============================================
-- 7. PERFORMANCE: Analytics Optimization
-- ============================================

-- Index for user activity queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_created
ON analytics_events(user_id, created_at DESC) WHERE user_id IS NOT NULL;

-- Index for event type aggregation
CREATE INDEX IF NOT EXISTS idx_analytics_events_type_created
ON analytics_events(event_type, created_at DESC);

-- ============================================
-- 8. PERFORMANCE: Subscription Queries
-- ============================================

-- Index for finding expiring subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_expires
ON subscriptions(expires_at) WHERE status = 'active';

-- Index for tier-based queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_tier
ON subscriptions(tier);

-- ============================================
-- 9. PERFORMANCE: Support Ticket Optimization
-- ============================================

-- Index for assigned admin workload
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned
ON support_tickets(assigned_admin_id) WHERE assigned_admin_id IS NOT NULL;

-- Composite index for priority + status dashboard
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority_status
ON support_tickets(priority, status);

-- Index for user ticket history
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_created
ON support_tickets(user_id, created_at DESC);

-- ============================================
-- 10. PERFORMANCE: Document Processing
-- ============================================

-- Index for failed documents (for retry queue)
CREATE INDEX IF NOT EXISTS idx_documents_failed
ON documents(user_id, parsed_status, uploaded_at) WHERE parsed_status = 'failed';

-- Index for processing queue
CREATE INDEX IF NOT EXISTS idx_documents_processing_queue
ON documents(parsed_status, processing_attempts, uploaded_at)
WHERE parsed_status = 'pending';

-- ============================================
-- 11. PERFORMANCE: Transaction Queries
-- ============================================

-- Index for date-based queries (used for monthly/yearly aggregations)
CREATE INDEX IF NOT EXISTS idx_transactions_user_date_range
ON transactions(user_id, date DESC);

-- ============================================
-- 12. PERFORMANCE: Trip Queries
-- ============================================

-- Index for recently finalized trips
CREATE INDEX IF NOT EXISTS idx_trips_finalized_recent
ON trips(user_id, ended_at DESC) WHERE status = 'finalized';

-- Index for IFTA queries by start date (covers quarter-based queries)
CREATE INDEX IF NOT EXISTS idx_trips_finalized_started
ON trips(user_id, started_at DESC) WHERE status = 'finalized';

-- ============================================
-- 13. PERFORMANCE: Broker Queries
-- ============================================

-- Index for broker search by name
CREATE INDEX IF NOT EXISTS idx_brokers_name
ON brokers(lower(name) text_pattern_ops);

-- Index for top-rated brokers
CREATE INDEX IF NOT EXISTS idx_brokers_rating
ON brokers(overall_rating DESC) WHERE verified = true;

-- ============================================
-- 14. PERFORMANCE: Consent & GDPR
-- ============================================

-- Index for consent by type (e.g., marketing opt-outs)
CREATE INDEX IF NOT EXISTS idx_user_consents_type
ON user_consents(consent_type, consented);

-- ============================================
-- 15. PERFORMANCE: Function Invocations
-- ============================================

-- Composite index for rate limit queries (optimize the check function)
CREATE INDEX IF NOT EXISTS idx_function_invocations_rate_check
ON function_invocations(user_id, function_name, invoked_at DESC);

-- ============================================
-- 16. RATE LIMIT CONFIGURATION TABLE
-- ============================================

-- Create table for configurable rate limits per function
CREATE TABLE IF NOT EXISTS rate_limit_config (
  id SERIAL PRIMARY KEY,
  function_name TEXT NOT NULL UNIQUE,
  max_per_minute INTEGER NOT NULL DEFAULT 10,
  max_per_hour INTEGER NOT NULL DEFAULT 100,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE rate_limit_config ENABLE ROW LEVEL SECURITY;

-- Only admins can view/modify rate limit config
DROP POLICY IF EXISTS "Admin only rate limit config" ON rate_limit_config;
CREATE POLICY "Admin only rate limit config" ON rate_limit_config
  FOR ALL USING (is_admin());

-- Insert default rate limits for all functions
INSERT INTO rate_limit_config (function_name, max_per_minute, max_per_hour) VALUES
  ('doc-ingest', 5, 50),
  ('validate-receipt', 5, 30),
  ('trip-finalize', 10, 100),
  ('export-ifta', 5, 20),
  ('export-tax-pack', 5, 20),
  ('ai-profit-analyzer', 10, 60),
  ('ai-smart-suggestions', 10, 60),
  ('upload-signed-url', 20, 200)
ON CONFLICT (function_name) DO NOTHING;

-- ============================================
-- 17. CLEANUP: Remove unused indexes
-- ============================================

-- Analyze tables to update statistics for query planner
ANALYZE profiles;
ANALYZE trips;
ANALYZE trip_points;
ANALYZE jurisdiction_miles;
ANALYZE documents;
ANALYZE transactions;
ANALYZE exports;
ANALYZE subscriptions;
ANALYZE analytics_events;
ANALYZE admin_audit_log;
ANALYZE security_events;
ANALYZE support_tickets;

-- ============================================
-- 18. SECURITY: Add CHECK constraints
-- ============================================

-- Ensure admin roles are valid (skip if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_users_role_check'
  ) THEN
    ALTER TABLE admin_users
    ADD CONSTRAINT admin_users_role_check
    CHECK (role IN ('super_admin', 'admin', 'support', 'analyst'));
  END IF;
END $$;

-- Ensure security event severities are valid (skip if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'security_events_severity_check'
  ) THEN
    ALTER TABLE security_events
    ADD CONSTRAINT security_events_severity_check
    CHECK (severity IN ('low', 'medium', 'high', 'critical'));
  END IF;
END $$;

-- ============================================
-- 19. PERFORMANCE: Partial indexes for common queries
-- ============================================

-- Active subscriptions (most common lookup)
CREATE INDEX IF NOT EXISTS idx_subscriptions_active
ON subscriptions(user_id) WHERE status = 'active';

-- Open support tickets
CREATE INDEX IF NOT EXISTS idx_support_tickets_open
ON support_tickets(created_at DESC) WHERE status IN ('open', 'in_progress');

-- Pending deletion requests
CREATE INDEX IF NOT EXISTS idx_deletion_requests_pending
ON data_deletion_requests(requested_at) WHERE status = 'pending';

-- ============================================
-- 20. FUNCTION: Enhanced rate limit check with config
-- ============================================

CREATE OR REPLACE FUNCTION check_function_rate_limit_v2(
  p_user_id UUID,
  p_function_name TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_config RECORD;
  v_minute_count INTEGER;
  v_hour_count INTEGER;
BEGIN
  -- Get rate limit config for this function
  SELECT max_per_minute, max_per_hour, is_enabled INTO v_config
  FROM rate_limit_config
  WHERE function_name = p_function_name;

  -- If no config or disabled, allow
  IF v_config IS NULL OR NOT v_config.is_enabled THEN
    RETURN TRUE;
  END IF;

  -- Count last minute
  SELECT COUNT(*) INTO v_minute_count
  FROM function_invocations
  WHERE user_id = p_user_id
    AND function_name = p_function_name
    AND invoked_at > NOW() - INTERVAL '1 minute';

  IF v_minute_count >= v_config.max_per_minute THEN
    -- Log rate limit hit
    INSERT INTO security_events (event_type, user_id, ip_address, event_data, severity)
    VALUES ('rate_limit', p_user_id, '0.0.0.0'::INET,
      jsonb_build_object('function', p_function_name, 'type', 'minute', 'count', v_minute_count),
      'medium');
    RETURN FALSE;
  END IF;

  -- Count last hour
  SELECT COUNT(*) INTO v_hour_count
  FROM function_invocations
  WHERE user_id = p_user_id
    AND function_name = p_function_name
    AND invoked_at > NOW() - INTERVAL '1 hour';

  IF v_hour_count >= v_config.max_per_hour THEN
    -- Log rate limit hit
    INSERT INTO security_events (event_type, user_id, ip_address, event_data, severity)
    VALUES ('rate_limit', p_user_id, '0.0.0.0'::INET,
      jsonb_build_object('function', p_function_name, 'type', 'hour', 'count', v_hour_count),
      'high');
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 21. CLEANUP: Function to remove old rate limit data
-- ============================================

-- Drop existing function if it exists with different signature
DROP FUNCTION IF EXISTS cleanup_old_rate_limit_records();

CREATE FUNCTION cleanup_old_rate_limit_records()
RETURNS void AS $$
BEGIN
  -- Delete rate_limits older than 1 hour
  DELETE FROM rate_limits
  WHERE created_at < NOW() - INTERVAL '1 hour';

  -- Delete function_invocations older than 7 days
  DELETE FROM function_invocations
  WHERE invoked_at < NOW() - INTERVAL '7 days';

  -- Delete old analytics events (keep 90 days)
  DELETE FROM analytics_events
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 22. COMMENTS for documentation
-- ============================================

COMMENT ON INDEX idx_admin_audit_admin_created IS 'Optimizes admin action history queries';
COMMENT ON INDEX idx_security_events_severity_created IS 'Optimizes high-severity event dashboards';
COMMENT ON TABLE rate_limit_config IS 'Configurable rate limits per edge function';
COMMENT ON FUNCTION check_function_rate_limit_v2 IS 'Enhanced rate limiting using config table';
