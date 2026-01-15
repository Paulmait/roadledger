import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

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
};

interface DailyMetric {
  date: string;
  signups: number;
  activeUsers: number;
  trips: number;
  documents: number;
  revenue: number;
}

interface EventCount {
  event_name: string;
  count: number;
}

export default function AdminAnalyticsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetric[]>([]);
  const [eventCounts, setEventCounts] = useState<EventCount[]>([]);
  const [totals, setTotals] = useState({
    totalSignups: 0,
    totalTrips: 0,
    totalDocuments: 0,
    avgDailyActive: 0,
    conversionRate: 0,
    churnRate: 0,
  });

  const loadAnalytics = useCallback(async () => {
    try {
      const days = 14;
      const metrics: DailyMetric[] = [];

      // Load daily metrics for the last 14 days
      for (let i = days - 1; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const dateStr = format(date, 'yyyy-MM-dd');
        const startDate = startOfDay(date).toISOString();
        const endDate = endOfDay(date).toISOString();

        // New signups
        const { count: signups } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', startDate)
          .lte('created_at', endDate);

        // Active users (unique users with events)
        const { data: activeData } = await supabase
          .from('analytics_events')
          .select('user_id')
          .gte('created_at', startDate)
          .lte('created_at', endDate);

        const activeUsers = new Set(
          activeData?.map((e) => e.user_id).filter(Boolean)
        ).size;

        // Trips completed
        const { count: trips } = await supabase
          .from('trips')
          .select('*', { count: 'exact', head: true })
          .gte('ended_at', startDate)
          .lte('ended_at', endDate)
          .eq('status', 'finalized');

        // Documents processed
        const { count: documents } = await supabase
          .from('documents')
          .select('*', { count: 'exact', head: true })
          .gte('uploaded_at', startDate)
          .lte('uploaded_at', endDate);

        // Revenue (simplified - count new subscriptions)
        const { count: newSubs } = await supabase
          .from('subscriptions')
          .select('*', { count: 'exact', head: true })
          .gte('started_at', startDate)
          .lte('started_at', endDate)
          .neq('tier', 'free');

        metrics.push({
          date: dateStr,
          signups: signups || 0,
          activeUsers: activeUsers || 0,
          trips: trips || 0,
          documents: documents || 0,
          revenue: (newSubs || 0) * 9.99, // Simplified
        });
      }

      setDailyMetrics(metrics);

      // Calculate totals
      const totalSignups = metrics.reduce((sum, m) => sum + m.signups, 0);
      const totalTrips = metrics.reduce((sum, m) => sum + m.trips, 0);
      const totalDocuments = metrics.reduce((sum, m) => sum + m.documents, 0);
      const avgDailyActive = Math.round(
        metrics.reduce((sum, m) => sum + m.activeUsers, 0) / metrics.length
      );

      // Get conversion rate
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      const { count: paidUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .in('subscription_tier', ['pro', 'premium']);

      const conversionRate =
        totalUsers && totalUsers > 0
          ? Math.round(((paidUsers || 0) / totalUsers) * 100)
          : 0;

      setTotals({
        totalSignups,
        totalTrips,
        totalDocuments,
        avgDailyActive,
        conversionRate,
        churnRate: 0, // Would need subscription history to calculate
      });

      // Load event breakdown
      const { data: eventData } = await supabase
        .from('analytics_events')
        .select('event_name')
        .gte('created_at', subDays(new Date(), 7).toISOString());

      const eventMap: Record<string, number> = {};
      eventData?.forEach((e) => {
        eventMap[e.event_name] = (eventMap[e.event_name] || 0) + 1;
      });

      const sortedEvents = Object.entries(eventMap)
        .map(([event_name, count]) => ({ event_name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      setEventCounts(sortedEvents);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAnalytics();
    setRefreshing(false);
  }, [loadAnalytics]);

  const getBarHeight = (value: number, maxValue: number) => {
    if (maxValue === 0) return 0;
    return Math.max(4, (value / maxValue) * 100);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.secondary} />
      </View>
    );
  }

  const maxActive = Math.max(...dailyMetrics.map((m) => m.activeUsers), 1);

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
      {/* Summary Cards */}
      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{totals.totalSignups}</Text>
          <Text style={styles.summaryLabel}>New Signups (14d)</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{totals.avgDailyActive}</Text>
          <Text style={styles.summaryLabel}>Avg Daily Active</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{totals.conversionRate}%</Text>
          <Text style={styles.summaryLabel}>Conversion Rate</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{totals.totalTrips}</Text>
          <Text style={styles.summaryLabel}>Trips (14d)</Text>
        </View>
      </View>

      {/* Daily Active Users Chart */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Daily Active Users</Text>
        <View style={styles.chart}>
          {dailyMetrics.map((metric) => (
            <View key={metric.date} style={styles.chartBar}>
              <View
                style={[
                  styles.bar,
                  {
                    height: getBarHeight(metric.activeUsers, maxActive),
                    backgroundColor: COLORS.secondary,
                  },
                ]}
              />
              <Text style={styles.chartLabel}>
                {format(new Date(metric.date), 'MM/dd')}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Daily Metrics Table */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Daily Breakdown</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCell, styles.tableCellHeader]}>Date</Text>
            <Text style={[styles.tableCell, styles.tableCellHeader]}>Signups</Text>
            <Text style={[styles.tableCell, styles.tableCellHeader]}>Active</Text>
            <Text style={[styles.tableCell, styles.tableCellHeader]}>Trips</Text>
            <Text style={[styles.tableCell, styles.tableCellHeader]}>Docs</Text>
          </View>
          {dailyMetrics.slice(-7).reverse().map((metric) => (
            <View key={metric.date} style={styles.tableRow}>
              <Text style={styles.tableCell}>
                {format(new Date(metric.date), 'MM/dd')}
              </Text>
              <Text style={styles.tableCell}>{metric.signups}</Text>
              <Text style={styles.tableCell}>{metric.activeUsers}</Text>
              <Text style={styles.tableCell}>{metric.trips}</Text>
              <Text style={styles.tableCell}>{metric.documents}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Top Events */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Top Events (7d)</Text>
        {eventCounts.length === 0 ? (
          <Text style={styles.emptyText}>No events recorded</Text>
        ) : (
          eventCounts.map((event) => (
            <View key={event.event_name} style={styles.eventRow}>
              <Text style={styles.eventName}>{event.event_name}</Text>
              <Text style={styles.eventCount}>{event.count}</Text>
            </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  summaryCard: {
    width: (Dimensions.get('window').width - 44) / 2,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  summaryValue: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '700',
  },
  summaryLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  chart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
  },
  chartBar: {
    alignItems: 'center',
    flex: 1,
  },
  bar: {
    width: 12,
    borderRadius: 6,
    minHeight: 4,
  },
  chartLabel: {
    color: COLORS.textSecondary,
    fontSize: 8,
    marginTop: 4,
    transform: [{ rotate: '-45deg' }],
  },
  table: {
    borderWidth: 1,
    borderColor: COLORS.surfaceLight,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceLight,
  },
  tableRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceLight,
  },
  tableCell: {
    flex: 1,
    padding: 10,
    color: COLORS.text,
    fontSize: 12,
    textAlign: 'center',
  },
  tableCellHeader: {
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  eventRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceLight,
  },
  eventName: {
    color: COLORS.text,
    fontSize: 14,
  },
  eventCount: {
    color: COLORS.secondary,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    padding: 16,
  },
});
