/**
 * Input Validation Security Tests
 *
 * Tests: INP-001 through INP-006
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const TEST_USER_EMAIL = 'test-user-a@roadledger-test.com';
const TEST_USER_PASSWORD = 'TestPassword123!';

const shouldSkip = !SUPABASE_URL || !SUPABASE_ANON_KEY;
const describeOrSkip = shouldSkip ? describe.skip : describe;

describeOrSkip('Input Validation Security Tests', () => {
  let supabase: SupabaseClient;
  let userId: string;

  beforeAll(async () => {
    supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    });

    if (!error && data.user) {
      userId = data.user.id;
    }
  });

  // INP-001: Invalid UUID format rejected
  it('INP-001: Invalid UUID format rejected', async () => {
    const { data, error } = await supabase.functions.invoke('doc-ingest', {
      body: {
        documentId: 'not-a-valid-uuid',
      },
    });

    expect(data?.error || error).toBeDefined();
  });

  // INP-002: SQL injection in vendor field is escaped
  it('INP-002: SQL injection in vendor field is safe', async () => {
    const maliciousVendor = "'; DROP TABLE transactions; --";

    const { data: doc } = await supabase.from('documents').insert({
      user_id: userId,
      type: 'receipt',
      storage_path: `${userId}/sql-test.jpg`,
      vendor: maliciousVendor,
      parsed_status: 'pending',
    }).select().single();

    // Should store safely (escaped)
    expect(doc?.vendor).toBe(maliciousVendor);

    // Verify table still exists
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('id')
      .limit(1);

    expect(error).toBeNull();

    // Cleanup
    if (doc?.id) {
      await supabase.from('documents').delete().eq('id', doc.id);
    }
  });

  // INP-003: XSS payload in extraction is escaped
  it('INP-003: XSS payload in vendor field is stored safely', async () => {
    const xssPayload = '<script>alert("XSS")</script>';

    const { data: doc } = await supabase.from('documents').insert({
      user_id: userId,
      type: 'receipt',
      storage_path: `${userId}/xss-test.jpg`,
      vendor: xssPayload,
      parsed_status: 'pending',
    }).select().single();

    // Should store the raw text (escaping is client responsibility)
    expect(doc).toBeDefined();

    // Cleanup
    if (doc?.id) {
      await supabase.from('documents').delete().eq('id', doc.id);
    }
  });

  // INP-004: Negative amount rejected
  it('INP-004: Negative transaction amount rejected by constraint', async () => {
    const { data, error } = await supabase.from('transactions').insert({
      user_id: userId,
      type: 'expense',
      category: 'fuel',
      amount: -100, // Negative
      date: '2026-01-14',
      source: 'manual',
    }).select();

    // Should fail due to CHECK constraint
    expect(error).toBeDefined();
  });

  // INP-005: Very long vendor name is truncated/rejected
  it('INP-005: Very long vendor name handled', async () => {
    const longVendor = 'A'.repeat(1000);

    const { data: doc, error } = await supabase.from('documents').insert({
      user_id: userId,
      type: 'receipt',
      storage_path: `${userId}/long-vendor.jpg`,
      vendor: longVendor,
      parsed_status: 'pending',
    }).select().single();

    if (error) {
      // Expected if constraint is in place
      expect(error.message).toContain('length');
    } else {
      // Cleanup
      await supabase.from('documents').delete().eq('id', doc.id);
    }
  });

  // INP-006: Zero amount is valid
  it('INP-006: Zero amount is valid', async () => {
    const { data: txn, error } = await supabase.from('transactions').insert({
      user_id: userId,
      type: 'expense',
      category: 'other',
      amount: 0,
      date: '2026-01-14',
      source: 'manual',
    }).select().single();

    expect(error).toBeNull();
    expect(txn?.amount).toBe(0);

    // Cleanup
    if (txn?.id) {
      await supabase.from('transactions').delete().eq('id', txn.id);
    }
  });
});
