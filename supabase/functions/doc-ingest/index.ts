// Supabase Edge Function: doc-ingest (Production Hardened)
// Processes uploaded documents using AI extraction with fallback support

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import {
  isValidUuid,
  validateDocumentId,
  isAllowedMimeType,
  safeErrorResponse,
  sanitizeForLog,
  validateAmount,
  validateDateString,
  truncateExtractionJson,
  ALLOWED_DOCUMENT_TYPES,
  MAX_FILE_SIZE_BYTES,
} from '../_shared/validation.ts';
import { extractWithFallback, AIExtractionResult } from '../_shared/ai-provider.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const RECEIPT_EXTRACTION_PROMPT = `You are analyzing a receipt image. Extract the following information in JSON format:

{
  "vendor": "The business name (string or null)",
  "date": "Date in YYYY-MM-DD format (string or null)",
  "total": "Total amount as a number (number or null)",
  "currency": "Currency code like USD (string, default USD)",
  "category_guess": "One of: fuel, maintenance, tolls, scales, parking, food, other (string or null)",
  "fuel_gallons": "If this is a fuel receipt, the number of gallons (number or null)",
  "fuel_price_per_gallon": "Price per gallon if applicable (number or null)",
  "state_hint": "Two-letter state code if visible (string or null)",
  "confidence": {
    "vendor": 0.0-1.0,
    "date": 0.0-1.0,
    "total": 0.0-1.0,
    "category_guess": 0.0-1.0
  }
}

Only return valid JSON. If you can't extract a field, use null.`;

const SETTLEMENT_EXTRACTION_PROMPT = `You are analyzing a trucking settlement statement. Extract the following information in JSON format:

{
  "carrier": "The carrier/company name (string or null)",
  "period_start": "Settlement period start in YYYY-MM-DD format (string or null)",
  "period_end": "Settlement period end in YYYY-MM-DD format (string or null)",
  "gross_pay": "Gross pay amount as a number (number or null)",
  "net_pay": "Net pay amount as a number (number or null)",
  "deductions": [
    {"description": "Deduction name", "amount": 0.00}
  ],
  "load_refs": ["Load reference numbers as strings"],
  "confidence": {
    "carrier": 0.0-1.0,
    "gross_pay": 0.0-1.0,
    "net_pay": 0.0-1.0
  }
}

Only return valid JSON. If you can't extract a field, use null or empty array.`;

