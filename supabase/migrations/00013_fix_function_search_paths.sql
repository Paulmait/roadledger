-- ============================================
-- RoadLedger - Fix Function Search Paths
-- Migration: 00013_fix_function_search_paths.sql
-- ============================================
-- Fixes: 25 functions with mutable search_path
-- Solution: Add SET search_path = '' to all functions
-- ============================================

-- ============================================
-- 1. update_updated_at_column (from 00001)
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- ============================================
-- 2. calculate_trip_miles (from 00001)
-- ============================================
CREATE OR REPLACE FUNCTION public.calculate_trip_miles(p_trip_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  total_miles NUMERIC;
BEGIN
  SELECT COALESCE(SUM(miles), 0)
  INTO total_miles
  FROM public.jurisdiction_miles
  WHERE trip_id = p_trip_id;

  RETURN total_miles;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- ============================================
-- 3. get_ifta_quarter (from 00001)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_ifta_quarter(p_date DATE)
RETURNS TEXT AS $$
BEGIN
  RETURN EXTRACT(YEAR FROM p_date)::TEXT || '-Q' || CEIL(EXTRACT(MONTH FROM p_date) / 3)::TEXT;
END;
$$ LANGUAGE plpgsql IMMUTABLE
SET search_path = '';

-- ============================================
-- 4. is_admin (from 00005)
-- ============================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE id = auth.uid()
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- ============================================
-- 5. get_admin_role (from 00005)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_admin_role()
RETURNS public.admin_role AS $$
DECLARE
  user_role public.admin_role;
BEGIN
  SELECT role INTO user_role FROM public.admin_users
  WHERE id = auth.uid() AND is_active = true;
  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- ============================================
-- 6. update_daily_analytics_summary (from 00005)
-- ============================================
CREATE OR REPLACE FUNCTION public.update_daily_analytics_summary()
RETURNS void AS $$
DECLARE
  target_date DATE := CURRENT_DATE;
BEGIN
  INSERT INTO public.analytics_daily_summary (
    date,
    total_users,
    active_users,
    new_users,
    free_users,
    pro_users,
    premium_users,
    total_trips,
    total_miles,
    total_revenue,
    total_expenses,
    documents_uploaded,
    exports_generated
  )
  SELECT
    target_date,
    (SELECT COUNT(*) FROM public.profiles),
    (SELECT COUNT(DISTINCT user_id) FROM public.analytics_events WHERE created_at >= target_date),
    (SELECT COUNT(*) FROM public.profiles WHERE DATE(created_at) = target_date),
    (SELECT COUNT(*) FROM public.profiles WHERE subscription_tier = 'free'),
    (SELECT COUNT(*) FROM public.profiles WHERE subscription_tier = 'pro'),
    (SELECT COUNT(*) FROM public.profiles WHERE subscription_tier = 'premium'),
    (SELECT COUNT(*) FROM public.trips WHERE DATE(created_at) = target_date),
    COALESCE((SELECT SUM(auto_miles_total) FROM public.trips WHERE DATE(created_at) = target_date), 0),
    COALESCE((SELECT SUM(amount) FROM public.transactions WHERE type = 'income' AND date = target_date), 0),
    COALESCE((SELECT SUM(amount) FROM public.transactions WHERE type = 'expense' AND date = target_date), 0),
    (SELECT COUNT(*) FROM public.documents WHERE DATE(uploaded_at) = target_date),
    (SELECT COUNT(*) FROM public.exports WHERE DATE(created_at) = target_date)
  ON CONFLICT (date) DO UPDATE SET
    total_users = EXCLUDED.total_users,
    active_users = EXCLUDED.active_users,
    new_users = EXCLUDED.new_users,
    free_users = EXCLUDED.free_users,
    pro_users = EXCLUDED.pro_users,
    premium_users = EXCLUDED.premium_users,
    total_trips = EXCLUDED.total_trips,
    total_miles = EXCLUDED.total_miles,
    total_revenue = EXCLUDED.total_revenue,
    total_expenses = EXCLUDED.total_expenses,
    documents_uploaded = EXCLUDED.documents_uploaded,
    exports_generated = EXCLUDED.exports_generated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- ============================================
-- 7. log_admin_action (from 00006)
-- ============================================
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_admin_id UUID,
  p_action TEXT,
  p_target_type TEXT,
  p_target_id UUID,
  p_details JSONB,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.admin_audit_log (
    admin_id,
    action,
    target_type,
    target_id,
    details,
    ip_address,
    user_agent,
    created_at
  ) VALUES (
    p_admin_id,
    p_action,
    p_target_type,
    p_target_id,
    p_details,
    p_ip_address,
    p_user_agent,
    NOW()
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- ============================================
-- 8. check_rate_limit (from 00006)
-- ============================================
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier TEXT,
  p_endpoint TEXT,
  p_max_requests INTEGER DEFAULT 100,
  p_window_seconds INTEGER DEFAULT 60
) RETURNS BOOLEAN AS $$
DECLARE
  v_count INTEGER;
  v_window_start TIMESTAMPTZ;
BEGIN
  v_window_start := NOW() - (p_window_seconds || ' seconds')::INTERVAL;

  DELETE FROM public.rate_limits
  WHERE window_start < v_window_start;

  SELECT COALESCE(SUM(request_count), 0) INTO v_count
  FROM public.rate_limits
  WHERE identifier = p_identifier
    AND endpoint = p_endpoint
    AND window_start >= v_window_start;

  IF v_count >= p_max_requests THEN
    INSERT INTO public.security_events (event_type, ip_address, event_data, severity)
    VALUES ('rate_limit', p_identifier::INET,
      jsonb_build_object('endpoint', p_endpoint, 'count', v_count),
      'medium');
    RETURN false;
  END IF;

  INSERT INTO public.rate_limits (identifier, endpoint, window_start)
  VALUES (p_identifier, p_endpoint, NOW());

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- ============================================
-- 9. record_user_consent (from 00006)
-- ============================================
CREATE OR REPLACE FUNCTION public.record_user_consent(
  p_user_id UUID,
  p_consent_type TEXT,
  p_version TEXT,
  p_consented BOOLEAN,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_consent_id UUID;
BEGIN
  INSERT INTO public.user_consents (
    user_id,
    consent_type,
    version,
    consented,
    ip_address,
    user_agent,
    consented_at
  ) VALUES (
    p_user_id,
    p_consent_type,
    p_version,
    p_consented,
    p_ip_address,
    p_user_agent,
    NOW()
  )
  ON CONFLICT (user_id, consent_type)
  DO UPDATE SET
    version = EXCLUDED.version,
    consented = EXCLUDED.consented,
    ip_address = EXCLUDED.ip_address,
    user_agent = EXCLUDED.user_agent,
    consented_at = NOW(),
    withdrawn_at = CASE WHEN EXCLUDED.consented = false THEN NOW() ELSE NULL END
  RETURNING id INTO v_consent_id;

  RETURN v_consent_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- ============================================
-- 10. update_broker_ratings (from 00007)
-- ============================================
CREATE OR REPLACE FUNCTION public.update_broker_ratings()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.brokers SET
    overall_rating = (
      SELECT AVG(overall_rating) FROM public.broker_ratings WHERE broker_id = NEW.broker_id
    ),
    total_ratings = (
      SELECT COUNT(*) FROM public.broker_ratings WHERE broker_id = NEW.broker_id
    ),
    payment_speed_avg = (
      SELECT AVG(payment_speed) FROM public.broker_ratings WHERE broker_id = NEW.broker_id AND payment_speed IS NOT NULL
    ),
    communication_avg = (
      SELECT AVG(communication) FROM public.broker_ratings WHERE broker_id = NEW.broker_id AND communication IS NOT NULL
    ),
    load_accuracy_avg = (
      SELECT AVG(load_accuracy) FROM public.broker_ratings WHERE broker_id = NEW.broker_id AND load_accuracy IS NOT NULL
    ),
    would_work_again_pct = (
      SELECT (COUNT(*) FILTER (WHERE would_work_again = true)::NUMERIC / NULLIF(COUNT(*) FILTER (WHERE would_work_again IS NOT NULL), 0)) * 100
      FROM public.broker_ratings WHERE broker_id = NEW.broker_id
    ),
    avg_days_to_pay = (
      SELECT AVG(days_to_pay) FROM public.broker_ratings WHERE broker_id = NEW.broker_id AND days_to_pay IS NOT NULL
    ),
    updated_at = NOW()
  WHERE id = NEW.broker_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- ============================================
-- 11. prevent_user_id_change (from 00008)
-- ============================================
CREATE OR REPLACE FUNCTION public.prevent_user_id_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.user_id IS NOT NULL AND NEW.user_id != OLD.user_id THEN
    RAISE EXCEPTION 'Cannot change user_id after document creation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- ============================================
-- 12. cleanup_old_invocations (from 00008)
-- ============================================
CREATE OR REPLACE FUNCTION public.cleanup_old_invocations()
RETURNS void AS $$
BEGIN
  DELETE FROM public.function_invocations
  WHERE invoked_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- ============================================
-- 13. check_function_rate_limit (from 00008)
-- ============================================
CREATE OR REPLACE FUNCTION public.check_function_rate_limit(
  p_user_id UUID,
  p_function_name TEXT,
  p_max_per_minute INTEGER DEFAULT 10,
  p_max_per_hour INTEGER DEFAULT 100
) RETURNS BOOLEAN AS $$
DECLARE
  v_minute_count INTEGER;
  v_hour_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_minute_count
  FROM public.function_invocations
  WHERE user_id = p_user_id
    AND function_name = p_function_name
    AND invoked_at > NOW() - INTERVAL '1 minute';

  IF v_minute_count >= p_max_per_minute THEN
    RETURN FALSE;
  END IF;

  SELECT COUNT(*) INTO v_hour_count
  FROM public.function_invocations
  WHERE user_id = p_user_id
    AND function_name = p_function_name
    AND invoked_at > NOW() - INTERVAL '1 hour';

  IF v_hour_count >= p_max_per_hour THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- ============================================
-- 14. is_valid_uuid (from 00008)
-- ============================================
CREATE OR REPLACE FUNCTION public.is_valid_uuid(input TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN input ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql IMMUTABLE
SET search_path = '';

-- ============================================
-- 15. check_rate_limit_v2 (from 00009)
-- ============================================
CREATE OR REPLACE FUNCTION public.check_rate_limit_v2(
  p_user_id UUID,
  p_function_name TEXT
) RETURNS TABLE (
  allowed BOOLEAN,
  retry_after_seconds INTEGER,
  reason TEXT
) AS $$
DECLARE
  v_config public.rate_limit_config%ROWTYPE;
  v_minute_count INTEGER;
  v_hour_count INTEGER;
  v_day_count INTEGER;
BEGIN
  SELECT * INTO v_config
  FROM public.rate_limit_config
  WHERE function_name = p_function_name;

  IF NOT FOUND OR NOT v_config.is_enabled THEN
    RETURN QUERY SELECT true, 0, NULL::TEXT;
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_minute_count
  FROM public.function_invocations
  WHERE user_id = p_user_id
    AND function_name = p_function_name
    AND invoked_at > NOW() - INTERVAL '1 minute';

  IF v_minute_count >= v_config.max_per_minute THEN
    RETURN QUERY SELECT false, 60, 'Rate limit exceeded (per minute)'::TEXT;
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_hour_count
  FROM public.function_invocations
  WHERE user_id = p_user_id
    AND function_name = p_function_name
    AND invoked_at > NOW() - INTERVAL '1 hour';

  IF v_hour_count >= v_config.max_per_hour THEN
    RETURN QUERY SELECT false, 3600, 'Rate limit exceeded (per hour)'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, 0, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- ============================================
-- 16. log_security_event (from 00009)
-- ============================================
CREATE OR REPLACE FUNCTION public.log_security_event(
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
  INSERT INTO public.security_events (
    event_type, user_id, event_data, severity,
    ip_address, user_agent
  )
  VALUES (
    p_event_type, p_user_id, p_details, p_severity,
    CASE WHEN p_ip_address IS NOT NULL THEN p_ip_address::INET ELSE NULL END,
    p_user_agent
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- ============================================
-- 17. acquire_document_lock (from 00009)
-- ============================================
CREATE OR REPLACE FUNCTION public.acquire_document_lock(
  p_document_id UUID,
  p_lock_duration_seconds INTEGER DEFAULT 300
) RETURNS BOOLEAN AS $$
DECLARE
  v_lock_id UUID := gen_random_uuid();
BEGIN
  UPDATE public.documents
  SET
    processing_lock_id = v_lock_id,
    processing_lock_expires = NOW() + (p_lock_duration_seconds || ' seconds')::INTERVAL
  WHERE id = p_document_id
    AND (processing_lock_id IS NULL OR processing_lock_expires < NOW());

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- ============================================
-- 18. release_document_lock (from 00009)
-- ============================================
CREATE OR REPLACE FUNCTION public.release_document_lock(
  p_document_id UUID
) RETURNS VOID AS $$
BEGIN
  UPDATE public.documents
  SET
    processing_lock_id = NULL,
    processing_lock_expires = NULL
  WHERE id = p_document_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- ============================================
-- 19. cleanup_old_security_events (from 00009)
-- ============================================
CREATE OR REPLACE FUNCTION public.cleanup_old_security_events()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.security_events
  WHERE created_at < NOW() - INTERVAL '90 days'
    AND severity = 'info';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- ============================================
-- 20. check_transaction_anomaly (from 00009)
-- ============================================
CREATE OR REPLACE FUNCTION public.check_transaction_anomaly(
  p_user_id UUID,
  p_amount NUMERIC,
  p_category public.txn_category
) RETURNS TABLE (
  is_suspicious BOOLEAN,
  reason TEXT
) AS $$
DECLARE
  v_avg_amount NUMERIC;
  v_max_amount NUMERIC;
  v_daily_count INTEGER;
BEGIN
  SELECT AVG(amount), MAX(amount)
  INTO v_avg_amount, v_max_amount
  FROM public.transactions
  WHERE user_id = p_user_id
    AND category = p_category
    AND created_at > NOW() - INTERVAL '90 days';

  IF v_avg_amount IS NOT NULL AND p_amount > v_avg_amount * 5 THEN
    RETURN QUERY SELECT true, 'Amount significantly above average'::TEXT;
    RETURN;
  END IF;

  IF v_max_amount IS NOT NULL AND p_amount > v_max_amount * 2 THEN
    RETURN QUERY SELECT true, 'Amount significantly above historical max'::TEXT;
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_daily_count
  FROM public.transactions
  WHERE user_id = p_user_id
    AND created_at > NOW() - INTERVAL '24 hours';

  IF v_daily_count > 50 THEN
    RETURN QUERY SELECT true, 'High transaction velocity'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT false, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- ============================================
-- 21. sanitize_text (from 00009)
-- ============================================
CREATE OR REPLACE FUNCTION public.sanitize_text(
  p_text TEXT,
  p_max_length INTEGER DEFAULT 10000
) RETURNS TEXT AS $$
BEGIN
  IF p_text IS NULL THEN
    RETURN NULL;
  END IF;

  p_text := regexp_replace(p_text, E'[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]', '', 'g');

  IF length(p_text) > p_max_length THEN
    p_text := substring(p_text, 1, p_max_length);
  END IF;

  RETURN p_text;
END;
$$ LANGUAGE plpgsql IMMUTABLE
SET search_path = '';

-- ============================================
-- 22. handle_new_user (from 00010)
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- ============================================
-- 23. update_last_login (from 00010)
-- ============================================
CREATE OR REPLACE FUNCTION public.update_last_login(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles
  SET last_login = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- ============================================
-- 24. check_function_rate_limit_v2 (from 00011)
-- ============================================
CREATE OR REPLACE FUNCTION public.check_function_rate_limit_v2(
  p_user_id UUID,
  p_function_name TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_config RECORD;
  v_minute_count INTEGER;
  v_hour_count INTEGER;
BEGIN
  SELECT max_per_minute, max_per_hour, is_enabled INTO v_config
  FROM public.rate_limit_config
  WHERE function_name = p_function_name;

  IF v_config IS NULL OR NOT v_config.is_enabled THEN
    RETURN TRUE;
  END IF;

  SELECT COUNT(*) INTO v_minute_count
  FROM public.function_invocations
  WHERE user_id = p_user_id
    AND function_name = p_function_name
    AND invoked_at > NOW() - INTERVAL '1 minute';

  IF v_minute_count >= v_config.max_per_minute THEN
    INSERT INTO public.security_events (event_type, user_id, ip_address, event_data, severity)
    VALUES ('rate_limit', p_user_id, '0.0.0.0'::INET,
      jsonb_build_object('function', p_function_name, 'type', 'minute', 'count', v_minute_count),
      'medium');
    RETURN FALSE;
  END IF;

  SELECT COUNT(*) INTO v_hour_count
  FROM public.function_invocations
  WHERE user_id = p_user_id
    AND function_name = p_function_name
    AND invoked_at > NOW() - INTERVAL '1 hour';

  IF v_hour_count >= v_config.max_per_hour THEN
    INSERT INTO public.security_events (event_type, user_id, ip_address, event_data, severity)
    VALUES ('rate_limit', p_user_id, '0.0.0.0'::INET,
      jsonb_build_object('function', p_function_name, 'type', 'hour', 'count', v_hour_count),
      'high');
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- ============================================
-- 25. cleanup_old_rate_limit_records (from 00011)
-- ============================================
DROP FUNCTION IF EXISTS public.cleanup_old_rate_limit_records();
CREATE FUNCTION public.cleanup_old_rate_limit_records()
RETURNS void AS $$
BEGIN
  DELETE FROM public.rate_limits
  WHERE created_at < NOW() - INTERVAL '1 hour';

  DELETE FROM public.function_invocations
  WHERE invoked_at < NOW() - INTERVAL '7 days';

  DELETE FROM public.analytics_events
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- ============================================
-- Verify all functions have search_path set
-- ============================================
COMMENT ON FUNCTION public.update_updated_at_column IS 'Trigger function to update updated_at timestamp - search_path secured';
COMMENT ON FUNCTION public.is_admin IS 'Check if current user is an admin - search_path secured';
COMMENT ON FUNCTION public.check_function_rate_limit IS 'Rate limit checker for edge functions - search_path secured';
