-- ============================================
-- RoadLedger - Broker Ratings & Advanced Features
-- ============================================
-- Community-driven broker/shipper ratings
-- Deadhead tracking, detention time, fuel optimization
-- ============================================

-- Broker/Shipper directory with ratings
CREATE TABLE IF NOT EXISTS brokers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  mc_number TEXT UNIQUE,
  dot_number TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  address TEXT,
  city TEXT,
  state TEXT,

  -- Aggregated ratings (updated by trigger)
  overall_rating NUMERIC(3,2) DEFAULT 0,
  total_ratings INTEGER DEFAULT 0,
  payment_speed_avg NUMERIC(3,2) DEFAULT 0, -- 1-5 stars
  communication_avg NUMERIC(3,2) DEFAULT 0,
  load_accuracy_avg NUMERIC(3,2) DEFAULT 0,
  would_work_again_pct NUMERIC(5,2) DEFAULT 0, -- percentage

  -- Payment stats
  avg_days_to_pay INTEGER,
  quick_pay_available BOOLEAN DEFAULT false,
  factoring_friendly BOOLEAN DEFAULT true,

  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Individual broker ratings from users
CREATE TABLE IF NOT EXISTS broker_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,

  -- Ratings (1-5)
  overall_rating INTEGER NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  payment_speed INTEGER CHECK (payment_speed BETWEEN 1 AND 5),
  communication INTEGER CHECK (communication BETWEEN 1 AND 5),
  load_accuracy INTEGER CHECK (load_accuracy BETWEEN 1 AND 5), -- Was the load as described?

  -- Details
  would_work_again BOOLEAN,
  days_to_pay INTEGER,
  review_text TEXT,

  -- Load reference (optional)
  load_origin TEXT,
  load_destination TEXT,
  load_date DATE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One rating per user per broker (can update)
  UNIQUE(user_id, broker_id)
);

-- Deadhead tracking (empty miles)
ALTER TABLE trips ADD COLUMN IF NOT EXISTS is_deadhead BOOLEAN DEFAULT false;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS deadhead_reason TEXT; -- 'to_pickup', 'to_home', 'repositioning'
ALTER TABLE trips ADD COLUMN IF NOT EXISTS linked_load_id UUID REFERENCES trips(id);

-- Detention time tracking
CREATE TABLE IF NOT EXISTS detention_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,

  location_type TEXT NOT NULL, -- 'pickup', 'delivery'
  facility_name TEXT,
  facility_address TEXT,

  -- Times
  appointment_time TIMESTAMPTZ,
  arrived_at TIMESTAMPTZ NOT NULL,
  loading_started_at TIMESTAMPTZ,
  departed_at TIMESTAMPTZ,

  -- Calculated
  wait_time_minutes INTEGER,
  billable_minutes INTEGER, -- After 2-hour free time typically

  -- Billing
  detention_rate NUMERIC(10,2), -- $/hour
  amount_billed NUMERIC(10,2),
  amount_collected NUMERIC(10,2),
  payment_status TEXT DEFAULT 'pending', -- 'pending', 'invoiced', 'paid', 'disputed'

  notes TEXT,
  photo_urls TEXT[], -- Evidence photos

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fuel purchase tracking with optimization data
CREATE TABLE IF NOT EXISTS fuel_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,

  -- Location
  station_name TEXT,
  station_brand TEXT,
  address TEXT,
  city TEXT,
  state TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,

  -- Purchase details
  fuel_type TEXT DEFAULT 'diesel', -- 'diesel', 'def', 'regular', 'premium'
  gallons NUMERIC(10,3) NOT NULL,
  price_per_gallon NUMERIC(6,3) NOT NULL,
  total_amount NUMERIC(10,2) NOT NULL,

  -- Optimization
  was_recommended BOOLEAN DEFAULT false, -- Did they follow app recommendation?
  potential_savings NUMERIC(10,2), -- If they filled elsewhere

  -- Truck status at fill
  odometer_reading INTEGER,
  tank_level_before INTEGER, -- percentage
  tank_level_after INTEGER,

  purchase_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User's operating costs for load calculator
