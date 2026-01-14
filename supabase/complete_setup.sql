-- ============================================
-- RoadLedger - COMPLETE DATABASE SETUP
-- ============================================
-- Run this entire script in Supabase SQL Editor
-- https://supabase.com/dashboard/project/kbohuorolouxqgtzmrsa/sql/new
-- ============================================

-- ============================================
-- PART 1: CORE ENUMS
-- ============================================

CREATE TYPE trip_status AS ENUM ('draft', 'in_progress', 'finalized');
CREATE TYPE trip_source AS ENUM ('gps', 'manual', 'import');
CREATE TYPE doc_type AS ENUM ('receipt', 'settlement', 'ratecon', 'maintenance', 'other');
CREATE TYPE parsed_status AS ENUM ('pending', 'parsed', 'failed');
CREATE TYPE txn_type AS ENUM ('income', 'expense');
CREATE TYPE txn_category AS ENUM (
  'fuel', 'maintenance', 'tolls', 'scales', 'insurance',
  'parking', 'food', 'other', 'settlement_deductions'
);
CREATE TYPE txn_source AS ENUM ('document_ai', 'manual', 'import', 'bank_sync');
CREATE TYPE export_type AS ENUM ('ifta', 'tax_pack');
CREATE TYPE export_status AS ENUM ('queued', 'ready', 'failed');
CREATE TYPE jurisdiction_method AS ENUM ('gps', 'manual_adjust', 'import');
CREATE TYPE subscription_tier AS ENUM ('free', 'pro', 'premium');
CREATE TYPE subscription_status AS ENUM ('active', 'cancelled', 'expired', 'trial');
CREATE TYPE admin_role AS ENUM ('super_admin', 'admin', 'support', 'analyst');

-- ============================================
-- PART 2: HELPER FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PART 3: CORE TABLES
-- ============================================

-- Profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  company_name TEXT,
  home_state TEXT,
  timezone TEXT DEFAULT 'America/New_York',
  mc_number TEXT,
  dot_number TEXT,
  subscription_tier subscription_tier DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trips
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status trip_status NOT NULL DEFAULT 'draft',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  loaded BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  auto_miles_total NUMERIC(10, 2),
  manual_miles_total NUMERIC(10, 2),
  source trip_source NOT NULL DEFAULT 'gps',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_trips_updated_at
  BEFORE UPDATE ON trips FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trip Points (GPS)
CREATE TABLE trip_points (
  id BIGSERIAL PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  speed DOUBLE PRECISION,
  accuracy_m DOUBLE PRECISION,
  jurisdiction TEXT
);

-- Jurisdiction Miles
CREATE TABLE jurisdiction_miles (
  id BIGSERIAL PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  jurisdiction TEXT NOT NULL,
  miles NUMERIC(10, 2) NOT NULL DEFAULT 0,
  confidence NUMERIC(3, 2),
  method jurisdiction_method NOT NULL DEFAULT 'gps',
  UNIQUE(trip_id, jurisdiction)
);

-- Documents
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  type doc_type NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  parsed_status parsed_status NOT NULL DEFAULT 'pending',
  vendor TEXT,
  document_date DATE,
  total_amount NUMERIC(12, 2),
  currency TEXT DEFAULT 'USD',
  raw_text TEXT,
  extraction_json JSONB
);

-- Transactions
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  type txn_type NOT NULL,
  category txn_category NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  date DATE NOT NULL,
  vendor TEXT,
  description TEXT,
  source txn_source NOT NULL DEFAULT 'manual',
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  gallons NUMERIC(10, 3),
  jurisdiction TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON transactions FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Exports
CREATE TABLE exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type export_type NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status export_status NOT NULL DEFAULT 'queued',
  storage_path TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- PART 4: SUBSCRIPTION TABLES
-- ============================================

