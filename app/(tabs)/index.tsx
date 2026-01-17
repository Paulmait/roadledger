import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useProfile, useAuthStore } from '@/stores/authStore';
import { useTripStore, useActiveTrip, useIsTracking } from '@/stores/tripStore';
import { useSyncStore, useIsOnline, useSyncStatus } from '@/stores/syncStore';
import { getUserTransactions, getUserTrips } from '@/lib/database';
import { supabase } from '@/lib/supabase';
import type { Transaction, Trip } from '@/types/database.types';
import { format } from 'date-fns';

// Brand colors
const COLORS = {
  primary: '#1E3A5F',
  secondary: '#2ECC71',
  accent: '#F39C12',
  background: '#0D1B2A',
  surface: '#1B2838',
  surfaceLight: '#243447',
  text: '#FFFFFF',
  textSecondary: '#8892A0',
  profit: '#2ECC71',
  loss: '#E74C3C',
  warning: '#F39C12',
};

interface AIInsight {
  type: 'warning' | 'opportunity' | 'achievement' | 'tip';
  title: string;
  message: string;
  impact?: string;
  action?: string;
}

interface ProfitMetrics {
  grossRevenue: number;
  totalExpenses: number;
  netProfit: number;
  totalMiles: number;
  profitPerMile: number;
  profitPerDay: number;
}

