-- Final fix for database lint errors
-- Date: January 20, 2026
-- This migration ensures functions match actual table schemas

-- First, let's add missing columns to rate_limits table if they don't exist
DO $$
BEGIN
  -- Add user_id column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'rate_limits' AND column_name = 'user_id') THEN
    ALTER TABLE public.rate_limits ADD COLUMN user_id UUID;
  END IF;

  -- Add function_name column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'rate_limits' AND column_name = 'function_name') THEN
    ALTER TABLE public.rate_limits ADD COLUMN function_name TEXT;
  END IF;
END $$;

-- Ensure security_events has correct schema with TEXT for ip_address and details column
DO $$
BEGIN
  -- Check if details column exists, if not add it
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'security_events' AND column_name = 'details') THEN
    ALTER TABLE public.security_events ADD COLUMN details JSONB;
  END IF;

  -- Check if request_path column exists, if not add it
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'security_events' AND column_name = 'request_path') THEN
    ALTER TABLE public.security_events ADD COLUMN request_path TEXT;
  END IF;
END $$;

-- Alter ip_address column type if it's INET (need to change to TEXT for flexibility)
-- This is safe because TEXT can store INET values as strings
DO $$
DECLARE
  col_type TEXT;
BEGIN
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'security_events' AND column_name = 'ip_address';

  IF col_type = 'inet' THEN
    ALTER TABLE public.security_events ALTER COLUMN ip_address TYPE TEXT USING ip_address::TEXT;
    ALTER TABLE public.security_events ALTER COLUMN ip_address DROP NOT NULL;
  END IF;
END $$;

-- Drop and recreate functions with correct types

-- Function 1: check_function_rate_limit_v2
DROP FUNCTION IF EXISTS public.check_function_rate_limit_v2(UUID, TEXT);
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
  IF NOT FOUND OR NOT COALESCE(v_config.enabled, false) THEN
    RETURN TRUE;
  END IF;

  -- Count requests in the last minute using user_id column
  SELECT COUNT(*)
  INTO v_minute_count
  FROM public.rate_limits
  WHERE user_id = p_user_id
    AND function_name = p_function_name
    AND created_at > NOW() - INTERVAL '1 minute';

  -- Check minute limit
  IF v_minute_count >= COALESCE(v_config.max_per_minute, 60) THEN
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
  IF v_hour_count >= COALESCE(v_config.max_per_hour, 1000) THEN
    RETURN FALSE;
  END IF;

  -- Record this request
  INSERT INTO public.rate_limits (user_id, function_name, created_at)
  VALUES (p_user_id, p_function_name, NOW());

  RETURN TRUE;
END;
$$;

-- Function 2: check_rate_limit_v2
DROP FUNCTION IF EXISTS public.check_rate_limit_v2(UUID, TEXT);
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
  IF NOT FOUND OR NOT COALESCE(v_config.enabled, false) THEN
    RETURN TRUE;
  END IF;

  -- Check minute limit
  SELECT COUNT(*)
  INTO v_minute_count
  FROM public.rate_limits
  WHERE user_id = p_user_id
    AND function_name = p_action
    AND created_at > NOW() - INTERVAL '1 minute';

  IF v_minute_count >= COALESCE(v_config.max_per_minute, 60) THEN
    RETURN FALSE;
  END IF;

  -- Check hour limit
  SELECT COUNT(*)
  INTO v_hour_count
  FROM public.rate_limits
  WHERE user_id = p_user_id
    AND function_name = p_action
    AND created_at > NOW() - INTERVAL '1 hour';

  IF v_hour_count >= COALESCE(v_config.max_per_hour, 1000) THEN
    RETURN FALSE;
  END IF;

  -- Log this request
  INSERT INTO public.rate_limits (user_id, function_name, created_at)
  VALUES (p_user_id, p_action, NOW());

  RETURN TRUE;
END;
$$;

-- Function 3: log_security_event - fixed to return BIGINT and use correct columns
DROP FUNCTION IF EXISTS public.log_security_event(UUID, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_user_id UUID,
  p_event_type TEXT,
  p_severity TEXT,
  p_details JSONB DEFAULT '{}'::jsonb,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_request_path TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id BIGINT;
BEGIN
  INSERT INTO public.security_events (
    user_id,
    event_type,
    severity,
    details,
    ip_address,
    user_agent,
    request_path,
    created_at
  )
  VALUES (
    p_user_id,
    p_event_type,
    COALESCE(p_severity, 'info'),
    COALESCE(p_details, '{}'::jsonb),
    p_ip_address,
    p_user_agent,
    p_request_path,
    NOW()
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

-- Function 4: log_admin_action - fixed to return BIGINT and cast ip_address
DROP FUNCTION IF EXISTS public.log_admin_action(UUID, TEXT, TEXT, UUID, JSONB, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_admin_id UUID,
  p_action TEXT,
  p_target_type TEXT DEFAULT NULL,
  p_target_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT '{}'::jsonb,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id BIGINT;
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
  )
  VALUES (
    p_admin_id,
    p_action,
    p_target_type,
    p_target_id,
    COALESCE(p_details, '{}'::jsonb),
    CASE WHEN p_ip_address IS NOT NULL THEN p_ip_address::INET ELSE NULL END,
    p_user_agent,
    NOW()
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- Create index on rate_limits for better query performance
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_function
ON public.rate_limits(user_id, function_name, created_at);

-- Add comment explaining the schema
COMMENT ON TABLE public.rate_limits IS 'Rate limiting table with both legacy (identifier/endpoint) and new (user_id/function_name) columns';
