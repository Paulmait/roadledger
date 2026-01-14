-- RoadLedger: Subscriptions, Analytics & Admin Schema
-- Migration: 00005_subscriptions_analytics_admin.sql

-- ============================================
-- SUBSCRIPTION TABLES
-- ============================================

-- Subscription tier enum
CREATE TYPE subscription_tier AS ENUM ('free', 'pro', 'premium');

-- Subscription status enum
CREATE TYPE subscription_status AS ENUM ('active', 'cancelled', 'expired', 'trial');

-- Add subscription_tier to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_tier subscription_tier DEFAULT 'free';

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tier subscription_tier NOT NULL DEFAULT 'free',
  status subscription_status NOT NULL DEFAULT 'active',
  product_id TEXT,
  transaction_id TEXT,
  platform TEXT CHECK (platform IN ('ios', 'android', 'web')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  will_renew BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Subscription history for audit trail
CREATE TABLE IF NOT EXISTS subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'created', 'upgraded', 'downgraded', 'cancelled', 'renewed', 'expired'
  from_tier subscription_tier,
  to_tier subscription_tier,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- ANALYTICS TABLES
-- ============================================

-- Analytics events table
CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  session_id TEXT,
  event_type TEXT NOT NULL,
  event_data JSONB,
  device_info JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create hypertable-like partitioning for analytics (by month)
CREATE INDEX idx_analytics_events_created_at ON analytics_events(created_at DESC);
CREATE INDEX idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_events_session ON analytics_events(session_id);

-- Daily active users summary (materialized for performance)
CREATE TABLE IF NOT EXISTS analytics_daily_summary (
  date DATE PRIMARY KEY,
  total_users INTEGER DEFAULT 0,
  active_users INTEGER DEFAULT 0,
  new_users INTEGER DEFAULT 0,
  free_users INTEGER DEFAULT 0,
  pro_users INTEGER DEFAULT 0,
  premium_users INTEGER DEFAULT 0,
  total_trips INTEGER DEFAULT 0,
  total_miles NUMERIC(12, 2) DEFAULT 0,
  total_revenue NUMERIC(12, 2) DEFAULT 0,
  total_expenses NUMERIC(12, 2) DEFAULT 0,
  documents_uploaded INTEGER DEFAULT 0,
  exports_generated INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- App metrics for investors/admin dashboard
CREATE TABLE IF NOT EXISTS app_metrics (
  id SERIAL PRIMARY KEY,
  metric_date DATE NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC(20, 4) NOT NULL,
  metric_metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(metric_date, metric_name)
);

-- ============================================
-- ADMIN TABLES
-- ============================================

-- Admin roles
CREATE TYPE admin_role AS ENUM ('super_admin', 'admin', 'support', 'analyst');

-- Admin users table
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role admin_role NOT NULL DEFAULT 'support',
  permissions JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_admin_users_updated_at
  BEFORE UPDATE ON admin_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Admin audit log
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id BIGSERIAL PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT, -- 'user', 'subscription', 'transaction', etc.
  target_id UUID,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_audit_log_admin ON admin_audit_log(admin_id);
CREATE INDEX idx_admin_audit_log_target ON admin_audit_log(target_type, target_id);
CREATE INDEX idx_admin_audit_log_created ON admin_audit_log(created_at DESC);

-- Support tickets
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting', 'resolved', 'closed')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  category TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Support ticket messages
CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL, -- Can be user or admin
  is_admin BOOLEAN DEFAULT false,
  message TEXT NOT NULL,
  attachments JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- PASSWORD RESET TOKENS (for forgot password)
-- ============================================

-- Note: Supabase handles password reset via auth.users
-- This is for tracking/analytics purposes
CREATE TABLE IF NOT EXISTS password_reset_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  ip_address INET,
  user_agent TEXT
);

-- ============================================
-- RLS POLICIES FOR NEW TABLES
-- ============================================

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_daily_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_log ENABLE ROW LEVEL SECURITY;

-- Subscriptions: Users can view their own
CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Subscription history: Users can view their own
CREATE POLICY "Users can view own subscription history"
  ON subscription_history FOR SELECT
  USING (auth.uid() = user_id);

-- Analytics events: Users can insert their own, admins can view all
CREATE POLICY "Users can insert own analytics"
  ON analytics_events FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Support tickets: Users can manage their own
CREATE POLICY "Users can view own tickets"
  ON support_tickets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create tickets"
  ON support_tickets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tickets"
  ON support_tickets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Support messages: Users can view/create for their tickets
CREATE POLICY "Users can view messages for own tickets"
  ON support_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets
      WHERE support_tickets.id = support_messages.ticket_id
      AND support_tickets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages on own tickets"
  ON support_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM support_tickets
      WHERE support_tickets.id = support_messages.ticket_id
      AND support_tickets.user_id = auth.uid()
    )
  );

