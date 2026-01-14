-- ============================================
-- RoadLedger - Complete Database Setup
-- ============================================
-- Run this entire script in Supabase SQL Editor
-- URL: https://kbohuorolouxqgtzmrsa.supabase.co/project/kbohuorolouxqgtzmrsa/sql/new
-- ============================================

-- ============================================
-- PART 1: ENUMS
-- ============================================

-- Trip status enum
CREATE TYPE trip_status AS ENUM ('draft', 'in_progress', 'finalized');

-- Trip source enum
CREATE TYPE trip_source AS ENUM ('gps', 'manual', 'import');

-- Document type enum
CREATE TYPE doc_type AS ENUM ('receipt', 'settlement', 'ratecon', 'maintenance', 'other');

-- Parsed status enum
CREATE TYPE parsed_status AS ENUM ('pending', 'parsed', 'failed');

-- Transaction type enum
CREATE TYPE txn_type AS ENUM ('income', 'expense');

-- Transaction category enum
CREATE TYPE txn_category AS ENUM (
  'fuel',
  'maintenance',
  'tolls',
  'scales',
  'insurance',
  'parking',
  'food',
  'other',
  'settlement_deductions'
);

-- Transaction source enum
CREATE TYPE txn_source AS ENUM ('document_ai', 'manual', 'import', 'bank_sync');

-- Export type enum
CREATE TYPE export_type AS ENUM ('ifta', 'tax_pack');

-- Export status enum
CREATE TYPE export_status AS ENUM ('queued', 'ready', 'failed');

-- Jurisdiction method enum
CREATE TYPE jurisdiction_method AS ENUM ('gps', 'manual_adjust', 'import');

-- ============================================
-- PART 2: TABLES
-- ============================================

-- Profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  company_name TEXT,
  home_state TEXT,
  timezone TEXT DEFAULT 'America/New_York',
  mc_number TEXT,
  dot_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trips table
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
  BEFORE UPDATE ON trips
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trip points table (GPS coordinates)
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

-- Jurisdiction miles table (aggregated per trip)
CREATE TABLE jurisdiction_miles (
  id BIGSERIAL PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  jurisdiction TEXT NOT NULL,
  miles NUMERIC(10, 2) NOT NULL DEFAULT 0,
  confidence NUMERIC(3, 2),
  method jurisdiction_method NOT NULL DEFAULT 'gps',
  UNIQUE(trip_id, jurisdiction)
);

-- Documents table
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

-- Transactions table
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
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Exports table
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
-- PART 3: FUNCTIONS
-- ============================================

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Function to calculate total miles for a trip
CREATE OR REPLACE FUNCTION calculate_trip_miles(p_trip_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  total_miles NUMERIC;
BEGIN
  SELECT COALESCE(SUM(miles), 0)
  INTO total_miles
  FROM jurisdiction_miles
  WHERE trip_id = p_trip_id;

  RETURN total_miles;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get IFTA quarter from date
CREATE OR REPLACE FUNCTION get_ifta_quarter(p_date DATE)
RETURNS TEXT AS $$
BEGIN
  RETURN EXTRACT(YEAR FROM p_date)::TEXT || '-Q' || CEIL(EXTRACT(MONTH FROM p_date) / 3)::TEXT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- PART 4: ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE jurisdiction_miles ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exports ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Trips policies
CREATE POLICY "Users can view own trips"
  ON trips FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own trips"
  ON trips FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trips"
  ON trips FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own trips"
  ON trips FOR DELETE
  USING (auth.uid() = user_id);

-- Trip points policies
CREATE POLICY "Users can view own trip points"
  ON trip_points FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_points.trip_id
      AND trips.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own trip points"
  ON trip_points FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_points.trip_id
      AND trips.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own trip points"
  ON trip_points FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_points.trip_id
      AND trips.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_points.trip_id
      AND trips.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own trip points"
  ON trip_points FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_points.trip_id
      AND trips.user_id = auth.uid()
    )
  );

-- Jurisdiction miles policies
CREATE POLICY "Users can view own jurisdiction miles"
  ON jurisdiction_miles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = jurisdiction_miles.trip_id
      AND trips.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own jurisdiction miles"
  ON jurisdiction_miles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = jurisdiction_miles.trip_id
      AND trips.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own jurisdiction miles"
  ON jurisdiction_miles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = jurisdiction_miles.trip_id
      AND trips.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = jurisdiction_miles.trip_id
      AND trips.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own jurisdiction miles"
  ON jurisdiction_miles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = jurisdiction_miles.trip_id
      AND trips.user_id = auth.uid()
    )
  );