CREATE TABLE subscriptions (
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
  BEFORE UPDATE ON subscriptions FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  from_tier subscription_tier,
  to_tier subscription_tier,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- PART 5: ANALYTICS TABLES
-- ============================================

CREATE TABLE analytics_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  session_id TEXT,
  event_type TEXT NOT NULL,
  event_data JSONB,
  device_info JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE analytics_daily_summary (
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

CREATE TABLE app_metrics (
  id SERIAL PRIMARY KEY,
  metric_date DATE NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC(20, 4) NOT NULL,
  metric_metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(metric_date, metric_name)
);

-- ============================================
-- PART 6: ADMIN TABLES
-- ============================================

CREATE TABLE admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role admin_role NOT NULL DEFAULT 'support',
  permissions JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_admin_users_updated_at
  BEFORE UPDATE ON admin_users FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE admin_audit_log (
  id BIGSERIAL PRIMARY KEY,
  admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE support_tickets (
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
  BEFORE UPDATE ON support_tickets FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  is_admin BOOLEAN DEFAULT false,
  message TEXT NOT NULL,
  attachments JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE password_reset_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  ip_address INET,
  user_agent TEXT
);

-- ============================================
-- PART 7: AUTO PROFILE CREATION
-- ============================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================
-- PART 8: ADMIN HELPER FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE id = auth.uid() AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

-- ============================================
-- PART 9: ROW LEVEL SECURITY
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE jurisdiction_miles ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exports ENABLE ROW LEVEL SECURITY;
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

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id OR is_admin());
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins can update any profile" ON profiles FOR UPDATE USING (is_admin());

-- Trips policies
CREATE POLICY "Users can view own trips" ON trips FOR SELECT USING (auth.uid() = user_id OR is_admin());
CREATE POLICY "Users can create own trips" ON trips FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own trips" ON trips FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own trips" ON trips FOR DELETE USING (auth.uid() = user_id);

-- Trip points policies
CREATE POLICY "Users can view own trip points" ON trip_points FOR SELECT
  USING (EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_points.trip_id AND trips.user_id = auth.uid()) OR is_admin());
CREATE POLICY "Users can insert own trip points" ON trip_points FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_points.trip_id AND trips.user_id = auth.uid()));
CREATE POLICY "Users can update own trip points" ON trip_points FOR UPDATE
  USING (EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_points.trip_id AND trips.user_id = auth.uid()));
CREATE POLICY "Users can delete own trip points" ON trip_points FOR DELETE
  USING (EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_points.trip_id AND trips.user_id = auth.uid()));

-- Jurisdiction miles policies
CREATE POLICY "Users can view own jurisdiction miles" ON jurisdiction_miles FOR SELECT
  USING (EXISTS (SELECT 1 FROM trips WHERE trips.id = jurisdiction_miles.trip_id AND trips.user_id = auth.uid()) OR is_admin());
CREATE POLICY "Users can insert own jurisdiction miles" ON jurisdiction_miles FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM trips WHERE trips.id = jurisdiction_miles.trip_id AND trips.user_id = auth.uid()));
CREATE POLICY "Users can update own jurisdiction miles" ON jurisdiction_miles FOR UPDATE
  USING (EXISTS (SELECT 1 FROM trips WHERE trips.id = jurisdiction_miles.trip_id AND trips.user_id = auth.uid()));
CREATE POLICY "Users can delete own jurisdiction miles" ON jurisdiction_miles FOR DELETE
  USING (EXISTS (SELECT 1 FROM trips WHERE trips.id = jurisdiction_miles.trip_id AND trips.user_id = auth.uid()));

-- Documents policies
CREATE POLICY "Users can view own documents" ON documents FOR SELECT USING (auth.uid() = user_id OR is_admin());
CREATE POLICY "Users can create own documents" ON documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own documents" ON documents FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own documents" ON documents FOR DELETE USING (auth.uid() = user_id);

-- Transactions policies
CREATE POLICY "Users can view own transactions" ON transactions FOR SELECT USING (auth.uid() = user_id OR is_admin());
CREATE POLICY "Users can create own transactions" ON transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transactions" ON transactions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own transactions" ON transactions FOR DELETE USING (auth.uid() = user_id);

-- Exports policies
CREATE POLICY "Users can view own exports" ON exports FOR SELECT USING (auth.uid() = user_id OR is_admin());
CREATE POLICY "Users can create own exports" ON exports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own exports" ON exports FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own exports" ON exports FOR DELETE USING (auth.uid() = user_id);

