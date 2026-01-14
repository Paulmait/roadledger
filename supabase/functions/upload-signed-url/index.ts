// Supabase Edge Function: upload-signed-url (Production Hardened)
// Generates secure signed URLs for document uploads

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import {
  safeErrorResponse,
  sanitizeForLog,
  isAllowedMimeType,
  ALLOWED_DOCUMENT_TYPES,
} from '../_shared/validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const VALID_BUCKETS = ['receipts', 'settlements', 'exports'] as const;
type ValidBucket = typeof VALID_BUCKETS[number];

const ALLOWED_TYPES_BY_BUCKET: Record<ValidBucket, string[]> = {
  receipts: ['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/heif', 'image/webp', 'application/pdf'],
  settlements: ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'],
  exports: ['application/pdf', 'application/zip'],
};

// Max filename length (prevent path traversal and storage issues)
const MAX_FILENAME_LENGTH = 200;

serve(async (req) => {
  const requestId = crypto.randomUUID();

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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user authentication
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return safeErrorResponse('Unauthorized', 401, corsHeaders, userError);
    }

    console.log(`[${requestId}] User ${user.id} requesting upload URL`);

    // Check rate limit (generous for uploads)
    const { data: rateLimitOk } = await supabase.rpc('check_function_rate_limit', {
      p_user_id: user.id,
      p_function_name: 'upload-signed-url',
      p_max_per_minute: 20,
      p_max_per_hour: 200,
    });

    if (rateLimitOk === false) {
      console.warn(`[${requestId}] Rate limit exceeded for user ${user.id}`);
      return safeErrorResponse('Rate limit exceeded. Please try again later.', 429, corsHeaders);
    }

    // Parse request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return safeErrorResponse('Invalid JSON body', 400, corsHeaders);
    }

    if (!body || typeof body !== 'object') {
      return safeErrorResponse('Invalid request body', 400, corsHeaders);
    }

    const { bucket, filename, contentType } = body as Record<string, unknown>;

    // Validate bucket
    if (!bucket || typeof bucket !== 'string' || !VALID_BUCKETS.includes(bucket as ValidBucket)) {
      return safeErrorResponse('Invalid bucket. Must be: receipts, settlements, or exports', 400, corsHeaders);
    }

    // Validate filename
    if (!filename || typeof filename !== 'string') {
      return safeErrorResponse('Missing filename', 400, corsHeaders);
    }

    if (filename.length > MAX_FILENAME_LENGTH) {
      return safeErrorResponse(`Filename too long (max ${MAX_FILENAME_LENGTH} characters)`, 400, corsHeaders);
    }

    // Prevent path traversal attacks
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      console.warn(`[${requestId}] Path traversal attempt: ${sanitizeForLog(filename)}`);
      return safeErrorResponse('Invalid filename', 400, corsHeaders);
    }

    // Validate content type
    if (!contentType || typeof contentType !== 'string') {
      return safeErrorResponse('Missing contentType', 400, corsHeaders);
    }

    const allowedTypes = ALLOWED_TYPES_BY_BUCKET[bucket as ValidBucket];
    if (!isAllowedMimeType(contentType, allowedTypes)) {
      return safeErrorResponse('Invalid content type for this bucket', 400, corsHeaders);
    }

    // Generate secure path: {user_id}/{timestamp}_{sanitized_filename}
    const timestamp = Date.now();
    // Only allow alphanumeric, dots, and underscores in filename
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 100);
    const path = `${user.id}/${timestamp}_${sanitizedFilename}`;

    // Create signed upload URL (15 minute expiry)
    const { data, error: uploadError } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(path);

    if (uploadError) {
      console.error(`[${requestId}] Upload URL error:`, sanitizeForLog(uploadError.message));
      return safeErrorResponse('Failed to create upload URL', 500, corsHeaders);
    }

    // Log successful request
    await supabase.from('function_invocations').insert({
      user_id: user.id,
      function_name: 'upload-signed-url',
      request_id: requestId,
      success: true,
    });

    console.log(`[${requestId}] Upload URL created for bucket: ${bucket}`);

    return new Response(
      JSON.stringify({
        signedUrl: data.signedUrl,
        path: data.path,
        token: data.token,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error(`[${requestId}] Unexpected error:`, sanitizeForLog(error instanceof Error ? error.message : 'Unknown'));
    return safeErrorResponse('Internal server error', 500, corsHeaders, error);
  }
});
