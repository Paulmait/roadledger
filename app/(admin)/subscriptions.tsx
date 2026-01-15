import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { format, subMonths } from 'date-fns';

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

interface SubscriptionStats {
  totalActive: number;
  proActive: number;
  premiumActive: number;
  mrr: number;
  arr: number;
  newThisMonth: number;
  cancelledThisMonth: number;
  trialConversion: number;
}

interface RecentSubscription {
  id: string;
  user_id: string;
  email: string;
  tier: string;
  status: string;
  started_at: string;
  expires_at: string | null;
  will_renew: boolean;
}

export default function AdminSubscriptionsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<SubscriptionStats | null>(null);
  const [recentSubscriptions, setRecentSubscriptions] = useState<RecentSubscription[]>([]);
  const [filterStatus, setFilterStatus] = useState<string | null>('active');

  const loadSubscriptions = useCallback(async () => {
    try {
      // Get subscription stats
      const { count: totalActive } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      const { count: proActive } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')
        .eq('tier', 'pro');

      const { count: premiumActive } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')
        .eq('tier', 'premium');

      // Calculate MRR
      const proMRR = (proActive || 0) * 9.99;
      const premiumMRR = (premiumActive || 0) * 19.99;
      const mrr = proMRR + premiumMRR;
      const arr = mrr * 12;

      // New subscriptions this month
      const startOfMonth = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1
      ).toISOString();
      const { count: newThisMonth } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .gte('started_at', startOfMonth)
        .neq('tier', 'free');

      // Cancelled this month
      const { count: cancelledThisMonth } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'cancelled')
        .gte('cancelled_at', startOfMonth);

      setStats({
        totalActive: totalActive || 0,
        proActive: proActive || 0,
        premiumActive: premiumActive || 0,
        mrr,
        arr,
        newThisMonth: newThisMonth || 0,
        cancelledThisMonth: cancelledThisMonth || 0,
        trialConversion: 0, // Would need trial tracking
      });

      // Load recent subscriptions
      let query = supabase
        .from('subscriptions')
        .select(`
          id,
          user_id,
          tier,
          status,
          started_at,
          expires_at,
          will_renew
        `)
        .order('started_at', { ascending: false })
        .limit(50);

      if (filterStatus) {
        query = query.eq('status', filterStatus);
      }

      const { data: subscriptions } = await query;

      // Get user emails for subscriptions
      const subsWithEmails = await Promise.all(
        (subscriptions || []).map(async (sub) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', sub.user_id)
            .single();

          return {
            ...sub,
            email: profile?.email || 'Unknown',
          };
        })
      );

      setRecentSubscriptions(subsWithEmails);
    } catch (error) {
      console.error('Failed to load subscriptions:', error);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSubscriptions();
    setRefreshing(false);
  }, [loadSubscriptions]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return COLORS.secondary;
      case 'cancelled':
        return COLORS.loss;
      case 'expired':
        return COLORS.textSecondary;
      default:
        return COLORS.accent;
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'premium':
        return COLORS.accent;
      case 'pro':
        return COLORS.secondary;
      default:
        return COLORS.textSecondary;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.secondary} />
      </View>
    );
  }

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
      {/* Revenue Stats */}
      <View style={styles.revenueSection}>
        <View style={styles.revenueCard}>
          <Text style={styles.revenueLabel}>Monthly Recurring Revenue</Text>
          <Text style={styles.revenueValue}>
            ${stats?.mrr.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </Text>
        </View>
        <View style={styles.revenueCard}>
          <Text style={styles.revenueLabel}>Annual Run Rate</Text>
          <Text style={styles.revenueValue}>
            ${stats?.arr.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </Text>
        </View>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats?.totalActive}</Text>
          <Text style={styles.statLabel}>Active Subs</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: COLORS.secondary }]}>
            {stats?.proActive}
          </Text>
          <Text style={styles.statLabel}>Pro</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: COLORS.accent }]}>
            {stats?.premiumActive}
          </Text>
          <Text style={styles.statLabel}>Premium</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: COLORS.profit }]}>
            +{stats?.newThisMonth}
          </Text>
          <Text style={styles.statLabel}>New (Month)</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
      >
        {[null, 'active', 'cancelled', 'expired'].map((status) => (
          <TouchableOpacity
            key={status || 'all'}
            style={[
              styles.filterTab,
              filterStatus === status && styles.filterTabActive,
            ]}
            onPress={() => setFilterStatus(status)}
          >
            <Text
              style={[
                styles.filterTabText,
                filterStatus === status && styles.filterTabTextActive,
              ]}
            >
              {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'All'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Subscription List */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Subscriptions</Text>
        {recentSubscriptions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No subscriptions found</Text>
          </View>
        ) : (
          recentSubscriptions.map((sub) => (
            <View key={sub.id} style={styles.subCard}>
              <View style={styles.subInfo}>
                <Text style={styles.subEmail}>{sub.email}</Text>
                <Text style={styles.subDate}>
                  Started: {format(new Date(sub.started_at), 'MMM d, yyyy')}
                </Text>
                {sub.expires_at && (
                  <Text style={styles.subDate}>
                    Expires: {format(new Date(sub.expires_at), 'MMM d, yyyy')}
                  </Text>
                )}
              </View>
              <View style={styles.subBadges}>
                <View
                  style={[
                    styles.tierBadge,
                    { backgroundColor: getTierColor(sub.tier) },
                  ]}
                >
                  <Text style={styles.badgeText}>{sub.tier.toUpperCase()}</Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(sub.status) },
                  ]}
                >
                  <Text style={styles.badgeText}>{sub.status}</Text>
                </View>
                {sub.will_renew && (
                  <View style={[styles.renewBadge]}>
                    <Text style={styles.renewText}>Auto-renew</Text>
                  </View>
                )}
              </View>
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
  revenueSection: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  revenueCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  revenueLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 8,
  },
  revenueValue: {
    color: COLORS.profit,
    fontSize: 24,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    width: (Dimensions.get('window').width - 60) / 4,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  statValue: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    color: COLORS.textSecondary,
    fontSize: 10,
    marginTop: 4,
  },
  filterContainer: {
    marginBottom: 16,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    marginRight: 8,
  },
  filterTabActive: {
    backgroundColor: COLORS.secondary,
  },
  filterTabText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  filterTabTextActive: {
    color: COLORS.background,
    fontWeight: '600',
  },
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  subCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceLight,
  },
  subInfo: {
    flex: 1,
  },
  subEmail: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '500',
  },
  subDate: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  subBadges: {
    alignItems: 'flex-end',
    gap: 4,
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  renewBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.secondary,
  },
  badgeText: {
    color: COLORS.background,
    fontSize: 9,
    fontWeight: '600',
  },
  renewText: {
    color: COLORS.secondary,
    fontSize: 9,
  },
});