-- Subscriptions policies
CREATE POLICY "Users can view own subscription" ON subscriptions FOR SELECT USING (auth.uid() = user_id OR is_admin());
CREATE POLICY "Admins can update subscriptions" ON subscriptions FOR UPDATE USING (is_admin());

-- Subscription history policies
CREATE POLICY "Users can view own subscription history" ON subscription_history FOR SELECT USING (auth.uid() = user_id OR is_admin());

-- Analytics policies
CREATE POLICY "Users can insert own analytics" ON analytics_events FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Admins can view analytics" ON analytics_events FOR SELECT USING (is_admin());
CREATE POLICY "Admins can view daily summary" ON analytics_daily_summary FOR SELECT USING (is_admin());
CREATE POLICY "Admins can view app metrics" ON app_metrics FOR SELECT USING (is_admin());

-- Admin policies
CREATE POLICY "Admins can view audit log" ON admin_audit_log FOR SELECT USING (is_admin());
CREATE POLICY "Admins can insert audit log" ON admin_audit_log FOR INSERT WITH CHECK (is_admin());

-- Support tickets policies
CREATE POLICY "Users can view own tickets" ON support_tickets FOR SELECT USING (auth.uid() = user_id OR is_admin());
CREATE POLICY "Users can create tickets" ON support_tickets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tickets" ON support_tickets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can update all tickets" ON support_tickets FOR UPDATE USING (is_admin());

-- Support messages policies
CREATE POLICY "Users can view messages for own tickets" ON support_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM support_tickets WHERE support_tickets.id = support_messages.ticket_id AND support_tickets.user_id = auth.uid()) OR is_admin());
CREATE POLICY "Users can send messages on own tickets" ON support_messages FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM support_tickets WHERE support_tickets.id = support_messages.ticket_id AND support_tickets.user_id = auth.uid()) OR is_admin());

-- ============================================
-- PART 10: INDEXES
-- ============================================

CREATE INDEX idx_profiles_home_state ON profiles(home_state);
CREATE INDEX idx_trips_user_status ON trips(user_id, status);
CREATE INDEX idx_trips_user_dates ON trips(user_id, started_at DESC, ended_at);
CREATE INDEX idx_trip_points_trip_ts ON trip_points(trip_id, ts);
CREATE INDEX idx_trip_points_jurisdiction ON trip_points(jurisdiction) WHERE jurisdiction IS NOT NULL;
CREATE INDEX idx_jurisdiction_miles_trip ON jurisdiction_miles(trip_id);
CREATE INDEX idx_documents_user_status ON documents(user_id, parsed_status);
CREATE INDEX idx_documents_user_type ON documents(user_id, type);
CREATE INDEX idx_transactions_user_date ON transactions(user_id, date DESC);
CREATE INDEX idx_transactions_user_category ON transactions(user_id, category);
CREATE INDEX idx_exports_user_type ON exports(user_id, type);
CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_analytics_events_created_at ON analytics_events(created_at DESC);
CREATE INDEX idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX idx_support_tickets_user ON support_tickets(user_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_admin_audit_log_admin ON admin_audit_log(admin_id);
CREATE INDEX idx_admin_audit_log_created ON admin_audit_log(created_at DESC);

-- ============================================
-- PART 11: STORAGE BUCKETS
-- ============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('receipts', 'receipts', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('settlements', 'settlements', false, 10485760, ARRAY['image/jpeg', 'image/png', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('exports', 'exports', false, 52428800, ARRAY['application/pdf', 'application/zip'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload to own folder" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id IN ('receipts', 'settlements', 'exports') AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view own files" ON storage.objects FOR SELECT
  USING (bucket_id IN ('receipts', 'settlements', 'exports') AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own files" ON storage.objects FOR DELETE
  USING (bucket_id IN ('receipts', 'settlements', 'exports') AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================
-- SETUP COMPLETE!
-- ============================================
-- Next Steps:
-- 1. Create your first user account in the app
-- 2. Make yourself an admin by running (replace YOUR_USER_ID):
--    INSERT INTO admin_users (id, role) VALUES ('YOUR_USER_ID', 'super_admin');
-- 3. Set up Edge Function secrets in Supabase Dashboard:
--    - OPENAI_API_KEY (for document AI)
--    - APPLE_SHARED_SECRET (for IAP validation, optional)
-- ============================================
