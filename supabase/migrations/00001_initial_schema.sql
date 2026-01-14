-- RoadLedger Database Schema
-- Migration: 00001_initial_schema.sql
-- Description: Create all tables and enums for the RoadLedger application

-- ============================================
-- ENUMS
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
-- TABLES
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
-- FUNCTIONS
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