export default function DashboardScreen() {
  const profile = useProfile();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const activeTrip = useActiveTrip();
  const isTracking = useIsTracking();
  const isOnline = useIsOnline();
  const syncStatus = useSyncStatus();
  const checkNetworkStatus = useSyncStore((state) => state.checkNetworkStatus);

  const [refreshing, setRefreshing] = useState(false);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [recentTrips, setRecentTrips] = useState<Trip[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [profitMetrics, setProfitMetrics] = useState<ProfitMetrics | null>(null);
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [aiNarrative, setAiNarrative] = useState<string>('');

  const loadDashboardData = useCallback(async () => {
    if (!user?.id) return;

    try {
      // Get recent trips
      const trips = await getUserTrips(user.id, { limit: 5, status: 'finalized' });
      setRecentTrips(trips);

      // Get recent transactions
      const transactions = await getUserTransactions(user.id, { limit: 5 });
      setRecentTransactions(transactions);

      // Calculate this month's profit metrics
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split('T')[0];
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        .toISOString()
        .split('T')[0];

      const monthTransactions = await getUserTransactions(user.id, {
        startDate: startOfMonth,
        endDate: endOfMonth,
      });

      const expenses = monthTransactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      const income = monthTransactions
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

      const netProfit = income - expenses;

      // Calculate miles from finalized trips this month
      const monthTrips = trips.filter((t) => {
        const tripDate = new Date(t.started_at);
        return (
          tripDate >= new Date(startOfMonth) &&
          tripDate <= new Date(endOfMonth) &&
          t.status === 'finalized'
        );
      });
      const totalMiles = monthTrips.reduce(
        (sum, t) => sum + (t.auto_miles_total || 0),
        0
      );

      const daysInMonth = now.getDate();

      setProfitMetrics({
        grossRevenue: income,
        totalExpenses: expenses,
        netProfit,
        totalMiles,
        profitPerMile: totalMiles > 0 ? netProfit / totalMiles : 0,
        profitPerDay: daysInMonth > 0 ? netProfit / daysInMonth : 0,
      });
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  }, [user?.id]);

  const loadAIInsights = useCallback(async () => {
    if (!user?.id || !isOnline) return;

    setLoadingInsights(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) return;

      // Call AI profit analyzer
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai-profit-analyzer`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ analysisType: 'weekly' }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setAiInsights(data.insights || []);
        setAiNarrative(data.aiNarrative || '');
      }
    } catch (error) {
      console.error('Failed to load AI insights:', error);
    } finally {
      setLoadingInsights(false);
    }
  }, [user?.id, isOnline]);

  useEffect(() => {
    loadDashboardData();
    checkNetworkStatus();
  }, [loadDashboardData, checkNetworkStatus]);

  useEffect(() => {
    if (isOnline) {
      loadAIInsights();
    }
  }, [isOnline, loadAIInsights]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    await loadAIInsights();
    await checkNetworkStatus();
    setRefreshing(false);
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  const getInsightIcon = (type: AIInsight['type']) => {
    switch (type) {
      case 'warning': return '⚠️';
      case 'opportunity': return '💡';
      case 'achievement': return '🏆';
      case 'tip': return '💰';
      default: return '📊';
    }
  };

  const getInsightColor = (type: AIInsight['type']) => {
    switch (type) {
      case 'warning': return COLORS.loss;
      case 'opportunity': return COLORS.accent;
      case 'achievement': return COLORS.profit;
      case 'tip': return COLORS.secondary;
      default: return COLORS.textSecondary;
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={COLORS.secondary}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            {profile?.full_name ? `${profile.full_name.split(' ')[0]}` : 'Dashboard'}
          </Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/settings')}>
            <Text style={styles.companyName}>
              {profile?.company_name || 'Tap to set up your profile →'}
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/settings')}
          style={styles.settingsButton}
        >
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Sync Status */}
      <View style={styles.statusBar}>
        <View style={[styles.statusDot, isOnline ? styles.online : styles.offline]} />
        <Text style={styles.statusText}>
          {isOnline ? 'Online' : 'Offline'} • {syncStatus}
        </Text>
      </View>

      {/* PROFIT-FIRST: Hero Metrics Card */}
      <View style={styles.profitCard}>
        <Text style={styles.profitCardTitle}>This Month's Profit</Text>
        <View style={styles.profitHero}>
          <Text style={[
            styles.profitAmount,
            { color: (profitMetrics?.netProfit || 0) >= 0 ? COLORS.profit : COLORS.loss }
          ]}>
            ${(profitMetrics?.netProfit || 0).toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}
          </Text>
          <Text style={styles.profitLabel}>NET PROFIT</Text>
        </View>

        <View style={styles.profitMetricsRow}>
          <View style={styles.profitMetric}>
            <Text style={styles.profitMetricValue}>
              ${(profitMetrics?.profitPerMile || 0).toFixed(2)}
            </Text>
            <Text style={styles.profitMetricLabel}>$/mile</Text>
          </View>
          <View style={styles.profitMetricDivider} />
          <View style={styles.profitMetric}>
            <Text style={styles.profitMetricValue}>
              ${(profitMetrics?.profitPerDay || 0).toFixed(0)}
            </Text>
            <Text style={styles.profitMetricLabel}>$/day</Text>
          </View>
          <View style={styles.profitMetricDivider} />
          <View style={styles.profitMetric}>
            <Text style={styles.profitMetricValue}>
              {(profitMetrics?.totalMiles || 0).toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}
            </Text>
            <Text style={styles.profitMetricLabel}>miles</Text>
          </View>
        </View>

        <View style={styles.revenueExpenseRow}>
          <View style={styles.revenueBox}>
            <Text style={styles.revenueLabel}>Revenue</Text>
            <Text style={styles.revenueValue}>
              ${(profitMetrics?.grossRevenue || 0).toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}
            </Text>
          </View>
          <View style={styles.expenseBox}>
            <Text style={styles.expenseLabel}>Expenses</Text>
            <Text style={styles.expenseValue}>
              ${(profitMetrics?.totalExpenses || 0).toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}
            </Text>
          </View>
        </View>
      </View>

      {/* Active Trip Banner */}
      {activeTrip && isTracking && (
        <TouchableOpacity
          style={styles.activeTripBanner}
          onPress={() => router.push('/(tabs)/trip')}
        >
          <View style={styles.pulseDot} />
          <View style={styles.activeTripContent}>
            <Text style={styles.activeTripTitle}>Trip in Progress</Text>
            <Text style={styles.activeTripSubtitle}>
              Started {format(new Date(activeTrip.started_at), 'h:mm a')}
            </Text>
          </View>
          <Text style={styles.activeTripArrow}>→</Text>
        </TouchableOpacity>
      )}

      {/* AI Insights */}
      {(aiInsights.length > 0 || aiNarrative || loadingInsights) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI Insights</Text>

          {loadingInsights ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={COLORS.secondary} />
              <Text style={styles.loadingText}>Analyzing your data...</Text>
            </View>
          ) : (
            <>
              {aiNarrative ? (
                <View style={styles.narrativeCard}>
                  <Text style={styles.narrativeText}>{aiNarrative}</Text>
                </View>
              ) : null}

              {aiInsights.slice(0, 3).map((insight, index) => (
                <View
                  key={index}
                  style={[styles.insightCard, { borderLeftColor: getInsightColor(insight.type) }]}
                >
                  <View style={styles.insightHeader}>
                    <Text style={styles.insightIcon}>{getInsightIcon(insight.type)}</Text>
                    <Text style={styles.insightTitle}>{insight.title}</Text>
                  </View>
                  <Text style={styles.insightMessage}>{insight.message}</Text>
                  {insight.impact && (
                    <Text style={styles.insightImpact}>{insight.impact}</Text>
                  )}
                  {insight.action && (
                    <Text style={styles.insightAction}>→ {insight.action}</Text>
                  )}
                </View>
              ))}
            </>
          )}
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/(tabs)/trip')}
          >
            <Text style={styles.actionIcon}>🚛</Text>
            <Text style={styles.actionText}>
              {isTracking ? 'View Trip' : 'Start Trip'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/(tabs)/documents')}
          >
            <Text style={styles.actionIcon}>📷</Text>
            <Text style={styles.actionText}>Scan Receipt</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/(tabs)/exports')}
          >
            <Text style={styles.actionIcon}>📊</Text>
            <Text style={styles.actionText}>IFTA Report</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent Trips */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Trips</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/trip')}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>
        {recentTrips.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No completed trips yet</Text>
            <Text style={styles.emptySubtext}>Start tracking to see your profit per mile</Text>
          </View>
        ) : (
          recentTrips.map((trip) => (
            <TouchableOpacity
              key={trip.id}
              style={styles.listItem}
              onPress={() => router.push(`/(tabs)/trip/${trip.id}`)}
            >
              <View style={styles.listItemContent}>
                <Text style={styles.listItemTitle}>
                  {format(new Date(trip.started_at), 'MMM d, yyyy')}
                </Text>
                <Text style={styles.listItemSubtitle}>
                  {trip.auto_miles_total?.toFixed(1) || '0'} miles
                </Text>
              </View>
              <Text style={styles.listItemArrow}>→</Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Recent Transactions */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/transactions')}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>
        {recentTransactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No transactions yet</Text>
            <Text style={styles.emptySubtext}>Scan a receipt to start tracking expenses</Text>
          </View>
        ) : (
          recentTransactions.map((txn) => (
            <TouchableOpacity
              key={txn.id}
              style={styles.listItem}
              onPress={() => router.push(`/(tabs)/transactions/${txn.id}`)}
            >
              <View style={styles.listItemContent}>
                <Text style={styles.listItemTitle}>
                  {txn.vendor || txn.category}
                </Text>
                <Text style={styles.listItemSubtitle}>
                  {format(new Date(txn.date), 'MMM d')} • {txn.category}
                </Text>
              </View>
              <Text
                style={[
                  styles.listItemAmount,
                  txn.type === 'income' ? styles.income : styles.expense,
                ]}
              >
                {txn.type === 'income' ? '+' : '-'}${txn.amount.toFixed(2)}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  companyName: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  settingsButton: {
    padding: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    fontSize: 20,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  online: {
    backgroundColor: COLORS.profit,
  },
  offline: {
    backgroundColor: COLORS.loss,
  },
  statusText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },

  // PROFIT-FIRST HERO CARD
  profitCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.surfaceLight,
  },
  profitCardTitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  profitHero: {
    alignItems: 'center',
    marginBottom: 20,
  },
  profitAmount: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  profitLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    letterSpacing: 2,
    marginTop: 4,
  },
  profitMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceLight,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceLight,
  },
  profitMetric: {
    alignItems: 'center',
    flex: 1,
  },
  profitMetricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  profitMetricLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  profitMetricDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.surfaceLight,
  },
  revenueExpenseRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  revenueBox: {
    flex: 1,
    backgroundColor: 'rgba(46, 204, 113, 0.1)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  revenueLabel: {
    fontSize: 12,
    color: COLORS.profit,
  },
  revenueValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.profit,
    marginTop: 4,
  },
  expenseBox: {
    flex: 1,
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  expenseLabel: {
    fontSize: 12,
    color: COLORS.loss,
  },
  expenseValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.loss,
    marginTop: 4,
  },

  // Active Trip Banner
  activeTripBanner: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  pulseDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.profit,
    marginRight: 12,
  },
  activeTripContent: {
    flex: 1,
  },
  activeTripTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  activeTripSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  activeTripArrow: {
    color: COLORS.text,
    fontSize: 18,
  },

  // AI Insights
  loadingContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 8,
  },
  narrativeCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.secondary,
  },
  narrativeText: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 22,
  },
  insightCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderLeftWidth: 4,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  insightIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  insightMessage: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  insightImpact: {
    fontSize: 13,
    color: COLORS.accent,
    marginTop: 8,
    fontWeight: '500',
  },
  insightAction: {
    fontSize: 13,
    color: COLORS.secondary,
    marginTop: 4,
  },

  // Sections
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  seeAllText: {
    color: COLORS.secondary,
    fontSize: 14,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.surfaceLight,
  },
  actionIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  actionText: {
    color: COLORS.text,
    fontSize: 12,
    textAlign: 'center',
  },
  listItem: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  listItemContent: {
    flex: 1,
  },
  listItemTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '500',
  },
  listItemSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  listItemArrow: {
    color: COLORS.textSecondary,
    fontSize: 16,
  },
  listItemAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  income: {
    color: COLORS.profit,
  },
  expense: {
    color: COLORS.loss,
  },
  emptyState: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  emptySubtext: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
    opacity: 0.7,
  },
});
