// Supabase Edge Function: doc-ingest
// Processes uploaded documents using OpenAI GPT-4 Vision for data extraction

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  documentId: string;
}

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

    // Create Supabase client with service role for full access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body: RequestBody = await req.json();

    if (!body.documentId) {
      return new Response(
        JSON.stringify({ error: 'Missing documentId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get document from database
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', body.documentId)
      .single();

    if (docError || !document) {
      return new Response(
        JSON.stringify({ error: 'Document not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Download file from storage
    const bucket = document.type === 'settlement' ? 'settlements' : 'receipts';
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(document.storage_path);

    if (downloadError || !fileData) {
      console.error('Download error:', downloadError);
      await updateDocumentStatus(supabase, body.documentId, 'failed', 'Failed to download file');
      return new Response(
        JSON.stringify({ error: 'Failed to download file' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert to base64
    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ''
      )
    );

    // Determine content type
    const contentType = fileData.type || 'image/jpeg';

    // Select prompt based on document type
    const prompt =
      document.type === 'settlement'
        ? SETTLEMENT_EXTRACTION_PROMPT
        : RECEIPT_EXTRACTION_PROMPT;

    // Call OpenAI GPT-4 Vision
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${contentType};base64,${base64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI error:', errorText);
      await updateDocumentStatus(supabase, body.documentId, 'failed', 'AI extraction failed');
      return new Response(
        JSON.stringify({ error: 'AI extraction failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openaiData = await openaiResponse.json();
    const extractedText = openaiData.choices[0]?.message?.content;

    if (!extractedText) {
      await updateDocumentStatus(supabase, body.documentId, 'failed', 'No extraction result');
      return new Response(
        JSON.stringify({ error: 'No extraction result' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse extracted JSON
    let extracted;
    try {
      extracted = JSON.parse(extractedText);
    } catch {
      await updateDocumentStatus(supabase, body.documentId, 'failed', 'Invalid extraction JSON');
      return new Response(
        JSON.stringify({ error: 'Invalid extraction JSON' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update document with extracted data
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        parsed_status: 'parsed',
        vendor: extracted.vendor || extracted.carrier,
        document_date: extracted.date || extracted.period_end,
        total_amount: extracted.total || extracted.net_pay,
        extraction_json: extracted,
      })
      .eq('id', body.documentId);

    if (updateError) {
      console.error('Update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update document' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If high confidence, auto-create transaction
    const confidence = extracted.confidence?.total || extracted.confidence?.net_pay || 0;
    if (confidence >= 0.8 && (extracted.total || extracted.net_pay)) {
      await createTransactionFromExtraction(supabase, document, extracted);
    }

    return new Response(
      JSON.stringify({
        success: true,
        parsed_status: 'parsed',
        extracted,
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

async function updateDocumentStatus(
  supabase: any,
  documentId: string,
  status: string,
  error?: string
) {
  await supabase
    .from('documents')
    .update({
      parsed_status: status,
      extraction_json: error ? { error } : null,
    })
    .eq('id', documentId);
}

async function createTransactionFromExtraction(
  supabase: any,
  document: any,
  extracted: any
) {
  const isSettlement = document.type === 'settlement';

  await supabase.from('transactions').insert({
    user_id: document.user_id,
    trip_id: document.trip_id,
    type: isSettlement ? 'income' : 'expense',
    category: isSettlement ? 'other' : (extracted.category_guess || 'other'),
    amount: extracted.total || extracted.net_pay,
    date: extracted.date || extracted.period_end || new Date().toISOString().split('T')[0],
    vendor: extracted.vendor || extracted.carrier,
    source: 'document_ai',
    document_id: document.id,
    gallons: extracted.fuel_gallons,
    jurisdiction: extracted.state_hint,
  });
}
