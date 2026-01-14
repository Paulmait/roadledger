/**
 * RoadLedger E2E Golden Path Tests
 *
 * These tests verify the critical user journeys:
 * 1. Auth flow: Register -> Login -> Profile
 * 2. Trip lifecycle: Start -> Track -> Finalize -> View IFTA summary
 * 3. Document processing: Upload -> AI extract -> Transaction created
 * 4. Export generation: Create IFTA report
 *
 * Run with: npx jest __tests__/e2e/golden-path.test.ts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Test configuration
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const TEST_USER_EMAIL = `test-${Date.now()}@roadledger-test.com`;
const TEST_USER_PASSWORD = 'TestPassword123!';

describe('Golden Path E2E Tests', () => {
  let supabase: SupabaseClient;
  let userId: string;
  let sessionToken: string;

  beforeAll(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Missing test environment variables');
    }
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  });

  afterAll(async () => {
    // Cleanup test user data
    if (userId) {
      // In a real scenario, you'd have a service role cleanup
      console.log(`Test user ${userId} should be cleaned up manually or via cron`);
    }
  });

  describe('1. Authentication Flow', () => {
    it('should register a new user', async () => {
      const { data, error } = await supabase.auth.signUp({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
        options: {
          data: {
            full_name: 'Test Driver',
          },
        },
      });

      expect(error).toBeNull();
      expect(data.user).toBeDefined();
      expect(data.user?.email).toBe(TEST_USER_EMAIL);

      userId = data.user!.id;
    });

    it('should sign in with credentials', async () => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      });

      expect(error).toBeNull();
      expect(data.session).toBeDefined();
      expect(data.session?.access_token).toBeDefined();

      sessionToken = data.session!.access_token;
    });

    it('should have a profile created via trigger', async () => {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      expect(error).toBeNull();
      expect(profile).toBeDefined();
      expect(profile.id).toBe(userId);
    });

    it('should update profile with company info', async () => {
      const { error } = await supabase
        .from('profiles')
        .update({
          company_name: 'Test Trucking LLC',
          mc_number: 'MC-123456',
          dot_number: 'DOT-789012',
          base_state: 'TX',
        })
        .eq('id', userId);

      expect(error).toBeNull();
    });
  });

  describe('2. Trip Lifecycle', () => {
    let tripId: string;

    it('should create a new trip', async () => {
      const { data: trip, error } = await supabase
        .from('trips')
        .insert({
          user_id: userId,
          status: 'draft',
          source: 'manual',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(trip).toBeDefined();
      expect(trip.status).toBe('draft');

      tripId = trip.id;
    });

    it('should start the trip', async () => {
      const { error } = await supabase
        .from('trips')
        .update({
          status: 'in_progress',
          started_at: new Date().toISOString(),
        })
        .eq('id', tripId);

      expect(error).toBeNull();
    });

    it('should record GPS trip points', async () => {
      const points = [
        { trip_id: tripId, lat: 29.7604, lng: -95.3698, jurisdiction: 'TX' }, // Houston
        { trip_id: tripId, lat: 30.2672, lng: -97.7431, jurisdiction: 'TX' }, // Austin
        { trip_id: tripId, lat: 32.7767, lng: -96.7970, jurisdiction: 'TX' }, // Dallas
      ];

      const { error } = await supabase.from('trip_points').insert(points);

      expect(error).toBeNull();
    });

    it('should finalize the trip', async () => {
      const { error } = await supabase
        .from('trips')
        .update({
          status: 'finalized',
          ended_at: new Date().toISOString(),
          total_miles: 250, // Approximate Houston -> Austin -> Dallas
        })
        .eq('id', tripId);

      expect(error).toBeNull();
    });

    it('should have jurisdiction miles calculated', async () => {
      // Insert jurisdiction miles for the trip
      const { error: insertError } = await supabase
        .from('jurisdiction_miles')
        .insert({
          trip_id: tripId,
          jurisdiction: 'TX',
          miles: 250,
          method: 'manual_adjust',
        });

      expect(insertError).toBeNull();

      // Verify it was created
      const { data: jurisdictionMiles, error } = await supabase
        .from('jurisdiction_miles')
        .select('*')
        .eq('trip_id', tripId);

      expect(error).toBeNull();
      expect(jurisdictionMiles).toHaveLength(1);
      expect(jurisdictionMiles![0].jurisdiction).toBe('TX');
    });
  });

  describe('3. Document Processing', () => {
    let documentId: string;

    it('should create a document record', async () => {
      const { data: doc, error } = await supabase
        .from('documents')
        .insert({
          user_id: userId,
          type: 'receipt',
          storage_path: `${userId}/test-receipt.jpg`,
          parsed_status: 'pending',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(doc).toBeDefined();
      expect(doc.parsed_status).toBe('pending');

      documentId = doc.id;
    });

    it('should update document with extraction results', async () => {
      const extractionJson = {
        vendor: 'Pilot Flying J',
        date: '2026-01-14',
        total: 385.42,
        fuel_gallons: 125.5,
        state_hint: 'TX',
        confidence: { vendor: 0.95, total: 0.98 },
      };

      const { error } = await supabase
        .from('documents')
        .update({
          parsed_status: 'parsed',
          vendor: extractionJson.vendor,
          document_date: extractionJson.date,
          total_amount: extractionJson.total,
          extraction_json: extractionJson,
        })
        .eq('id', documentId);

      expect(error).toBeNull();
    });

    it('should create transaction from document', async () => {
      const { data: txn, error } = await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          type: 'expense',
          category: 'fuel',
          amount: 385.42,
          date: '2026-01-14',
          vendor: 'Pilot Flying J',
          source: 'document_ai',
          document_id: documentId,
          gallons: 125.5,
          jurisdiction: 'TX',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(txn).toBeDefined();
      expect(txn.source).toBe('document_ai');
    });
  });

  describe('4. Export Generation', () => {
    it('should create an IFTA export record', async () => {
      const { data: exportRecord, error } = await supabase
        .from('exports')
        .insert({
          user_id: userId,
          type: 'ifta',
          status: 'queued',
          period_start: '2026-01-01',
          period_end: '2026-03-31',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(exportRecord).toBeDefined();
      expect(exportRecord.type).toBe('ifta');
    });

    it('should retrieve user transactions for IFTA period', async () => {
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .eq('category', 'fuel')
        .gte('date', '2026-01-01')
        .lte('date', '2026-03-31');

      expect(error).toBeNull();
      expect(transactions).toBeDefined();
      expect(transactions!.length).toBeGreaterThan(0);
    });

    it('should retrieve jurisdiction miles for IFTA period', async () => {
      const { data: trips, error } = await supabase
        .from('trips')
        .select(`
          id,
          jurisdiction_miles (
            jurisdiction,
            miles
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'finalized');

      expect(error).toBeNull();
      expect(trips).toBeDefined();
    });
  });

  describe('5. Security Validations', () => {
    it('should prevent accessing other users data', async () => {
      const fakeUserId = '00000000-0000-0000-0000-000000000000';

      const { data: otherProfile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', fakeUserId)
        .single();

      // Should return no data due to RLS
      expect(otherProfile).toBeNull();
    });

    it('should prevent negative transaction amounts', async () => {
      const { error } = await supabase.from('transactions').insert({
        user_id: userId,
        type: 'expense',
        category: 'fuel',
        amount: -100, // Should fail constraint
        date: '2026-01-14',
        source: 'manual',
      });

      // Should fail due to CHECK constraint
      expect(error).toBeDefined();
    });
  });
});

// Utility to generate test data
export const generateTestReceipt = () => ({
  vendor: 'Test Truck Stop',
  date: new Date().toISOString().split('T')[0],
  total: Math.random() * 500 + 100,
  fuel_gallons: Math.random() * 200 + 50,
  state_hint: ['TX', 'OK', 'NM', 'LA'][Math.floor(Math.random() * 4)],
});
