-- ============================================
-- RoadLedger - Enhanced Admin Audit & Security
-- ============================================
-- Comprehensive logging for legal compliance
-- IP tracking, timestamps, action logging
-- ============================================

-- Enhanced admin audit log with IP tracking
ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS ip_address INET;
ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS session_id UUID;
ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS request_id UUID DEFAULT gen_random_uuid();
ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS geo_location JSONB;
ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS risk_score INTEGER DEFAULT 0;

-- Create security events table for tracking suspicious activity
CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL, -- 'login_attempt', 'rate_limit', 'unauthorized_access', 'suspicious_activity'
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ip_address INET NOT NULL,
  user_agent TEXT,
  event_data JSONB,
  severity TEXT NOT NULL DEFAULT 'low', -- 'low', 'medium', 'high', 'critical'
  resolved BOOLEAN DEFAULT false,
  resolved_by UUID REFERENCES admin_users(id),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create rate limiting table
CREATE TABLE IF NOT EXISTS rate_limits (
  id BIGSERIAL PRIMARY KEY,
  identifier TEXT NOT NULL, -- IP or user_id
  endpoint TEXT NOT NULL,
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create consent tracking table for legal compliance
CREATE TABLE IF NOT EXISTS user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL, -- 'terms_of_service', 'privacy_policy', 'marketing', 'location_tracking'
  version TEXT NOT NULL, -- Version of the document they agreed to
  consented BOOLEAN NOT NULL DEFAULT true,
  ip_address INET,
  user_agent TEXT,
  consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  withdrawn_at TIMESTAMPTZ,
  UNIQUE(user_id, consent_type)
);

-- Create data deletion requests table (GDPR/CCPA compliance)
CREATE TABLE IF NOT EXISTS data_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'cancelled'
  processed_by UUID REFERENCES admin_users(id),
  processed_at TIMESTAMPTZ,
  completion_notes TEXT,
  data_exported BOOLEAN DEFAULT false,
  export_url TEXT
);

-- Create accessibility preferences table
CREATE TABLE IF NOT EXISTS accessibility_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  high_contrast BOOLEAN DEFAULT false,
  large_text BOOLEAN DEFAULT false,
  reduce_motion BOOLEAN DEFAULT false,
  screen_reader_optimized BOOLEAN DEFAULT false,
  voice_control_enabled BOOLEAN DEFAULT false,
  color_blind_mode TEXT, -- 'none', 'protanopia', 'deuteranopia', 'tritanopia'
  font_scale NUMERIC(3,2) DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Function to log admin actions with full context
CREATE OR REPLACE FUNCTION log_admin_action(
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
  INSERT INTO admin_audit_log (
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check and log rate limits
CREATE OR REPLACE FUNCTION check_rate_limit(
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

  -- Clean old entries
  DELETE FROM rate_limits
  WHERE window_start < v_window_start;

  -- Count requests in window
  SELECT COALESCE(SUM(request_count), 0) INTO v_count
  FROM rate_limits
  WHERE identifier = p_identifier
    AND endpoint = p_endpoint
    AND window_start >= v_window_start;

  IF v_count >= p_max_requests THEN
    -- Log rate limit event
    INSERT INTO security_events (event_type, ip_address, event_data, severity)
    VALUES ('rate_limit', p_identifier::INET,
      jsonb_build_object('endpoint', p_endpoint, 'count', v_count),
      'medium');
    RETURN false;
  END IF;

  -- Record this request
  INSERT INTO rate_limits (identifier, endpoint, window_start)
  VALUES (p_identifier, p_endpoint, NOW());

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record user consent
CREATE OR REPLACE FUNCTION record_user_consent(
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
  INSERT INTO user_consents (
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies for new tables
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessibility_preferences ENABLE ROW LEVEL SECURITY;

-- Security events: Admin only
CREATE POLICY "Admin can view security events" ON security_events
  FOR SELECT USING (is_admin());

CREATE POLICY "System can insert security events" ON security_events
  FOR INSERT WITH CHECK (true);

-- User consents: Users see their own, admins see all
CREATE POLICY "Users can view own consents" ON user_consents
  FOR SELECT USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "Users can manage own consents" ON user_consents
  FOR ALL USING (auth.uid() = user_id);

-- Data deletion requests: Users see their own, admins see all
CREATE POLICY "Users can view own deletion requests" ON data_deletion_requests
  FOR SELECT USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "Users can create deletion requests" ON data_deletion_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin can manage deletion requests" ON data_deletion_requests
  FOR UPDATE USING (is_admin());

-- Accessibility preferences: Users manage their own
CREATE POLICY "Users can manage accessibility" ON accessibility_preferences
  FOR ALL USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity) WHERE NOT resolved;
CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup ON rate_limits(identifier, endpoint, window_start);
CREATE INDEX IF NOT EXISTS idx_user_consents_user ON user_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_status ON data_deletion_requests(status) WHERE status = 'pending';

-- Trigger for accessibility preferences updated_at
CREATE TRIGGER update_accessibility_preferences_updated_at
  BEFORE UPDATE ON accessibility_preferences FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
