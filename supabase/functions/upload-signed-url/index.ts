// Supabase Edge Function: upload-signed-url
// Generates secure signed URLs for document uploads

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  bucket: 'receipts' | 'settlements' | 'exports';
  filename: string;
  contentType: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: RequestBody = await req.json();

    // Validate bucket
    const validBuckets = ['receipts', 'settlements', 'exports'];
    if (!validBuckets.includes(body.bucket)) {
      return new Response(
        JSON.stringify({ error: 'Invalid bucket' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate content type
    const allowedTypes: Record<string, string[]> = {
      receipts: ['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf'],
      settlements: ['image/jpeg', 'image/png', 'application/pdf'],
      exports: ['application/pdf', 'application/zip'],
    };

    if (!allowedTypes[body.bucket].includes(body.contentType)) {
      return new Response(
        JSON.stringify({ error: 'Invalid content type for this bucket' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate secure path: {user_id}/{timestamp}_{sanitized_filename}
    const timestamp = Date.now();
    const sanitizedFilename = body.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${user.id}/${timestamp}_${sanitizedFilename}`;

    // Create signed upload URL (15 minute expiry)
    const { data, error: uploadError } = await supabase.storage
      .from(body.bucket)
      .createSignedUploadUrl(path);

    if (uploadError) {
      console.error('Upload URL error:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to create upload URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        signedUrl: data.signedUrl,
        path: data.path,
        token: data.token,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
