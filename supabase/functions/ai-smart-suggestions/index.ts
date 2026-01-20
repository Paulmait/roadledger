// Supabase Edge Function: ai-smart-suggestions
// Proactive AI suggestions for owner-operators
// Analyzes patterns and provides actionable recommendations

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Suggestion {
  id: string;
  priority: 'high' | 'medium' | 'low';
  category: 'tax' | 'profit' | 'efficiency' | 'compliance' | 'opportunity';
  title: string;
  description: string;
  potentialSavings?: number;
  action?: string;
  deadline?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check rate limit
    const { data: rateLimitOk } = await supabase.rpc('check_function_rate_limit', {
      p_user_id: user.id,
      p_function_name: 'ai-smart-suggestions',
      p_max_per_minute: 10,
      p_max_per_hour: 60,
    });

    if (rateLimitOk === false) {
      console.warn(`Rate limit exceeded for user ${user.id} on ai-smart-suggestions`);
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Record function invocation
    await supabase.from('function_invocations').insert({
      user_id: user.id,
      function_name: 'ai-smart-suggestions',
      invoked_at: new Date().toISOString(),
    });

    const suggestions: Suggestion[] = [];

    // Get current date info
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentQuarter = Math.ceil(currentMonth / 3);
    const yearStart = `${now.getFullYear()}-01-01`;
    const quarterStart = `${now.getFullYear()}-${String((currentQuarter - 1) * 3 + 1).padStart(2, '0')}-01`;

    // 1. IFTA Deadline Check
    const iftaDeadlines: Record<number, string> = {
      1: 'April 30', // Q1 due
      2: 'July 31',  // Q2 due
      3: 'October 31', // Q3 due
      4: 'January 31', // Q4 due (next year)
    };

    const { count: pendingTrips } = await supabase
      .from('trips')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'in_progress');

    if (pendingTrips && pendingTrips > 0) {
      suggestions.push({
        id: 'pending-trips',
        priority: 'high',
        category: 'compliance',
        title: `${pendingTrips} Trips Need Finalization`,
        description: 'Complete these trips to ensure accurate IFTA reporting.',
        action: 'Go to Trips and finalize pending trips',
      });
    }

    // Check for upcoming IFTA deadline
    const daysUntilQuarterEnd = getDaysUntilQuarterEnd(now);
    if (daysUntilQuarterEnd <= 30) {
      suggestions.push({
        id: 'ifta-deadline',
        priority: daysUntilQuarterEnd <= 7 ? 'high' : 'medium',
        category: 'compliance',
        title: 'IFTA Deadline Approaching',
        description: `Q${currentQuarter} IFTA report is due ${iftaDeadlines[currentQuarter]}. ${daysUntilQuarterEnd} days remaining.`,
        deadline: iftaDeadlines[currentQuarter],
        action: 'Generate your IFTA report in Exports',
      });
    }

    // 2. Missing Receipts Check
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentTransactions } = await supabase
      .from('transactions')
      .select('id, document_id, amount, category')
      .eq('user_id', user.id)
      .eq('type', 'expense')
      .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
      .is('document_id', null);

    const missingReceiptTotal = recentTransactions?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

    if (recentTransactions && recentTransactions.length >= 3) {
      suggestions.push({
        id: 'missing-receipts',
        priority: 'medium',
        category: 'tax',
        title: `${recentTransactions.length} Expenses Missing Receipts`,
        description: `$${missingReceiptTotal.toFixed(2)} in expenses without documentation. These may not be deductible.`,
        potentialSavings: Math.round(missingReceiptTotal * 0.25), // ~25% tax rate
        action: 'Upload receipts for recent expenses',
      });
    }

    // 3. Fuel Price Optimization
    const { data: fuelPurchases } = await supabase
      .from('transactions')
      .select('amount, gallons, jurisdiction, date')
      .eq('user_id', user.id)
      .eq('category', 'fuel')
      .gte('date', thirtyDaysAgo.toISOString().split('T')[0]);

    if (fuelPurchases && fuelPurchases.length >= 5) {
      const pricePerGallon: Record<string, { total: number; gallons: number }> = {};

      for (const fp of fuelPurchases) {
        if (fp.gallons && fp.jurisdiction) {
          if (!pricePerGallon[fp.jurisdiction]) {
            pricePerGallon[fp.jurisdiction] = { total: 0, gallons: 0 };
          }
          pricePerGallon[fp.jurisdiction].total += Number(fp.amount);
          pricePerGallon[fp.jurisdiction].gallons += Number(fp.gallons);
        }
      }

      const avgPrices = Object.entries(pricePerGallon)
        .map(([state, data]) => ({
          state,
          avgPrice: data.gallons > 0 ? data.total / data.gallons : 0,
        }))
        .filter(p => p.avgPrice > 0)
        .sort((a, b) => a.avgPrice - b.avgPrice);

      if (avgPrices.length >= 2) {
        const cheapest = avgPrices[0];
        const mostExpensive = avgPrices[avgPrices.length - 1];
        const savings = mostExpensive.avgPrice - cheapest.avgPrice;

        if (savings > 0.20) {
          const totalGallons = fuelPurchases.reduce((sum, fp) => sum + (Number(fp.gallons) || 0), 0);
          suggestions.push({
            id: 'fuel-optimization',
            priority: 'low',
            category: 'efficiency',
            title: 'Fuel Cost Variation Detected',
            description: `You paid $${savings.toFixed(2)}/gal more in ${mostExpensive.state} vs ${cheapest.state}.`,
            potentialSavings: Math.round(savings * totalGallons * 0.3), // Estimate 30% could be saved
            action: 'Plan fuel stops in lower-cost states when possible',
          });
        }
      }
    }

    // 4. Tax Deduction Reminders
    const { data: yearTransactions } = await supabase
      .from('transactions')
      .select('amount, type, category')
      .eq('user_id', user.id)
      .gte('date', yearStart);

    const yearExpenses = yearTransactions?.filter(t => t.type === 'expense') || [];
    const perDiemDays = Math.floor((now.getTime() - new Date(yearStart).getTime()) / (1000 * 60 * 60 * 24));

    // Check for missing per diem deductions
    const foodExpenses = yearExpenses.filter(e => e.category === 'food');
    const currentFoodTotal = foodExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const potentialPerDiem = perDiemDays * 69 * 0.8; // $69/day at 80%

    if (potentialPerDiem > currentFoodTotal + 500) {
      suggestions.push({
        id: 'per-diem',
        priority: 'medium',
        category: 'tax',
        title: 'Consider Per Diem Deduction',
        description: `You may be eligible for ~$${Math.round(potentialPerDiem)} in per diem deductions vs $${Math.round(currentFoodTotal)} in tracked food expenses.`,
        potentialSavings: Math.round((potentialPerDiem - currentFoodTotal) * 0.22),
        action: 'Consult with a tax professional about per diem',
      });
    }

    // 5. Profit Trend Alert
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const { data: recentTrips } = await supabase
      .from('trips')
      .select('auto_miles_total, started_at')
      .eq('user_id', user.id)
      .eq('status', 'finalized')
      .gte('started_at', sixtyDaysAgo.toISOString())
      .order('started_at', { ascending: false });

    if (recentTrips && recentTrips.length >= 4) {
      const recent = recentTrips.slice(0, Math.floor(recentTrips.length / 2));
      const older = recentTrips.slice(Math.floor(recentTrips.length / 2));

      const recentMiles = recent.reduce((sum, t) => sum + (Number(t.auto_miles_total) || 0), 0);
      const olderMiles = older.reduce((sum, t) => sum + (Number(t.auto_miles_total) || 0), 0);

      if (recentMiles < olderMiles * 0.7) {
        suggestions.push({
          id: 'activity-decline',
          priority: 'medium',
          category: 'profit',
          title: 'Activity Trending Down',
          description: 'Your recent mileage is 30%+ lower than the previous period.',
          action: 'Review load board for opportunities',
        });
      }
    }

    // 6. Document Processing Status
    const { data: pendingDocs } = await supabase
      .from('documents')
      .select('id, uploaded_at')
      .eq('user_id', user.id)
      .eq('parsed_status', 'pending');

    if (pendingDocs && pendingDocs.length > 0) {
      const oldestPending = pendingDocs.sort((a, b) =>
        new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime()
      )[0];

      const hoursSinceUpload = (now.getTime() - new Date(oldestPending.uploaded_at).getTime()) / (1000 * 60 * 60);

      if (hoursSinceUpload > 24) {
        suggestions.push({
          id: 'stuck-documents',
          priority: 'low',
          category: 'efficiency',
          title: 'Documents Awaiting Processing',
          description: `${pendingDocs.length} document(s) uploaded over 24 hours ago still processing.`,
          action: 'Check document quality or re-upload',
        });
      }
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return new Response(
      JSON.stringify({
        success: true,
        suggestions,
        generatedAt: now.toISOString(),
        currentQuarter: `Q${currentQuarter}`,
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

function getDaysUntilQuarterEnd(date: Date): number {
  const month = date.getMonth();
  const quarter = Math.floor(month / 3);
  const quarterEndMonth = (quarter + 1) * 3;

  const quarterEnd = new Date(date.getFullYear(), quarterEndMonth, 0);
  return Math.ceil((quarterEnd.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}
