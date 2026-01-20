-- Add sample data to demo account for App Store screenshots
-- Demo User ID: 2203501c-2e52-4c1a-842a-53873edfd39b
-- Run this via: npx supabase db push

-- First, update the profile with realistic info
UPDATE profiles SET
  full_name = 'Mike Johnson',
  company_name = 'Johnson Trucking LLC',
  home_state = 'TX',
  mc_number = 'MC-1234567',
  dot_number = '3456789',
  updated_at = NOW()
WHERE id = '2203501c-2e52-4c1a-842a-53873edfd39b';

-- Delete any existing demo trips first (clean slate)
DELETE FROM trips WHERE user_id = '2203501c-2e52-4c1a-842a-53873edfd39b';

-- Add completed trips with realistic data (last 30 days)
-- Note: trips uses started_at/ended_at, status='finalized', auto_miles_total
INSERT INTO trips (id, user_id, status, started_at, ended_at, auto_miles_total, loaded, notes, source, created_at)
VALUES
  -- Trip 1: Texas to California (3 days ago)
  ('a1000001-0000-0000-0000-000000000001', '2203501c-2e52-4c1a-842a-53873edfd39b', 'finalized',
   NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days', 1450, true, 'Walmart Distribution - Refrigerated load', 'gps', NOW() - INTERVAL '3 days'),

  -- Trip 2: California to Arizona (5 days ago)
  ('a1000001-0000-0000-0000-000000000002', '2203501c-2e52-4c1a-842a-53873edfd39b', 'finalized',
   NOW() - INTERVAL '6 days', NOW() - INTERVAL '5 days', 380, true, 'Amazon Fulfillment Center', 'gps', NOW() - INTERVAL '6 days'),

  -- Trip 3: Arizona to Texas (8 days ago)
  ('a1000001-0000-0000-0000-000000000003', '2203501c-2e52-4c1a-842a-53873edfd39b', 'finalized',
   NOW() - INTERVAL '9 days', NOW() - INTERVAL '8 days', 875, true, 'Home Depot - Building materials', 'gps', NOW() - INTERVAL '9 days'),

  -- Trip 4: Texas to Oklahoma (12 days ago)
  ('a1000001-0000-0000-0000-000000000004', '2203501c-2e52-4c1a-842a-53873edfd39b', 'finalized',
   NOW() - INTERVAL '13 days', NOW() - INTERVAL '12 days', 265, true, 'Costco Regional DC', 'gps', NOW() - INTERVAL '13 days'),

  -- Trip 5: Oklahoma to Texas (14 days ago)
  ('a1000001-0000-0000-0000-000000000005', '2203501c-2e52-4c1a-842a-53873edfd39b', 'finalized',
   NOW() - INTERVAL '15 days', NOW() - INTERVAL '14 days', 285, true, 'Return trip - Tyson Foods', 'gps', NOW() - INTERVAL '15 days'),

  -- Trip 6: Texas to Louisiana (18 days ago)
  ('a1000001-0000-0000-0000-000000000006', '2203501c-2e52-4c1a-842a-53873edfd39b', 'finalized',
   NOW() - INTERVAL '19 days', NOW() - INTERVAL '18 days', 420, true, 'Chemicals - Houston to Baton Rouge', 'gps', NOW() - INTERVAL '19 days'),

  -- Trip 7: Louisiana to Texas (20 days ago)
  ('a1000001-0000-0000-0000-000000000007', '2203501c-2e52-4c1a-842a-53873edfd39b', 'finalized',
   NOW() - INTERVAL '21 days', NOW() - INTERVAL '20 days', 350, true, 'Paper products - New Orleans', 'gps', NOW() - INTERVAL '21 days'),

  -- Trip 8: Texas to New Mexico (24 days ago)
  ('a1000001-0000-0000-0000-000000000008', '2203501c-2e52-4c1a-842a-53873edfd39b', 'finalized',
   NOW() - INTERVAL '25 days', NOW() - INTERVAL '24 days', 580, true, 'Electronics - El Paso area', 'gps', NOW() - INTERVAL '25 days');

-- Add jurisdiction miles for IFTA (per trip breakdown)
-- Note: jurisdiction_miles table has BIGSERIAL id, trip_id, jurisdiction, miles, confidence, method
-- The UNIQUE constraint is on (trip_id, jurisdiction)
INSERT INTO jurisdiction_miles (trip_id, jurisdiction, miles, confidence, method)
VALUES
  -- Trip 1: TX to CA (total 1450 miles)
  ('a1000001-0000-0000-0000-000000000001', 'TX', 450, 0.95, 'gps'),
  ('a1000001-0000-0000-0000-000000000001', 'NM', 380, 0.95, 'gps'),
  ('a1000001-0000-0000-0000-000000000001', 'AZ', 340, 0.95, 'gps'),
  ('a1000001-0000-0000-0000-000000000001', 'CA', 280, 0.95, 'gps'),

  -- Trip 2: CA to AZ (total 380 miles)
  ('a1000001-0000-0000-0000-000000000002', 'CA', 180, 0.95, 'gps'),
  ('a1000001-0000-0000-0000-000000000002', 'AZ', 200, 0.95, 'gps'),

  -- Trip 3: AZ to TX (total 875 miles)
  ('a1000001-0000-0000-0000-000000000003', 'AZ', 285, 0.95, 'gps'),
  ('a1000001-0000-0000-0000-000000000003', 'NM', 310, 0.95, 'gps'),
  ('a1000001-0000-0000-0000-000000000003', 'TX', 280, 0.95, 'gps'),

  -- Trip 4: TX to OK (total 265 miles)
  ('a1000001-0000-0000-0000-000000000004', 'TX', 165, 0.95, 'gps'),
  ('a1000001-0000-0000-0000-000000000004', 'OK', 100, 0.95, 'gps'),

  -- Trip 5: OK to TX (total 285 miles)
  ('a1000001-0000-0000-0000-000000000005', 'OK', 120, 0.95, 'gps'),
  ('a1000001-0000-0000-0000-000000000005', 'TX', 165, 0.95, 'gps'),

  -- Trip 6: TX to LA (total 420 miles)
  ('a1000001-0000-0000-0000-000000000006', 'TX', 280, 0.95, 'gps'),
  ('a1000001-0000-0000-0000-000000000006', 'LA', 140, 0.95, 'gps'),

  -- Trip 7: LA to TX (total 350 miles)
  ('a1000001-0000-0000-0000-000000000007', 'LA', 150, 0.95, 'gps'),
  ('a1000001-0000-0000-0000-000000000007', 'TX', 200, 0.95, 'gps'),

  -- Trip 8: TX to NM (total 580 miles)
  ('a1000001-0000-0000-0000-000000000008', 'TX', 350, 0.95, 'gps'),
  ('a1000001-0000-0000-0000-000000000008', 'NM', 230, 0.95, 'gps')
ON CONFLICT (trip_id, jurisdiction) DO UPDATE SET miles = EXCLUDED.miles;

-- Delete any existing demo transactions first (clean slate)
DELETE FROM transactions WHERE user_id = '2203501c-2e52-4c1a-842a-53873edfd39b';

-- Add transactions (income and expenses)
-- Note: txn_category enum: 'fuel', 'maintenance', 'tolls', 'scales', 'insurance', 'parking', 'food', 'other', 'settlement_deductions'
-- For income (load payments), use category 'other'
INSERT INTO transactions (id, user_id, type, category, amount, description, vendor, date, trip_id, source, created_at)
VALUES
  -- Load payments (income) - use 'other' category for load payments
  ('c1000001-0000-0000-0000-000000000001', '2203501c-2e52-4c1a-842a-53873edfd39b', 'income', 'other', 3625.00, 'Walmart Distribution - TX to CA ($2.50/mi)', 'C.H. Robinson', (NOW() - INTERVAL '1 day')::DATE, 'a1000001-0000-0000-0000-000000000001', 'manual', NOW() - INTERVAL '1 day'),
  ('c1000001-0000-0000-0000-000000000002', '2203501c-2e52-4c1a-842a-53873edfd39b', 'income', 'other', 950.00, 'Amazon FC - CA to AZ ($2.50/mi)', 'Amazon Relay', (NOW() - INTERVAL '4 days')::DATE, 'a1000001-0000-0000-0000-000000000002', 'manual', NOW() - INTERVAL '4 days'),
  ('c1000001-0000-0000-0000-000000000003', '2203501c-2e52-4c1a-842a-53873edfd39b', 'income', 'other', 2187.50, 'Home Depot - AZ to TX ($2.50/mi)', 'Landstar', (NOW() - INTERVAL '7 days')::DATE, 'a1000001-0000-0000-0000-000000000003', 'manual', NOW() - INTERVAL '7 days'),
  ('c1000001-0000-0000-0000-000000000004', '2203501c-2e52-4c1a-842a-53873edfd39b', 'income', 'other', 662.50, 'Costco DC - TX to OK ($2.50/mi)', 'XPO Logistics', (NOW() - INTERVAL '11 days')::DATE, 'a1000001-0000-0000-0000-000000000004', 'manual', NOW() - INTERVAL '11 days'),
  ('c1000001-0000-0000-0000-000000000005', '2203501c-2e52-4c1a-842a-53873edfd39b', 'income', 'other', 712.50, 'Tyson Foods - OK to TX ($2.50/mi)', 'Tyson Direct', (NOW() - INTERVAL '13 days')::DATE, 'a1000001-0000-0000-0000-000000000005', 'manual', NOW() - INTERVAL '13 days'),
  ('c1000001-0000-0000-0000-000000000006', '2203501c-2e52-4c1a-842a-53873edfd39b', 'income', 'other', 1260.00, 'Chemical Transport - TX to LA ($3.00/mi hazmat)', 'Schneider', (NOW() - INTERVAL '17 days')::DATE, 'a1000001-0000-0000-0000-000000000006', 'manual', NOW() - INTERVAL '17 days'),
  ('c1000001-0000-0000-0000-000000000007', '2203501c-2e52-4c1a-842a-53873edfd39b', 'income', 'other', 875.00, 'Paper Products - LA to TX ($2.50/mi)', 'JB Hunt', (NOW() - INTERVAL '19 days')::DATE, 'a1000001-0000-0000-0000-000000000007', 'manual', NOW() - INTERVAL '19 days'),
  ('c1000001-0000-0000-0000-000000000008', '2203501c-2e52-4c1a-842a-53873edfd39b', 'income', 'other', 1450.00, 'Electronics - TX to NM ($2.50/mi)', 'Werner', (NOW() - INTERVAL '23 days')::DATE, 'a1000001-0000-0000-0000-000000000008', 'manual', NOW() - INTERVAL '23 days'),

  -- Fuel expenses (with gallons)
  ('c1000001-0000-0000-0000-000000000009', '2203501c-2e52-4c1a-842a-53873edfd39b', 'expense', 'fuel', 485.50, 'Diesel - 125 gal @ $3.88', 'Pilot Flying J', (NOW() - INTERVAL '2 days')::DATE, 'a1000001-0000-0000-0000-000000000001', 'manual', NOW() - INTERVAL '2 days'),
  ('c1000001-0000-0000-0000-000000000010', '2203501c-2e52-4c1a-842a-53873edfd39b', 'expense', 'fuel', 223.30, 'Diesel - 58 gal @ $3.85', 'Loves', (NOW() - INTERVAL '3 days')::DATE, NULL, 'manual', NOW() - INTERVAL '3 days'),
  ('c1000001-0000-0000-0000-000000000011', '2203501c-2e52-4c1a-842a-53873edfd39b', 'expense', 'fuel', 178.20, 'Diesel - 45 gal @ $3.96', 'TA Petro', (NOW() - INTERVAL '5 days')::DATE, 'a1000001-0000-0000-0000-000000000002', 'manual', NOW() - INTERVAL '5 days'),
  ('c1000001-0000-0000-0000-000000000012', '2203501c-2e52-4c1a-842a-53873edfd39b', 'expense', 'fuel', 356.40, 'Diesel - 90 gal @ $3.96', 'Pilot Flying J', (NOW() - INTERVAL '8 days')::DATE, 'a1000001-0000-0000-0000-000000000003', 'manual', NOW() - INTERVAL '8 days'),
  ('c1000001-0000-0000-0000-000000000013', '2203501c-2e52-4c1a-842a-53873edfd39b', 'expense', 'fuel', 155.60, 'Diesel - 40 gal @ $3.89', 'Loves', (NOW() - INTERVAL '12 days')::DATE, 'a1000001-0000-0000-0000-000000000004', 'manual', NOW() - INTERVAL '12 days'),
  ('c1000001-0000-0000-0000-000000000014', '2203501c-2e52-4c1a-842a-53873edfd39b', 'expense', 'fuel', 163.80, 'Diesel - 42 gal @ $3.90', 'QuikTrip', (NOW() - INTERVAL '14 days')::DATE, 'a1000001-0000-0000-0000-000000000005', 'manual', NOW() - INTERVAL '14 days'),
  ('c1000001-0000-0000-0000-000000000015', '2203501c-2e52-4c1a-842a-53873edfd39b', 'expense', 'fuel', 232.50, 'Diesel - 62 gal @ $3.75', 'Buc-ees', (NOW() - INTERVAL '18 days')::DATE, 'a1000001-0000-0000-0000-000000000006', 'manual', NOW() - INTERVAL '18 days'),
  ('c1000001-0000-0000-0000-000000000016', '2203501c-2e52-4c1a-842a-53873edfd39b', 'expense', 'fuel', 198.90, 'Diesel - 51 gal @ $3.90', 'Pilot Flying J', (NOW() - INTERVAL '20 days')::DATE, 'a1000001-0000-0000-0000-000000000007', 'manual', NOW() - INTERVAL '20 days'),
  ('c1000001-0000-0000-0000-000000000017', '2203501c-2e52-4c1a-842a-53873edfd39b', 'expense', 'fuel', 287.00, 'Diesel - 70 gal @ $4.10', 'Loves', (NOW() - INTERVAL '24 days')::DATE, 'a1000001-0000-0000-0000-000000000008', 'manual', NOW() - INTERVAL '24 days'),

  -- Other expenses
  ('c1000001-0000-0000-0000-000000000018', '2203501c-2e52-4c1a-842a-53873edfd39b', 'expense', 'maintenance', 189.00, 'Oil change + filter', 'TA Truck Service', (NOW() - INTERVAL '10 days')::DATE, NULL, 'manual', NOW() - INTERVAL '10 days'),
  ('c1000001-0000-0000-0000-000000000019', '2203501c-2e52-4c1a-842a-53873edfd39b', 'expense', 'tolls', 45.80, 'TX toll roads', 'TxTag', (NOW() - INTERVAL '3 days')::DATE, 'a1000001-0000-0000-0000-000000000001', 'manual', NOW() - INTERVAL '3 days'),
  ('c1000001-0000-0000-0000-000000000020', '2203501c-2e52-4c1a-842a-53873edfd39b', 'expense', 'tolls', 28.50, 'OK turnpike', 'Pikepass', (NOW() - INTERVAL '12 days')::DATE, 'a1000001-0000-0000-0000-000000000004', 'manual', NOW() - INTERVAL '12 days'),
  ('c1000001-0000-0000-0000-000000000021', '2203501c-2e52-4c1a-842a-53873edfd39b', 'expense', 'scales', 12.00, 'Weigh station', 'CAT Scale', (NOW() - INTERVAL '8 days')::DATE, 'a1000001-0000-0000-0000-000000000003', 'manual', NOW() - INTERVAL '8 days'),
  ('c1000001-0000-0000-0000-000000000022', '2203501c-2e52-4c1a-842a-53873edfd39b', 'expense', 'food', 156.00, 'Meals on the road (per diem)', 'Various', (NOW() - INTERVAL '7 days')::DATE, NULL, 'manual', NOW() - INTERVAL '7 days'),
  ('c1000001-0000-0000-0000-000000000023', '2203501c-2e52-4c1a-842a-53873edfd39b', 'expense', 'parking', 35.00, 'Overnight parking', 'Pilot Flying J', (NOW() - INTERVAL '2 days')::DATE, 'a1000001-0000-0000-0000-000000000001', 'manual', NOW() - INTERVAL '2 days'),
  ('c1000001-0000-0000-0000-000000000024', '2203501c-2e52-4c1a-842a-53873edfd39b', 'expense', 'insurance', 1250.00, 'Monthly truck insurance', 'Progressive Commercial', (NOW() - INTERVAL '15 days')::DATE, NULL, 'manual', NOW() - INTERVAL '15 days'),
  ('c1000001-0000-0000-0000-000000000025', '2203501c-2e52-4c1a-842a-53873edfd39b', 'expense', 'other', 1850.00, 'Truck loan payment', 'Daimler Truck Financial', (NOW() - INTERVAL '15 days')::DATE, NULL, 'manual', NOW() - INTERVAL '15 days')
ON CONFLICT (id) DO UPDATE SET
  amount = EXCLUDED.amount,
  description = EXCLUDED.description;

-- Add sample documents (receipts for some transactions)
INSERT INTO documents (id, user_id, trip_id, type, storage_path, uploaded_at, parsed_status, vendor, document_date, total_amount)
VALUES
  ('d1000001-0000-0000-0000-000000000001', '2203501c-2e52-4c1a-842a-53873edfd39b', 'a1000001-0000-0000-0000-000000000001', 'receipt', 'demo/fuel-receipt-001.jpg', NOW() - INTERVAL '2 days', 'parsed', 'Pilot Flying J', (NOW() - INTERVAL '2 days')::DATE, 485.50),
  ('d1000001-0000-0000-0000-000000000002', '2203501c-2e52-4c1a-842a-53873edfd39b', NULL, 'receipt', 'demo/fuel-receipt-002.jpg', NOW() - INTERVAL '3 days', 'parsed', 'Loves', (NOW() - INTERVAL '3 days')::DATE, 223.30),
  ('d1000001-0000-0000-0000-000000000003', '2203501c-2e52-4c1a-842a-53873edfd39b', NULL, 'settlement', 'demo/settlement-001.pdf', NOW() - INTERVAL '1 day', 'parsed', 'C.H. Robinson', (NOW() - INTERVAL '1 day')::DATE, 3625.00),
  ('d1000001-0000-0000-0000-000000000004', '2203501c-2e52-4c1a-842a-53873edfd39b', NULL, 'maintenance', 'demo/maintenance-001.jpg', NOW() - INTERVAL '10 days', 'parsed', 'TA Truck Service', (NOW() - INTERVAL '10 days')::DATE, 189.00)
ON CONFLICT (id) DO NOTHING;

-- Summary of data added:
-- Total Revenue: $11,722.50
-- Total Fuel: $2,281.20
-- Total Other Expenses: $3,566.30
-- Net Profit: $5,875.00
-- Total Miles: 4,605
-- States: TX, CA, AZ, NM, OK, LA (6 states)
-- 8 completed trips
-- 25 transactions (8 income, 17 expenses)
-- 4 documents
