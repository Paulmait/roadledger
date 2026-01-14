// Supabase Edge Function: ai-profit-analyzer
// AI-powered profit analysis for owner-operators
// Provides real-time insights on $/mile, $/load, $/day, lane profitability

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  analysisType: 'daily' | 'weekly' | 'monthly' | 'trip' | 'lane';
  tripId?: string;
  startDate?: string;
  endDate?: string;
}

interface ProfitMetrics {
  grossRevenue: number;
  totalExpenses: number;
  netProfit: number;
  totalMiles: number;
  revenuePerMile: number;
  expensePerMile: number;
  profitPerMile: number;
  profitPerDay: number;
  fuelCostPerMile: number;
  avgMpg: number;
}

interface LaneAnalysis {
  origin: string;
  destination: string;
  tripCount: number;
  totalMiles: number;
  totalRevenue: number;
  totalExpenses: number;
  avgProfitPerMile: number;
  avgProfitPerTrip: number;
  recommendation: string;
}

interface AIInsight {
  type: 'warning' | 'opportunity' | 'achievement' | 'tip';
  title: string;
  message: string;
  impact?: string;
  action?: string;
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
    const openaiKey = Deno.env.get('OPENAI_API_KEY');

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
    const body: RequestBody = await req.json();

    // Calculate date range
    const now = new Date();
    let startDate: string;
    let endDate: string = now.toISOString().split('T')[0];

    switch (body.analysisType) {
      case 'daily':
        startDate = endDate;
        break;
      case 'weekly':
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        startDate = weekAgo.toISOString().split('T')[0];
        break;
      case 'monthly':
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        startDate = monthAgo.toISOString().split('T')[0];
        break;
      default:
        startDate = body.startDate || endDate;
        endDate = body.endDate || endDate;
    }

    // Fetch transactions for the period
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', startDate)
      .lte('date', endDate);

    // Fetch trips for the period
    const { data: trips } = await supabase
      .from('trips')
      .select('*, jurisdiction_miles(*)')
      .eq('user_id', user.id)
      .eq('status', 'finalized')
      .gte('started_at', startDate)
      .lte('started_at', endDate + 'T23:59:59Z');

    // Calculate core metrics
    const income = transactions?.filter(t => t.type === 'income') || [];
    const expenses = transactions?.filter(t => t.type === 'expense') || [];
    const fuelExpenses = expenses.filter(e => e.category === 'fuel');

    const grossRevenue = income.reduce((sum, t) => sum + Number(t.amount), 0);
    const totalExpenses = expenses.reduce((sum, t) => sum + Number(t.amount), 0);
    const netProfit = grossRevenue - totalExpenses;
    const totalFuelCost = fuelExpenses.reduce((sum, t) => sum + Number(t.amount), 0);
    const totalGallons = fuelExpenses.reduce((sum, t) => sum + (Number(t.gallons) || 0), 0);

