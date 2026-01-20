-- Fix database lint errors found during App Store submission review
-- Date: January 20, 2026

-- Drop existing functions first to allow changing return types
DROP FUNCTION IF EXISTS public.check_function_rate_limit_v2(UUID, TEXT);
DROP FUNCTION IF EXISTS public.check_rate_limit_v2(UUID, TEXT);
DROP FUNCTION IF EXISTS public.log_security_event(UUID, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.log_admin_action(UUID, TEXT, TEXT, UUID, JSONB, TEXT, TEXT);

-- ERROR 1: Fix check_function_rate_limit_v2 - column "is_enabled" should be "enabled"
CREATE OR REPLACE FUNCTION public.check_function_rate_limit_v2(
  p_user_id UUID,
  p_function_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config RECORD;
  v_minute_count INTEGER;
  v_hour_count INTEGER;
BEGIN
  -- Get rate limit config for this function
  SELECT max_per_minute, max_per_hour, enabled
  INTO v_config
  FROM public.rate_limit_config
  WHERE function_name = p_function_name;

  -- If no config found or disabled, allow the request
  IF NOT FOUND OR NOT v_config.enabled THEN
    RETURN TRUE;
  END IF;

  -- Count requests in the last minute
  SELECT COUNT(*)
  INTO v_minute_count
  FROM public.rate_limits
  WHERE user_id = p_user_id
    AND function_name = p_function_name
    AND created_at > NOW() - INTERVAL '1 minute';

  -- Check minute limit
  IF v_minute_count >= v_config.max_per_minute THEN
    RETURN FALSE;
  END IF;

  -- Count requests in the last hour
  SELECT COUNT(*)
  INTO v_hour_count
  FROM public.rate_limits
  WHERE user_id = p_user_id
    AND function_name = p_function_name
    AND created_at > NOW() - INTERVAL '1 hour';

  -- Check hour limit
  IF v_hour_count >= v_config.max_per_hour THEN
    RETURN FALSE;
  END IF;

  -- Record this request
  INSERT INTO public.rate_limits (user_id, function_name)
  VALUES (p_user_id, p_function_name);

  RETURN TRUE;
END;
$$;

-- ERROR 2: Fix check_rate_limit_v2 - same issue with is_enabled
CREATE OR REPLACE FUNCTION public.check_rate_limit_v2(
  p_user_id UUID,
  p_action TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config RECORD;
  v_minute_count INTEGER;
  v_hour_count INTEGER;
BEGIN
  -- Get rate limit config
  SELECT max_per_minute, max_per_hour, enabled
  INTO v_config
  FROM public.rate_limit_config
  WHERE function_name = p_action;

  -- If no config or disabled, allow
  IF NOT FOUND OR NOT v_config.enabled THEN
    RETURN TRUE;
  END IF;

  -- Check minute limit
  SELECT COUNT(*)
  INTO v_minute_count
  FROM public.rate_limits
  WHERE user_id = p_user_id
    AND function_name = p_action
    AND created_at > NOW() - INTERVAL '1 minute';

  IF v_minute_count >= v_config.max_per_minute THEN
    RETURN FALSE;
  END IF;

  -- Check hour limit
  SELECT COUNT(*)
  INTO v_hour_count
  FROM public.rate_limits
  WHERE user_id = p_user_id
    AND function_name = p_action
    AND created_at > NOW() - INTERVAL '1 hour';

  IF v_hour_count >= v_config.max_per_hour THEN
    RETURN FALSE;
  END IF;

  -- Log this request
  INSERT INTO public.rate_limits (user_id, function_name)
  VALUES (p_user_id, p_action);

  RETURN TRUE;
END;
$$;

-- WARNING 1 & 2: Fix log_security_event - type casting and unused parameter
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_user_id UUID,
  p_event_type TEXT,
  p_severity TEXT,
  p_details JSONB DEFAULT '{}'::jsonb,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_request_path TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO public.security_events (
    user_id,
    event_type,
    severity,
    details,
    ip_address,
    user_agent,
    request_path
  )
  VALUES (
    p_user_id,
    p_event_type,
    p_severity,
    p_details,
    p_ip_address,
    p_user_agent,
    p_request_path
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

-- WARNING 3: Fix log_admin_action - type casting issue
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_admin_id UUID,
  p_action TEXT,
  p_target_type TEXT DEFAULT NULL,
  p_target_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT '{}'::jsonb,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    user_agent
  )
  VALUES (
    p_admin_id,
    p_action,
    p_target_type,
    p_target_id,
    p_details,
    p_ip_address,
    p_user_agent
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;
