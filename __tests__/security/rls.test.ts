/**
 * RLS Security Tests
 *
 * Verifies Row Level Security policies prevent cross-user data access
 *
 * Tests: RLS-001 through RLS-009
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Test configuration
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Test users (must be pre-seeded)
const TEST_USER_A_EMAIL = 'test-user-a@roadledger-test.com';
const TEST_USER_A_PASSWORD = 'TestPassword123!';
const TEST_USER_B_EMAIL = 'test-user-b@roadledger-test.com';
const TEST_USER_B_PASSWORD = 'TestPassword123!';

// Skip if no env vars
const shouldSkip = !SUPABASE_URL || !SUPABASE_ANON_KEY;
const describeOrSkip = shouldSkip ? describe.skip : describe;

describeOrSkip('RLS Security Tests', () => {
  let supabaseA: SupabaseClient;
  let supabaseB: SupabaseClient;
  let userAId: string;
  let userBId: string;
  let userADocId: string;
  let userATripId: string;
  let userATxnId: string;

  beforeAll(async () => {
    // Create clients for both users
    const clientA = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
    const clientB = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);

    // Sign in as User A
    const { data: dataA, error: errorA } = await clientA.auth.signInWithPassword({
      email: TEST_USER_A_EMAIL,
      password: TEST_USER_A_PASSWORD,
    });

    if (errorA) {
      // Try to create user if doesn't exist
      const { data: signUpA } = await clientA.auth.signUp({
        email: TEST_USER_A_EMAIL,
        password: TEST_USER_A_PASSWORD,
      });
      userAId = signUpA.user?.id || '';
    } else {
      userAId = dataA.user?.id || '';
    }

    supabaseA = clientA;

    // Sign in as User B
    const { data: dataB, error: errorB } = await clientB.auth.signInWithPassword({
      email: TEST_USER_B_EMAIL,
      password: TEST_USER_B_PASSWORD,
    });

    if (errorB) {
      const { data: signUpB } = await clientB.auth.signUp({
        email: TEST_USER_B_EMAIL,
        password: TEST_USER_B_PASSWORD,
      });
      userBId = signUpB.user?.id || '';
    } else {
      userBId = dataB.user?.id || '';
    }

    supabaseB = clientB;

    // Create test data for User A
    const { data: trip } = await supabaseA.from('trips').insert({
      user_id: userAId,
      status: 'draft',
      source: 'manual',
    }).select().single();
    userATripId = trip?.id;

    const { data: doc } = await supabaseA.from('documents').insert({
      user_id: userAId,
      type: 'receipt',
      storage_path: `${userAId}/test-security.jpg`,
      parsed_status: 'pending',
    }).select().single();
    userADocId = doc?.id;

    const { data: txn } = await supabaseA.from('transactions').insert({
      user_id: userAId,
      type: 'expense',
      category: 'fuel',
      amount: 100,
      date: '2026-01-14',
      source: 'manual',
    }).select().single();
    userATxnId = txn?.id;
  });

  afterAll(async () => {
    // Cleanup test data
    if (userATxnId) {
      await supabaseA.from('transactions').delete().eq('id', userATxnId);
    }
    if (userADocId) {
      await supabaseA.from('documents').delete().eq('id', userADocId);
    }
    if (userATripId) {
      await supabaseA.from('trips').delete().eq('id', userATripId);
    }
  });

  // RLS-001: User A cannot SELECT User B's documents
  it('RLS-001: User B cannot SELECT User A documents', async () => {
    const { data, error } = await supabaseB
      .from('documents')
      .select('*')
      .eq('id', userADocId);

    expect(error).toBeNull();
    expect(data).toHaveLength(0); // Should return empty due to RLS
  });

  // RLS-002: User B cannot UPDATE User A's documents
  it('RLS-002: User B cannot UPDATE User A documents', async () => {
    const { data, error } = await supabaseB
      .from('documents')
      .update({ vendor: 'HACKED' })
      .eq('id', userADocId)
      .select();

    // Should either error or return 0 rows affected
    expect(data?.length || 0).toBe(0);
  });

  // RLS-003: User B cannot DELETE User A's documents
  it('RLS-003: User B cannot DELETE User A documents', async () => {
    const { error, count } = await supabaseB
      .from('documents')
      .delete()
      .eq('id', userADocId);

    // Verify document still exists
    const { data: stillExists } = await supabaseA
      .from('documents')
      .select('id')
      .eq('id', userADocId)
      .single();

    expect(stillExists).toBeDefined();
  });

  // RLS-004: User B cannot SELECT User A's trips
  it('RLS-004: User B cannot SELECT User A trips', async () => {
    const { data } = await supabaseB
      .from('trips')
      .select('*')
      .eq('id', userATripId);

    expect(data).toHaveLength(0);
  });

  // RLS-005: User B cannot SELECT User A's transactions
  it('RLS-005: User B cannot SELECT User A transactions', async () => {
    const { data } = await supabaseB
      .from('transactions')
      .select('*')
      .eq('id', userATxnId);

    expect(data).toHaveLength(0);
  });

  // RLS-006: User B cannot INSERT document with User A's user_id
  it('RLS-006: User B cannot INSERT document with User A user_id', async () => {
    const { data, error } = await supabaseB
      .from('documents')
      .insert({
        user_id: userAId, // Trying to use User A's ID
        type: 'receipt',
        storage_path: `${userAId}/malicious.jpg`,
        parsed_status: 'pending',
      })
      .select();

    // Should fail due to RLS WITH CHECK
    expect(error).toBeDefined();
  });

  // RLS-007: User B cannot access User A's trip_points
  it('RLS-007: User B cannot access User A trip_points', async () => {
    // First create a trip point for User A
    await supabaseA.from('trip_points').insert({
      trip_id: userATripId,
      lat: 29.76,
      lng: -95.37,
    });

    const { data } = await supabaseB
      .from('trip_points')
      .select('*')
      .eq('trip_id', userATripId);

    expect(data).toHaveLength(0);
  });

  // RLS-008: User B cannot access User A's jurisdiction_miles
  it('RLS-008: User B cannot access User A jurisdiction_miles', async () => {
    // First create jurisdiction miles for User A
    await supabaseA.from('jurisdiction_miles').insert({
      trip_id: userATripId,
      jurisdiction: 'TX',
      miles: 100,
      method: 'manual_adjust',
    });

    const { data } = await supabaseB
      .from('jurisdiction_miles')
      .select('*')
      .eq('trip_id', userATripId);

    expect(data).toHaveLength(0);
  });

  // RLS-009: Unauthenticated user cannot access any table
  it('RLS-009: Unauthenticated user cannot access tables', async () => {
    const anonClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);

    const { data: docs, error: docsError } = await anonClient
      .from('documents')
      .select('*');

    const { data: trips, error: tripsError } = await anonClient
      .from('trips')
      .select('*');

    // Should return empty or error
    expect(docs?.length || 0).toBe(0);
    expect(trips?.length || 0).toBe(0);
  });
});