CREATE TABLE IF NOT EXISTS user_operating_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,

  -- Vehicle info
  truck_year INTEGER,
  truck_make TEXT,
  truck_model TEXT,
  trailer_type TEXT, -- 'dry_van', 'reefer', 'flatbed', 'tanker'

  -- Per-mile costs
  fuel_cost_per_mile NUMERIC(6,4) DEFAULT 0.65,
  maintenance_per_mile NUMERIC(6,4) DEFAULT 0.15,
  tires_per_mile NUMERIC(6,4) DEFAULT 0.04,

  -- Monthly fixed costs
  truck_payment NUMERIC(10,2) DEFAULT 1800,
  trailer_payment NUMERIC(10,2) DEFAULT 750,
  insurance_monthly NUMERIC(10,2) DEFAULT 1200,
  permits_monthly NUMERIC(10,2) DEFAULT 300,

  -- Efficiency
  avg_mpg NUMERIC(4,2) DEFAULT 6.5,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Push notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,

  -- IFTA/Tax reminders
  ifta_deadline_reminder BOOLEAN DEFAULT true,
  ifta_reminder_days INTEGER DEFAULT 7, -- Days before deadline
  quarterly_tax_reminder BOOLEAN DEFAULT true,

  -- Trip alerts
  trip_end_reminder BOOLEAN DEFAULT true, -- Remind to end trip
  trip_summary_daily BOOLEAN DEFAULT true,

  -- Fuel alerts
  fuel_price_alerts BOOLEAN DEFAULT true,
  fuel_price_threshold NUMERIC(4,2), -- Alert when price drops below

  -- Payment alerts
  payment_received BOOLEAN DEFAULT true,
  invoice_overdue BOOLEAN DEFAULT true,

  -- Marketing (opt-in)
  tips_and_updates BOOLEAN DEFAULT false,

  push_token TEXT, -- Expo push token

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Saved lanes (frequently run routes)
CREATE TABLE IF NOT EXISTS saved_lanes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  origin_city TEXT NOT NULL,
  origin_state TEXT NOT NULL,
  destination_city TEXT NOT NULL,
  destination_state TEXT NOT NULL,

  -- Stats from actual runs
  times_run INTEGER DEFAULT 0,
  avg_rate NUMERIC(10,2),
  avg_rate_per_mile NUMERIC(6,2),
  best_rate NUMERIC(10,2),
  avg_fuel_cost NUMERIC(10,2),
  avg_profit NUMERIC(10,2),
  avg_miles INTEGER,

  -- Preferences
  favorite BOOLEAN DEFAULT false,
  notes TEXT,
  preferred_brokers UUID[], -- References to brokers table

  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, origin_city, origin_state, destination_city, destination_state)
);

-- Function to update broker aggregate ratings
CREATE OR REPLACE FUNCTION update_broker_ratings()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE brokers SET
    overall_rating = (
      SELECT AVG(overall_rating) FROM broker_ratings WHERE broker_id = NEW.broker_id
    ),
    total_ratings = (
      SELECT COUNT(*) FROM broker_ratings WHERE broker_id = NEW.broker_id
    ),
    payment_speed_avg = (
      SELECT AVG(payment_speed) FROM broker_ratings WHERE broker_id = NEW.broker_id AND payment_speed IS NOT NULL
    ),
    communication_avg = (
      SELECT AVG(communication) FROM broker_ratings WHERE broker_id = NEW.broker_id AND communication IS NOT NULL
    ),
    load_accuracy_avg = (
      SELECT AVG(load_accuracy) FROM broker_ratings WHERE broker_id = NEW.broker_id AND load_accuracy IS NOT NULL
    ),
    would_work_again_pct = (
      SELECT (COUNT(*) FILTER (WHERE would_work_again = true)::NUMERIC / NULLIF(COUNT(*) FILTER (WHERE would_work_again IS NOT NULL), 0)) * 100
      FROM broker_ratings WHERE broker_id = NEW.broker_id
    ),
    avg_days_to_pay = (
      SELECT AVG(days_to_pay) FROM broker_ratings WHERE broker_id = NEW.broker_id AND days_to_pay IS NOT NULL
    ),
    updated_at = NOW()
  WHERE id = NEW.broker_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_broker_ratings_trigger
  AFTER INSERT OR UPDATE ON broker_ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_broker_ratings();

-- RLS Policies
ALTER TABLE brokers ENABLE ROW LEVEL SECURITY;
ALTER TABLE broker_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE detention_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_operating_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_lanes ENABLE ROW LEVEL SECURITY;

-- Brokers: Public read, authenticated write
CREATE POLICY "Anyone can view brokers" ON brokers FOR SELECT USING (true);
CREATE POLICY "Authenticated users can add brokers" ON brokers FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admin can update brokers" ON brokers FOR UPDATE USING (is_admin());

-- Broker ratings: Users can manage their own
CREATE POLICY "Users can view all ratings" ON broker_ratings FOR SELECT USING (true);
CREATE POLICY "Users can manage own ratings" ON broker_ratings FOR ALL USING (auth.uid() = user_id);

-- Other tables: Users see only their own data
CREATE POLICY "Users manage own detention events" ON detention_events FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own fuel purchases" ON fuel_purchases FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own operating costs" ON user_operating_costs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own notifications" ON notification_preferences FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own lanes" ON saved_lanes FOR ALL USING (auth.uid() = user_id);

-- Admin can view all
CREATE POLICY "Admin can view detention events" ON detention_events FOR SELECT USING (is_admin());
CREATE POLICY "Admin can view fuel purchases" ON fuel_purchases FOR SELECT USING (is_admin());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_brokers_mc ON brokers(mc_number);
CREATE INDEX IF NOT EXISTS idx_brokers_rating ON brokers(overall_rating DESC) WHERE total_ratings >= 5;
CREATE INDEX IF NOT EXISTS idx_broker_ratings_broker ON broker_ratings(broker_id);
CREATE INDEX IF NOT EXISTS idx_detention_user ON detention_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fuel_purchases_user ON fuel_purchases(user_id, purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_fuel_purchases_state ON fuel_purchases(state);
CREATE INDEX IF NOT EXISTS idx_saved_lanes_user ON saved_lanes(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_lanes_route ON saved_lanes(origin_state, destination_state);

-- Trigger for updated_at
CREATE TRIGGER update_brokers_updated_at
  BEFORE UPDATE ON brokers FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_operating_costs_updated_at
  BEFORE UPDATE ON user_operating_costs FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_saved_lanes_updated_at
  BEFORE UPDATE ON saved_lanes FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
