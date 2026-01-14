// Supabase Edge Function: trip-finalize
// Calculates total miles and jurisdiction miles from GPS points

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  tripId: string;
}

interface TripPoint {
  lat: number;
  lng: number;
  jurisdiction: string | null;
  ts: string;
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

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body: RequestBody = await req.json();

    if (!body.tripId) {
      return new Response(
        JSON.stringify({ error: 'Missing tripId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get trip
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('*')
      .eq('id', body.tripId)
      .single();

    if (tripError || !trip) {
      return new Response(
        JSON.stringify({ error: 'Trip not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all trip points
    const { data: points, error: pointsError } = await supabase
      .from('trip_points')
      .select('lat, lng, jurisdiction, ts')
      .eq('trip_id', body.tripId)
      .order('ts', { ascending: true });

    if (pointsError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch trip points' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!points || points.length < 2) {
      return new Response(
        JSON.stringify({
          success: true,
          totalMiles: 0,
          jurisdictionMiles: {},
          message: 'Not enough points to calculate distance',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate miles by jurisdiction
    const jurisdictionMiles: Record<string, number> = {};
    let totalMiles = 0;

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1] as TripPoint;
      const curr = points[i] as TripPoint;

      // Calculate distance between points
      const distance = haversineDistance(
        prev.lat,
        prev.lng,
        curr.lat,
        curr.lng
      );

      totalMiles += distance;

      // Attribute distance to jurisdiction
      // Use current point's jurisdiction, fall back to previous
      const jurisdiction = curr.jurisdiction || prev.jurisdiction;

      if (jurisdiction) {
        jurisdictionMiles[jurisdiction] = (jurisdictionMiles[jurisdiction] || 0) + distance;
      }
    }

    // Delete existing jurisdiction miles for this trip
    await supabase
      .from('jurisdiction_miles')
      .delete()
      .eq('trip_id', body.tripId);

    // Insert new jurisdiction miles
    const jurisdictionRecords = Object.entries(jurisdictionMiles).map(
      ([jurisdiction, miles]) => ({
        trip_id: body.tripId,
        jurisdiction,
        miles: Math.round(miles * 100) / 100, // Round to 2 decimal places
        confidence: 0.9, // GPS-based confidence
        method: 'gps',
      })
    );

    if (jurisdictionRecords.length > 0) {
      const { error: insertError } = await supabase
        .from('jurisdiction_miles')
        .insert(jurisdictionRecords);

      if (insertError) {
        console.error('Insert error:', insertError);
      }
    }

    // Update trip with total miles
    const { error: updateError } = await supabase
      .from('trips')
      .update({
        auto_miles_total: Math.round(totalMiles * 100) / 100,
        status: 'finalized',
        ended_at: trip.ended_at || new Date().toISOString(),
      })
      .eq('id', body.tripId);

    if (updateError) {
      console.error('Update error:', updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalMiles: Math.round(totalMiles * 100) / 100,
        jurisdictionMiles,
        pointsProcessed: points.length,
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

// Haversine distance formula (returns miles)
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3958.8; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}