-- Documents policies
CREATE POLICY "Users can view own documents"
  ON documents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own documents"
  ON documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own documents"
  ON documents FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own documents"
  ON documents FOR DELETE
  USING (auth.uid() = user_id);

-- Transactions policies
CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own transactions"
  ON transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions"
  ON transactions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions"
  ON transactions FOR DELETE
  USING (auth.uid() = user_id);

-- Exports policies
CREATE POLICY "Users can view own exports"
  ON exports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own exports"
  ON exports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own exports"
  ON exports FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own exports"
  ON exports FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- PART 5: INDEXES
-- ============================================

-- Profiles indexes
CREATE INDEX idx_profiles_home_state ON profiles(home_state);

-- Trips indexes
CREATE INDEX idx_trips_user_status ON trips(user_id, status);
CREATE INDEX idx_trips_user_dates ON trips(user_id, started_at DESC, ended_at);
CREATE INDEX idx_trips_status ON trips(status) WHERE status = 'in_progress';
CREATE INDEX idx_trips_source ON trips(user_id, source);

-- Trip points indexes
CREATE INDEX idx_trip_points_trip_ts ON trip_points(trip_id, ts);
CREATE INDEX idx_trip_points_jurisdiction ON trip_points(jurisdiction) WHERE jurisdiction IS NOT NULL;
CREATE INDEX idx_trip_points_coords ON trip_points(lat, lng);

-- Jurisdiction miles indexes
CREATE INDEX idx_jurisdiction_miles_trip ON jurisdiction_miles(trip_id);
CREATE INDEX idx_jurisdiction_miles_jurisdiction ON jurisdiction_miles(jurisdiction);

-- Documents indexes
CREATE INDEX idx_documents_user_status ON documents(user_id, parsed_status);
CREATE INDEX idx_documents_user_type ON documents(user_id, type);
CREATE INDEX idx_documents_user_date ON documents(user_id, document_date DESC);
CREATE INDEX idx_documents_trip ON documents(trip_id) WHERE trip_id IS NOT NULL;
CREATE INDEX idx_documents_pending ON documents(parsed_status, uploaded_at)
  WHERE parsed_status = 'pending';

-- Transactions indexes
CREATE INDEX idx_transactions_user_date ON transactions(user_id, date DESC);
CREATE INDEX idx_transactions_user_category ON transactions(user_id, category);
CREATE INDEX idx_transactions_user_type ON transactions(user_id, type);
CREATE INDEX idx_transactions_document ON transactions(document_id) WHERE document_id IS NOT NULL;
CREATE INDEX idx_transactions_trip ON transactions(trip_id) WHERE trip_id IS NOT NULL;
CREATE INDEX idx_transactions_fuel_jurisdiction ON transactions(user_id, jurisdiction, date)
  WHERE category = 'fuel';

-- Exports indexes
CREATE INDEX idx_exports_user_type ON exports(user_id, type);
CREATE INDEX idx_exports_user_status ON exports(user_id, status);
CREATE INDEX idx_exports_period ON exports(user_id, period_start, period_end);

-- Partial indexes for common queries
CREATE INDEX idx_trips_active ON trips(user_id, started_at)
  WHERE status = 'in_progress';
CREATE INDEX idx_documents_recent ON documents(user_id, uploaded_at DESC)
  WHERE parsed_status IN ('pending', 'parsed');
CREATE INDEX idx_exports_queued ON exports(created_at)
  WHERE status = 'queued';

-- ============================================
-- PART 6: STORAGE BUCKETS
-- ============================================

-- Create receipts bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- Create settlements bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'settlements',
  'settlements',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- Create exports bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'exports',
  'exports',
  false,
  52428800,
  ARRAY['application/pdf', 'application/zip']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for receipts
CREATE POLICY "Users can upload receipts to own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'receipts' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can view own receipts"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'receipts' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update own receipts"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'receipts' AND
    (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'receipts' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own receipts"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'receipts' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage policies for settlements
CREATE POLICY "Users can upload settlements to own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'settlements' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can view own settlements"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'settlements' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update own settlements"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'settlements' AND
    (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'settlements' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own settlements"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'settlements' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage policies for exports
CREATE POLICY "Users can upload exports to own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'exports' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can view own exports"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'exports' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own exports"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'exports' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================
-- SETUP COMPLETE!
-- ============================================
-- Next steps:
-- 1. Go to Authentication > URL Configuration
--    - Set Site URL to: exp://localhost:8081 (for development)
-- 2. Go to Project Settings > API
--    - Copy the URL and anon key to your .env file
-- 3. Deploy Edge Functions using Supabase CLI
-- ============================================