    const totalMiles = trips?.reduce((sum, t) => sum + (Number(t.auto_miles_total) || 0), 0) || 0;
    const daysInPeriod = Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1);

    const metrics: ProfitMetrics = {
      grossRevenue: Math.round(grossRevenue * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
      totalMiles: Math.round(totalMiles * 100) / 100,
      revenuePerMile: totalMiles > 0 ? Math.round((grossRevenue / totalMiles) * 100) / 100 : 0,
      expensePerMile: totalMiles > 0 ? Math.round((totalExpenses / totalMiles) * 100) / 100 : 0,
      profitPerMile: totalMiles > 0 ? Math.round((netProfit / totalMiles) * 100) / 100 : 0,
      profitPerDay: Math.round((netProfit / daysInPeriod) * 100) / 100,
      fuelCostPerMile: totalMiles > 0 ? Math.round((totalFuelCost / totalMiles) * 100) / 100 : 0,
      avgMpg: totalGallons > 0 ? Math.round((totalMiles / totalGallons) * 100) / 100 : 0,
    };

    // Generate AI insights
    const insights: AIInsight[] = [];

    // Profit per mile analysis
    if (metrics.profitPerMile < 0.50) {
      insights.push({
        type: 'warning',
        title: 'Low Profit Margin',
        message: `Your profit per mile is $${metrics.profitPerMile.toFixed(2)}. Industry average for owner-operators is $0.75-$1.25/mile.`,
        impact: 'Could be losing $' + Math.round((0.75 - metrics.profitPerMile) * totalMiles) + ' compared to industry average',
        action: 'Review your rate negotiations or reduce expenses',
      });
    } else if (metrics.profitPerMile > 1.00) {
      insights.push({
        type: 'achievement',
        title: 'Excellent Profit Margin',
        message: `Your profit per mile of $${metrics.profitPerMile.toFixed(2)} is above industry average!`,
        impact: 'You\'re earning $' + Math.round((metrics.profitPerMile - 0.75) * totalMiles) + ' more than average',
      });
    }

    // Fuel efficiency analysis
    if (metrics.avgMpg > 0 && metrics.avgMpg < 6) {
      insights.push({
        type: 'warning',
        title: 'Low Fuel Efficiency',
        message: `Your average MPG of ${metrics.avgMpg.toFixed(1)} is below the typical 6-8 MPG for trucks.`,
        action: 'Check tire pressure, reduce idling, optimize routes',
      });
    } else if (metrics.avgMpg >= 7) {
      insights.push({
        type: 'achievement',
        title: 'Great Fuel Efficiency',
        message: `${metrics.avgMpg.toFixed(1)} MPG is excellent! Keep up the efficient driving.`,
      });
    }

    // Expense ratio analysis
    const expenseRatio = grossRevenue > 0 ? (totalExpenses / grossRevenue) * 100 : 0;
    if (expenseRatio > 75) {
      insights.push({
        type: 'warning',
        title: 'High Expense Ratio',
        message: `${expenseRatio.toFixed(0)}% of your revenue goes to expenses. Target is 60-70%.`,
        action: 'Review your largest expense categories for savings',
      });
    }

    // Fuel cost per mile benchmark
    if (metrics.fuelCostPerMile > 0.60) {
      insights.push({
        type: 'opportunity',
        title: 'Fuel Cost Opportunity',
        message: `Fuel cost of $${metrics.fuelCostPerMile.toFixed(2)}/mile is high. Industry average is $0.40-$0.55/mile.`,
        action: 'Consider fuel discount programs or route optimization',
      });
    }

    // Daily profit tips
    if (body.analysisType === 'daily') {
      if (metrics.profitPerDay < 200) {
        insights.push({
          type: 'tip',
          title: 'Daily Goal',
          message: 'Aim for $400-$600/day net profit for sustainable owner-operator income.',
          action: 'Track your daily expenses more closely',
        });
      }
    }

    // Generate AI narrative if OpenAI key is available
    let aiNarrative = '';
    if (openaiKey && transactions && transactions.length > 0) {
      try {
        const prompt = `You are a trucking business advisor. Based on these metrics for an owner-operator trucker, provide a 2-3 sentence profit-focused summary:
- Gross Revenue: $${metrics.grossRevenue}
- Total Expenses: $${metrics.totalExpenses}
- Net Profit: $${metrics.netProfit}
- Total Miles: ${metrics.totalMiles}
- Profit per Mile: $${metrics.profitPerMile}
- Profit per Day: $${metrics.profitPerDay}
- Fuel Cost per Mile: $${metrics.fuelCostPerMile}
- Average MPG: ${metrics.avgMpg}
- Period: ${body.analysisType}

Be direct, actionable, and focused on their bottom line. Use plain language.`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 150,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          aiNarrative = data.choices[0]?.message?.content || '';
        }
      } catch (e) {
        console.error('AI narrative error:', e);
      }
    }

    // Calculate expense breakdown
    const expenseBreakdown: Record<string, number> = {};
    for (const exp of expenses) {
      expenseBreakdown[exp.category] = (expenseBreakdown[exp.category] || 0) + Number(exp.amount);
    }

    // Sort by amount descending
    const sortedExpenses = Object.entries(expenseBreakdown)
      .map(([category, amount]) => ({
        category,
        amount: Math.round(amount * 100) / 100,
        percentage: totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0,
        perMile: totalMiles > 0 ? Math.round((amount / totalMiles) * 100) / 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return new Response(
      JSON.stringify({
        success: true,
        period: {
          type: body.analysisType,
          start: startDate,
          end: endDate,
          days: daysInPeriod,
        },
        metrics,
        insights,
        aiNarrative,
        expenseBreakdown: sortedExpenses,
        tripCount: trips?.length || 0,
        transactionCount: transactions?.length || 0,
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
