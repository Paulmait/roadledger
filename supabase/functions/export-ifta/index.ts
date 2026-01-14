// Supabase Edge Function: export-ifta
// Generates IFTA quarterly report with miles by jurisdiction and fuel purchases

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;   // YYYY-MM-DD
}

interface JurisdictionSummary {
  jurisdiction: string;
  totalMiles: number;
  taxableMiles: number;
  taxPaidGallons: number;
  taxableGallons: number;
  netTaxGallons: number;
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

    // Create Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Use anon client to get user
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role for data access
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body: RequestBody = await req.json();

    if (!body.periodStart || !body.periodEnd) {
      return new Response(
        JSON.stringify({ error: 'Missing period dates' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's profile for base state
    const { data: profile } = await supabase
      .from('profiles')
      .select('home_state, company_name')
      .eq('id', user.id)
      .single();

    // Get miles by jurisdiction for the period
    const { data: trips } = await supabase
      .from('trips')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'finalized')
      .gte('started_at', body.periodStart)
      .lte('started_at', body.periodEnd + 'T23:59:59Z');

    const tripIds = trips?.map(t => t.id) || [];

    let jurisdictionMiles: { jurisdiction: string; total_miles: number }[] = [];

    if (tripIds.length > 0) {
      const { data: miles } = await supabase
        .from('jurisdiction_miles')
        .select('jurisdiction, miles')
        .in('trip_id', tripIds);

      // Aggregate miles by jurisdiction
      const milesMap: Record<string, number> = {};
      for (const m of miles || []) {
        milesMap[m.jurisdiction] = (milesMap[m.jurisdiction] || 0) + m.miles;
      }

      jurisdictionMiles = Object.entries(milesMap).map(([jurisdiction, total_miles]) => ({
        jurisdiction,
        total_miles,
      }));
    }

    // Get fuel purchases by jurisdiction for the period
    const { data: fuelPurchases } = await supabase
      .from('transactions')
      .select('jurisdiction, gallons, amount')
      .eq('user_id', user.id)
      .eq('category', 'fuel')
      .gte('date', body.periodStart)
      .lte('date', body.periodEnd);

    // Aggregate fuel by jurisdiction
    const fuelMap: Record<string, { gallons: number; amount: number }> = {};
    for (const f of fuelPurchases || []) {
      const j = f.jurisdiction || 'UNKNOWN';
      if (!fuelMap[j]) {
        fuelMap[j] = { gallons: 0, amount: 0 };
      }
      fuelMap[j].gallons += f.gallons || 0;
      fuelMap[j].amount += f.amount || 0;
    }

    // Calculate totals
    const totalMiles = jurisdictionMiles.reduce((sum, jm) => sum + jm.total_miles, 0);
    const totalGallons = Object.values(fuelMap).reduce((sum, f) => sum + f.gallons, 0);
    const avgMpg = totalGallons > 0 ? totalMiles / totalGallons : 0;

    // Build jurisdiction summaries
    const allJurisdictions = new Set([
      ...jurisdictionMiles.map(jm => jm.jurisdiction),
      ...Object.keys(fuelMap),
    ]);

    const summaries: JurisdictionSummary[] = [];

    for (const jurisdiction of allJurisdictions) {
      const miles = jurisdictionMiles.find(jm => jm.jurisdiction === jurisdiction)?.total_miles || 0;
      const fuel = fuelMap[jurisdiction] || { gallons: 0, amount: 0 };

      // Calculate taxable gallons (miles / avg MPG)
      const taxableGallons = avgMpg > 0 ? miles / avgMpg : 0;

      summaries.push({
        jurisdiction,
        totalMiles: Math.round(miles * 100) / 100,
        taxableMiles: Math.round(miles * 100) / 100,
        taxPaidGallons: Math.round(fuel.gallons * 1000) / 1000,
        taxableGallons: Math.round(taxableGallons * 1000) / 1000,
        netTaxGallons: Math.round((taxableGallons - fuel.gallons) * 1000) / 1000,
      });
    }

    // Sort by miles descending
    summaries.sort((a, b) => b.totalMiles - a.totalMiles);

    // Create export record
    const { data: exportRecord, error: exportError } = await supabase
      .from('exports')
      .insert({
        user_id: user.id,
        type: 'ifta',
        period_start: body.periodStart,
        period_end: body.periodEnd,
        status: 'ready',
        storage_path: null, // Would store PDF path if generated
      })
      .select()
      .single();

    if (exportError) {
      console.error('Export record error:', exportError);
    }

    // Determine IFTA quarter
    const startDate = new Date(body.periodStart);
    const quarter = Math.ceil((startDate.getMonth() + 1) / 3);
    const year = startDate.getFullYear();

    return new Response(
      JSON.stringify({
        success: true,
        exportId: exportRecord?.id,
        report: {
          quarter: `Q${quarter} ${year}`,
          periodStart: body.periodStart,
          periodEnd: body.periodEnd,
          companyName: profile?.company_name || '',
          baseJurisdiction: profile?.home_state || '',
          summary: {
            totalMiles: Math.round(totalMiles * 100) / 100,
            totalGallons: Math.round(totalGallons * 1000) / 1000,
            averageMpg: Math.round(avgMpg * 100) / 100,
            jurisdictionCount: summaries.length,
          },
          jurisdictions: summaries,
        },
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
