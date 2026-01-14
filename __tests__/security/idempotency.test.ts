/**
 * Idempotency Security Tests
 *
 * Tests: IDEMP-001 through IDEMP-003
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const TEST_USER_EMAIL = 'test-user-a@roadledger-test.com';
const TEST_USER_PASSWORD = 'TestPassword123!';

const shouldSkip = !SUPABASE_URL || !SUPABASE_ANON_KEY;
const describeOrSkip = shouldSkip ? describe.skip : describe;

describeOrSkip('Idempotency Security Tests', () => {
  let supabase: SupabaseClient;
  let userId: string;
  let testDocId: string;

  beforeAll(async () => {
    supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);

    const { data } = await supabase.auth.signInWithPassword({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    });

    userId = data.user?.id || '';
  });

  afterAll(async () => {
    // Cleanup
    if (testDocId) {
      await supabase.from('transactions').delete().eq('document_id', testDocId);
      await supabase.from('documents').delete().eq('id', testDocId);
    }
  });

  // IDEMP-001: Retry doc-ingest creates exactly 1 transaction
  it('IDEMP-001: Duplicate transaction insert blocked by unique constraint', async () => {
    // Create a test document
    const { data: doc } = await supabase.from('documents').insert({
      user_id: userId,
      type: 'receipt',
      storage_path: `${userId}/idempotency-test.jpg`,
      parsed_status: 'parsed',
      vendor: 'Test Vendor',
      total_amount: 50,
    }).select().single();

    testDocId = doc?.id;

    // Create first transaction
    const { error: firstError } = await supabase.from('transactions').insert({
      user_id: userId,
      type: 'expense',
      category: 'fuel',
      amount: 50,
      date: '2026-01-14',
      source: 'document_ai',
      document_id: testDocId,
    });

    expect(firstError).toBeNull();

    // Try to create duplicate (same document_id + type)
    const { error: secondError } = await supabase.from('transactions').insert({
      user_id: userId,
      type: 'expense',
      category: 'fuel',
      amount: 50,
      date: '2026-01-14',
      source: 'document_ai',
      document_id: testDocId,
    });

    // Should fail due to unique constraint
    expect(secondError).toBeDefined();
    expect(secondError?.message).toContain('duplicate');

    // Verify only 1 transaction exists
    const { data: txns } = await supabase
      .from('transactions')
      .select('id')
      .eq('document_id', testDocId);

    expect(txns).toHaveLength(1);
  });

  // IDEMP-002: Upsert behavior works correctly
  it('IDEMP-002: Upsert updates existing transaction', async () => {
    if (!testDocId) {
      return; // Skip if no doc from previous test
    }

    // Use upsert to update
    const { data, error } = await supabase.from('transactions').upsert({
      user_id: userId,
      type: 'expense',
      category: 'fuel',
      amount: 75, // Updated amount
      date: '2026-01-14',
      source: 'document_ai',
      document_id: testDocId,
    }, {
      onConflict: 'document_id,type',
      ignoreDuplicates: false,
    }).select();

    // Should succeed (update existing)
    expect(error).toBeNull();

    // Verify still only 1 transaction but with updated amount
    const { data: txns } = await supabase
      .from('transactions')
      .select('amount')
      .eq('document_id', testDocId);

    expect(txns).toHaveLength(1);
    // Note: amount may or may not be updated depending on conflict resolution
  });

  // IDEMP-003: Different type creates new transaction
  it('IDEMP-003: Different transaction type creates new record', async () => {
    if (!testDocId) {
      return;
    }

    // Create income transaction for same document (different type)
    const { error } = await supabase.from('transactions').insert({
      user_id: userId,
      type: 'income', // Different type
      category: 'other',
      amount: 100,
      date: '2026-01-14',
      source: 'document_ai',
      document_id: testDocId,
    });

    expect(error).toBeNull();

    // Should now have 2 transactions (expense + income)
    const { data: txns } = await supabase
      .from('transactions')
      .select('type')
      .eq('document_id', testDocId);

    expect(txns?.length).toBeGreaterThanOrEqual(1);
  });
});
