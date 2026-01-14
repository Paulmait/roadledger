-- RoadLedger Row Level Security Policies
-- Migration: 00002_rls_policies.sql
-- Description: Enable RLS and create policies for all tables

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE jurisdiction_miles ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exports ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROFILES POLICIES
-- ============================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Profile is created by trigger, but allow insert for completeness
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================
-- TRIPS POLICIES
-- ============================================

-- Users can view their own trips
CREATE POLICY "Users can view own trips"
  ON trips FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own trips
CREATE POLICY "Users can create own trips"
  ON trips FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own trips
CREATE POLICY "Users can update own trips"
  ON trips FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own trips
CREATE POLICY "Users can delete own trips"
  ON trips FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- TRIP_POINTS POLICIES
-- (Access controlled via trip ownership)
-- ============================================

-- Users can view trip points for their own trips
CREATE POLICY "Users can view own trip points"
  ON trip_points FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_points.trip_id
      AND trips.user_id = auth.uid()
    )
  );

-- Users can insert trip points for their own trips
CREATE POLICY "Users can insert own trip points"
  ON trip_points FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_points.trip_id
      AND trips.user_id = auth.uid()
    )
  );

-- Users can update trip points for their own trips
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

-- Users can delete trip points for their own trips
CREATE POLICY "Users can delete own trip points"
  ON trip_points FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_points.trip_id
      AND trips.user_id = auth.uid()
    )
  );

-- ============================================
-- JURISDICTION_MILES POLICIES
-- (Access controlled via trip ownership)
-- ============================================

-- Users can view jurisdiction miles for their own trips
CREATE POLICY "Users can view own jurisdiction miles"
  ON jurisdiction_miles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = jurisdiction_miles.trip_id
      AND trips.user_id = auth.uid()
    )
  );

-- Users can insert jurisdiction miles for their own trips
CREATE POLICY "Users can insert own jurisdiction miles"
  ON jurisdiction_miles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = jurisdiction_miles.trip_id
      AND trips.user_id = auth.uid()
    )
  );

-- Users can update jurisdiction miles for their own trips
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

-- Users can delete jurisdiction miles for their own trips
CREATE POLICY "Users can delete own jurisdiction miles"
  ON jurisdiction_miles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = jurisdiction_miles.trip_id
      AND trips.user_id = auth.uid()
    )
  );

-- ============================================
-- DOCUMENTS POLICIES
-- ============================================

-- Users can view their own documents
CREATE POLICY "Users can view own documents"
  ON documents FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own documents
CREATE POLICY "Users can create own documents"
  ON documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own documents
CREATE POLICY "Users can update own documents"
  ON documents FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own documents
CREATE POLICY "Users can delete own documents"
  ON documents FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- TRANSACTIONS POLICIES
-- ============================================

-- Users can view their own transactions
CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own transactions
CREATE POLICY "Users can create own transactions"
  ON transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own transactions
CREATE POLICY "Users can update own transactions"
  ON transactions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own transactions
CREATE POLICY "Users can delete own transactions"
  ON transactions FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- EXPORTS POLICIES
-- ============================================

-- Users can view their own exports
CREATE POLICY "Users can view own exports"
  ON exports FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own exports
CREATE POLICY "Users can create own exports"
  ON exports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own exports
CREATE POLICY "Users can update own exports"
  ON exports FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own exports
CREATE POLICY "Users can delete own exports"
  ON exports FOR DELETE
  USING (auth.uid() = user_id);
