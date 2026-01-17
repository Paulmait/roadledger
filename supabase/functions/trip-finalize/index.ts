// Supabase Edge Function: trip-finalize (Production Hardened)
// Calculates total miles and jurisdiction miles from GPS points

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import {
  isValidUuid,
  safeErrorResponse,
  sanitizeForLog,
} from '../_shared/validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
  const requestId = crypto.randomUUID();

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

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

    // Verify user identity using the anon client with user's token
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return safeErrorResponse('Unauthorized', 401, corsHeaders, userError);
    }

    // Service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`[${requestId}] User ${user.id} finalizing trip`);

    // Check rate limit
    const { data: rateLimitOk } = await supabase.rpc('check_function_rate_limit', {
      p_user_id: user.id,
      p_function_name: 'trip-finalize',
      p_max_per_minute: 10,
      p_max_per_hour: 100,
    });

    if (rateLimitOk === false) {
      console.warn(`[${requestId}] Rate limit exceeded for user ${user.id}`);
      return safeErrorResponse('Rate limit exceeded. Please try again later.', 429, corsHeaders);
    }

    // Parse request body
    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      return safeErrorResponse('Invalid JSON body', 400, corsHeaders);
    }

    if (!body.tripId) {
      return safeErrorResponse('Missing tripId', 400, corsHeaders);
    }

    // Validate tripId format
    if (!isValidUuid(body.tripId)) {
      return safeErrorResponse('Invalid tripId format', 400, corsHeaders);
    }

    // Get trip WITH ownership verification
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('*')
      .eq('id', body.tripId)
      .eq('user_id', user.id)  // CRITICAL: Only allow user's own trips
      .single();

    if (tripError || !trip) {
      console.warn(`[${requestId}] Trip not found or access denied: ${sanitizeForLog(body.tripId)}`);
      return safeErrorResponse('Trip not found or access denied', 404, corsHeaders);
    }

    // Get all trip points
    const { data: points, error: pointsError } = await supabase
      .from('trip_points')
      .select('lat, lng, jurisdiction, ts')
      .eq('trip_id', body.tripId)
      .order('ts', { ascending: true });

    if (pointsError) {
      console.error(`[${requestId}] Failed to fetch trip points:`, pointsError);
      return safeErrorResponse('Failed to fetch trip points', 500, corsHeaders);
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
    console.error(`[${requestId}] Unexpected error:`, sanitizeForLog(error instanceof Error ? error.message : 'Unknown'));
    return safeErrorResponse('Internal server error', 500, corsHeaders, error);
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
