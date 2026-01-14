-- RoadLedger Seed Data
-- For development and testing purposes only

-- Note: This seed file is intentionally minimal.
-- User data should be created through the app's authentication flow.
-- Test data can be added here for development purposes.

-- Example: Insert test categories or jurisdictions if needed
-- (All jurisdictions are handled in the app code)

-- To test with a user, first create a user through Supabase Auth,
-- then the trigger will automatically create a profile.
-- After that, you can insert test data like:

/*
-- Example test trip (replace USER_ID with actual user id)
INSERT INTO trips (user_id, status, started_at, ended_at, loaded, source)
VALUES (
  'USER_ID_HERE',
  'finalized',
  NOW() - INTERVAL '2 hours',
  NOW() - INTERVAL '30 minutes',
  true,
  'gps'
);

-- Example test transaction
INSERT INTO transactions (user_id, type, category, amount, date, vendor, source)
VALUES (
  'USER_ID_HERE',
  'expense',
  'fuel',
  150.00,
  CURRENT_DATE,
  'Pilot Travel Center',
  'manual'
);
*/

-- Verify setup
DO $$
BEGIN
  RAISE NOTICE 'RoadLedger database initialized successfully!';
  RAISE NOTICE 'Tables created: profiles, trips, trip_points, jurisdiction_miles, documents, transactions, exports';
  RAISE NOTICE 'Storage buckets: receipts, settlements, exports';
END $$;
