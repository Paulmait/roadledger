-- RoadLedger Database Indexes
-- Migration: 00003_indexes.sql
-- Description: Create performance indexes for all tables

-- ============================================
-- PROFILES INDEXES
-- ============================================

-- Index on home_state for IFTA queries
CREATE INDEX idx_profiles_home_state ON profiles(home_state);

-- ============================================
-- TRIPS INDEXES
-- ============================================

-- Composite index for user trips by status
CREATE INDEX idx_trips_user_status ON trips(user_id, status);

-- Composite index for user trips by date range
CREATE INDEX idx_trips_user_dates ON trips(user_id, started_at DESC, ended_at);

-- Index for finding active trips
CREATE INDEX idx_trips_status ON trips(status) WHERE status = 'in_progress';

-- Index for trip source filtering
CREATE INDEX idx_trips_source ON trips(user_id, source);

-- ============================================
-- TRIP_POINTS INDEXES
-- ============================================

-- Composite index for trip points by trip and timestamp
CREATE INDEX idx_trip_points_trip_ts ON trip_points(trip_id, ts);

-- Index for jurisdiction queries
CREATE INDEX idx_trip_points_jurisdiction ON trip_points(jurisdiction) WHERE jurisdiction IS NOT NULL;

-- Spatial-like index for coordinates (useful for range queries)
CREATE INDEX idx_trip_points_coords ON trip_points(lat, lng);

-- ============================================
-- JURISDICTION_MILES INDEXES
-- ============================================

-- Composite index for IFTA reports (via trip join)
CREATE INDEX idx_jurisdiction_miles_trip ON jurisdiction_miles(trip_id);

-- Index for jurisdiction aggregation
CREATE INDEX idx_jurisdiction_miles_jurisdiction ON jurisdiction_miles(jurisdiction);

-- ============================================
-- DOCUMENTS INDEXES
-- ============================================

-- Composite index for user documents by status
CREATE INDEX idx_documents_user_status ON documents(user_id, parsed_status);

-- Index for user documents by type
CREATE INDEX idx_documents_user_type ON documents(user_id, type);

-- Index for user documents by date
CREATE INDEX idx_documents_user_date ON documents(user_id, document_date DESC);

-- Index for linking documents to trips
CREATE INDEX idx_documents_trip ON documents(trip_id) WHERE trip_id IS NOT NULL;

-- Index for pending documents (for processing queue)
CREATE INDEX idx_documents_pending ON documents(parsed_status, uploaded_at)
  WHERE parsed_status = 'pending';

-- ============================================
-- TRANSACTIONS INDEXES
-- ============================================

-- Composite index for user transactions by date
CREATE INDEX idx_transactions_user_date ON transactions(user_id, date DESC);

-- Composite index for user transactions by category
CREATE INDEX idx_transactions_user_category ON transactions(user_id, category);

-- Composite index for user transactions by type
CREATE INDEX idx_transactions_user_type ON transactions(user_id, type);

-- Index for document-linked transactions
CREATE INDEX idx_transactions_document ON transactions(document_id) WHERE document_id IS NOT NULL;

-- Index for trip-linked transactions
CREATE INDEX idx_transactions_trip ON transactions(trip_id) WHERE trip_id IS NOT NULL;

-- Index for IFTA fuel queries (jurisdiction + category)
CREATE INDEX idx_transactions_fuel_jurisdiction ON transactions(user_id, jurisdiction, date)
  WHERE category = 'fuel';

-- ============================================
-- EXPORTS INDEXES
-- ============================================

-- Composite index for user exports by type
CREATE INDEX idx_exports_user_type ON exports(user_id, type);

-- Composite index for user exports by status
CREATE INDEX idx_exports_user_status ON exports(user_id, status);

-- Index for date range queries
CREATE INDEX idx_exports_period ON exports(user_id, period_start, period_end);

-- ============================================
-- PARTIAL INDEXES FOR COMMON QUERIES
-- ============================================

-- Active trips (commonly queried)
CREATE INDEX idx_trips_active ON trips(user_id, started_at)
  WHERE status = 'in_progress';

-- Recent documents for dashboard
CREATE INDEX idx_documents_recent ON documents(user_id, uploaded_at DESC)
  WHERE parsed_status IN ('pending', 'parsed');

-- Pending exports
CREATE INDEX idx_exports_queued ON exports(created_at)
  WHERE status = 'queued';
