// Supabase Edge Function: export-tax-pack
// Generates tax package with income/expense summaries

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

interface CategorySummary {
  category: string;
  count: number;
  total: number;
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

    // Get user's profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    // Get all transactions for the period
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', body.periodStart)
      .lte('date', body.periodEnd)
      .order('date', { ascending: true });

    // Separate income and expenses
    const income = transactions?.filter(t => t.type === 'income') || [];
    const expenses = transactions?.filter(t => t.type === 'expense') || [];

    // Calculate totals
    const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = expenses.reduce((sum, t) => sum + t.amount, 0);
    const netIncome = totalIncome - totalExpenses;

    // Group expenses by category
    const expenseByCategory: Record<string, CategorySummary> = {};
    for (const exp of expenses) {
      if (!expenseByCategory[exp.category]) {
        expenseByCategory[exp.category] = {
          category: exp.category,
          count: 0,
          total: 0,
        };
      }
      expenseByCategory[exp.category].count++;
      expenseByCategory[exp.category].total += exp.amount;
    }

    const expenseCategories = Object.values(expenseByCategory).sort(
      (a, b) => b.total - a.total
    );

    // Get total miles for the period
    const { data: trips } = await supabase
      .from('trips')
      .select('auto_miles_total')
      .eq('user_id', user.id)
      .eq('status', 'finalized')
      .gte('started_at', body.periodStart)
      .lte('started_at', body.periodEnd + 'T23:59:59Z');

    const totalMiles = trips?.reduce((sum, t) => sum + (t.auto_miles_total || 0), 0) || 0;

    // Get document count (receipts with parsed data)
    const { count: documentCount } = await supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('parsed_status', 'parsed')
      .gte('document_date', body.periodStart)
      .lte('document_date', body.periodEnd);

    // Get monthly breakdown
    const monthlyBreakdown: Record<string, { income: number; expenses: number }> = {};

    for (const t of transactions || []) {
      const month = t.date.substring(0, 7); // YYYY-MM
      if (!monthlyBreakdown[month]) {
        monthlyBreakdown[month] = { income: 0, expenses: 0 };
      }
      if (t.type === 'income') {
        monthlyBreakdown[month].income += t.amount;
      } else {
        monthlyBreakdown[month].expenses += t.amount;
      }
    }

    // Create export record
    const { data: exportRecord, error: exportError } = await supabase
      .from('exports')
      .insert({
        user_id: user.id,
        type: 'tax_pack',
        period_start: body.periodStart,
        period_end: body.periodEnd,
        status: 'ready',
        storage_path: null,
      })
      .select()
      .single();

    if (exportError) {
      console.error('Export record error:', exportError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        exportId: exportRecord?.id,
        report: {
          period: {
            start: body.periodStart,
            end: body.periodEnd,
          },
          business: {
            name: profile?.company_name || '',
            ownerName: profile?.full_name || '',
            mcNumber: profile?.mc_number || '',
            dotNumber: profile?.dot_number || '',
          },
          summary: {
            totalIncome: Math.round(totalIncome * 100) / 100,
            totalExpenses: Math.round(totalExpenses * 100) / 100,
            netIncome: Math.round(netIncome * 100) / 100,
            totalMiles: Math.round(totalMiles * 100) / 100,
            transactionCount: transactions?.length || 0,
            documentCount: documentCount || 0,
          },
          expenses: {
            byCategory: expenseCategories.map(c => ({
              category: c.category,
              count: c.count,
              total: Math.round(c.total * 100) / 100,
              percentage: Math.round((c.total / totalExpenses) * 10000) / 100,
            })),
          },
          monthlyBreakdown: Object.entries(monthlyBreakdown)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, data]) => ({
              month,
              income: Math.round(data.income * 100) / 100,
              expenses: Math.round(data.expenses * 100) / 100,
              net: Math.round((data.income - data.expenses) * 100) / 100,
            })),
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