serve(async (req) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return safeErrorResponse('Method not allowed', 405, corsHeaders);
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return safeErrorResponse('Missing or invalid authorization', 401, corsHeaders);
    }

    // Create Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Client for auth verification (uses user's token)
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Service client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user authentication
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return safeErrorResponse('Unauthorized', 401, corsHeaders, authError);
    }

    console.log(`[${requestId}] User ${user.id} invoking doc-ingest`);

    // Check rate limit
    const { data: rateLimitOk } = await supabase.rpc('check_function_rate_limit', {
      p_user_id: user.id,
      p_function_name: 'doc-ingest',
      p_max_per_minute: 5,
      p_max_per_hour: 50,
    });

    if (rateLimitOk === false) {
      console.warn(`[${requestId}] Rate limit exceeded for user ${user.id}`);
      return safeErrorResponse('Rate limit exceeded. Please try again later.', 429, corsHeaders);
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return safeErrorResponse('Invalid JSON body', 400, corsHeaders);
    }

    const validation = validateDocumentId(body);
    if (!validation.valid) {
      return safeErrorResponse(validation.error, 400, corsHeaders);
    }

    const { documentId } = validation;

    // Get document from database with ownership check
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('user_id', user.id) // CRITICAL: Ownership verification
      .single();

    if (docError || !document) {
      console.warn(`[${requestId}] Document not found or not owned: ${documentId}`);
      return safeErrorResponse('Document not found', 404, corsHeaders);
    }

    // Check if already processed (idempotency)
    if (document.parsed_status === 'parsed') {
      console.log(`[${requestId}] Document already processed: ${documentId}`);
      return new Response(
        JSON.stringify({
          success: true,
          parsed_status: 'parsed',
          extracted: document.extraction_json,
          cached: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update processing status
    await supabase
      .from('documents')
      .update({
        processing_started_at: new Date().toISOString(),
        processing_attempts: (document.processing_attempts || 0) + 1,
      })
      .eq('id', documentId);

    // Download file from storage
    const bucket = document.type === 'settlement' ? 'settlements' : 'receipts';
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(document.storage_path);

    if (downloadError || !fileData) {
      console.error(`[${requestId}] Download error:`, sanitizeForLog(downloadError?.message || 'Unknown'));
      await updateDocumentStatus(supabase, documentId, 'failed', 'Failed to download file');
      return safeErrorResponse('Failed to download file', 500, corsHeaders);
    }

    // Validate file size
    const arrayBuffer = await fileData.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_FILE_SIZE_BYTES) {
      await updateDocumentStatus(supabase, documentId, 'failed', 'File too large');
      return safeErrorResponse('File too large (max 10MB)', 400, corsHeaders);
    }

    // Validate MIME type
    const contentType = fileData.type || 'image/jpeg';
    if (!isAllowedMimeType(contentType, ALLOWED_DOCUMENT_TYPES)) {
      await updateDocumentStatus(supabase, documentId, 'failed', 'Unsupported file type');
      return safeErrorResponse('Unsupported file type', 400, corsHeaders);
    }

    // Convert to base64
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ''
      )
    );

    // Select prompt based on document type
    const prompt =
      document.type === 'settlement'
        ? SETTLEMENT_EXTRACTION_PROMPT
        : RECEIPT_EXTRACTION_PROMPT;

    // Call AI with fallback support
    const aiResult = await extractWithFallback(prompt, base64, contentType);

    if (!aiResult.success || !aiResult.data) {
      console.error(`[${requestId}] AI extraction failed:`, aiResult.error);
      await updateDocumentStatus(supabase, documentId, 'failed', aiResult.error || 'AI extraction failed');
      return safeErrorResponse('AI extraction failed', 500, corsHeaders);
    }

    const extracted = aiResult.data;
    console.log(`[${requestId}] Extraction successful via ${aiResult.provider} in ${aiResult.elapsed_ms}ms`);

    // Validate and sanitize extracted amounts
    const totalAmount = validateAmount(extracted.total || extracted.net_pay);
    const extractedDate = validateDateString(extracted.date || extracted.period_end);

    // Truncate extraction JSON if too large
    const safeExtractionJson = truncateExtractionJson(extracted);

    // Update document with extracted data
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        parsed_status: 'parsed',
        vendor: String(extracted.vendor || extracted.carrier || '').substring(0, 255),
        document_date: extractedDate,
        total_amount: totalAmount,
        extraction_json: safeExtractionJson,
        processing_completed_at: new Date().toISOString(),
        ai_provider: aiResult.provider,
        last_error: null,
      })
      .eq('id', documentId);

    if (updateError) {
      console.error(`[${requestId}] Update error:`, sanitizeForLog(updateError.message));
      return safeErrorResponse('Failed to update document', 500, corsHeaders);
    }

    // If high confidence, auto-create transaction (with idempotency)
    const confidence = (extracted.confidence?.total || extracted.confidence?.net_pay || 0) as number;
    if (confidence >= 0.8 && totalAmount !== null) {
      await createTransactionFromExtraction(supabase, document, extracted, extractedDate, totalAmount, requestId);
    }

    // Log successful invocation
    await supabase.from('function_invocations').insert({
      user_id: user.id,
      function_name: 'doc-ingest',
      request_id: requestId,
      success: true,
      elapsed_ms: Date.now() - startTime,
    });

    return new Response(
      JSON.stringify({
        success: true,
        parsed_status: 'parsed',
        extracted: safeExtractionJson,
        provider: aiResult.provider,
        elapsed_ms: aiResult.elapsed_ms,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error(`[${requestId}] Unexpected error:`, sanitizeForLog(error instanceof Error ? error.message : 'Unknown'));
    return safeErrorResponse('Internal server error', 500, corsHeaders, error);
  }
});

async function updateDocumentStatus(
  supabase: SupabaseClient,
  documentId: string,
  status: string,
  error?: string
) {
  await supabase
    .from('documents')
    .update({
      parsed_status: status,
      last_error: error ? error.substring(0, 500) : null,
      processing_completed_at: new Date().toISOString(),
    })
    .eq('id', documentId);
}

async function createTransactionFromExtraction(
  supabase: SupabaseClient,
  document: Record<string, unknown>,
  extracted: Record<string, unknown>,
  extractedDate: string | null,
  totalAmount: number,
  requestId: string
) {
  const isSettlement = document.type === 'settlement';

  // Use upsert with unique constraint for idempotency
  // The unique index on (document_id, type) prevents duplicates
  const { error } = await supabase.from('transactions').upsert(
    {
      user_id: document.user_id,
      trip_id: document.trip_id,
      type: isSettlement ? 'income' : 'expense',
      category: isSettlement ? 'other' : ((extracted.category_guess as string) || 'other'),
      amount: totalAmount,
      date: extractedDate || new Date().toISOString().split('T')[0],
      vendor: String(extracted.vendor || extracted.carrier || '').substring(0, 255),
      source: 'document_ai',
      document_id: document.id,
      gallons: validateAmount(extracted.fuel_gallons),
      jurisdiction: extracted.state_hint ? String(extracted.state_hint).substring(0, 2).toUpperCase() : null,
    },
    {
      onConflict: 'document_id,type',
      ignoreDuplicates: false, // Update existing if found
    }
  );

  if (error) {
    console.warn(`[${requestId}] Transaction upsert warning:`, sanitizeForLog(error.message));
  } else {
    console.log(`[${requestId}] Transaction created/updated for document ${document.id}`);
  }
}