-- ============================================
-- ADMIN ACCESS POLICIES (bypass RLS for admins)
-- ============================================

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE id = auth.uid()
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check admin role
CREATE OR REPLACE FUNCTION get_admin_role()
RETURNS admin_role AS $$
DECLARE
  user_role admin_role;
BEGIN
  SELECT role INTO user_role FROM admin_users
  WHERE id = auth.uid() AND is_active = true;
  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin policies for viewing all user data
CREATE POLICY "Admins can view all subscriptions"
  ON subscriptions FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can update subscriptions"
  ON subscriptions FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (auth.uid() = id OR is_admin());

CREATE POLICY "Admins can update profiles"
  ON profiles FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admins can view all trips"
  ON trips FOR SELECT
  USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "Admins can view all transactions"
  ON transactions FOR SELECT
  USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "Admins can view all documents"
  ON documents FOR SELECT
  USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "Admins can view all tickets"
  ON support_tickets FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can update all tickets"
  ON support_tickets FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admins can view all messages"
  ON support_messages FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can send messages"
  ON support_messages FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admins can view analytics"
  ON analytics_events FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can view daily summary"
  ON analytics_daily_summary FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can view app metrics"
  ON app_metrics FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can view audit log"
  ON admin_audit_log FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can insert audit log"
  ON admin_audit_log FOR INSERT
  WITH CHECK (is_admin());

-- ============================================
-- INDEXES FOR NEW TABLES
-- ============================================

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_expires ON subscriptions(expires_at);

CREATE INDEX idx_subscription_history_user ON subscription_history(user_id);
CREATE INDEX idx_subscription_history_sub ON subscription_history(subscription_id);

CREATE INDEX idx_support_tickets_user ON support_tickets(user_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_tickets_admin ON support_tickets(assigned_admin_id);

CREATE INDEX idx_support_messages_ticket ON support_messages(ticket_id);

-- ============================================
-- FUNCTIONS FOR ANALYTICS
-- ============================================

-- Function to update daily summary
CREATE OR REPLACE FUNCTION update_daily_analytics_summary()
RETURNS void AS $$
DECLARE
  target_date DATE := CURRENT_DATE;
BEGIN
  INSERT INTO analytics_daily_summary (
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
    (SELECT COUNT(*) FROM profiles),
    (SELECT COUNT(DISTINCT user_id) FROM analytics_events WHERE created_at >= target_date),
    (SELECT COUNT(*) FROM profiles WHERE DATE(created_at) = target_date),
    (SELECT COUNT(*) FROM profiles WHERE subscription_tier = 'free'),
    (SELECT COUNT(*) FROM profiles WHERE subscription_tier = 'pro'),
    (SELECT COUNT(*) FROM profiles WHERE subscription_tier = 'premium'),
    (SELECT COUNT(*) FROM trips WHERE DATE(created_at) = target_date),
    COALESCE((SELECT SUM(auto_miles_total) FROM trips WHERE DATE(created_at) = target_date), 0),
    COALESCE((SELECT SUM(amount) FROM transactions WHERE type = 'income' AND date = target_date), 0),
    COALESCE((SELECT SUM(amount) FROM transactions WHERE type = 'expense' AND date = target_date), 0),
    (SELECT COUNT(*) FROM documents WHERE DATE(uploaded_at) = target_date),
    (SELECT COUNT(*) FROM exports WHERE DATE(created_at) = target_date)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- SEED INITIAL ADMIN (update with your user ID)
-- ============================================

-- To make yourself an admin, run:
-- INSERT INTO admin_users (id, role) VALUES ('your-user-uuid-here', 'super_admin');
