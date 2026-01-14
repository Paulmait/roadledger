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
import { supabase } from '@/lib/supabase';
import { format, subDays } from 'date-fns';

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

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  newUsersToday: number;
  freeUsers: number;
  proUsers: number;
  premiumUsers: number;
  totalRevenue: number;
  monthlyRevenue: number;
  totalTrips: number;
  totalMiles: number;
  documentsProcessed: number;
  pendingTickets: number;
}

interface RecentUser {
  id: string;
  email: string;
  full_name: string;
  subscription_tier: string;
  created_at: string;
}

export default function AdminDashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [adminRole, setAdminRole] = useState<string>('');

  const loadDashboardData = useCallback(async () => {
    try {
      // Get admin role
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: adminData } = await supabase
          .from('admin_users')
          .select('role')
          .eq('id', user.id)
          .single();
        setAdminRole(adminData?.role || '');
      }

      // Get user counts
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Get today's new users
      const today = new Date().toISOString().split('T')[0];
      const { count: newUsersToday } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today);

      // Get subscription breakdown
      const { count: freeUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('subscription_tier', 'free');

      const { count: proUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('subscription_tier', 'pro');

      const { count: premiumUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('subscription_tier', 'premium');

      // Get trip stats
      const { count: totalTrips } = await supabase
        .from('trips')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'finalized');

      const { data: milesData } = await supabase
        .from('trips')
        .select('auto_miles_total')
        .eq('status', 'finalized');

      const totalMiles = milesData?.reduce((sum, t) => sum + (t.auto_miles_total || 0), 0) || 0;

      // Get document count
      const { count: documentsProcessed } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('parsed_status', 'parsed');

      // Get pending tickets
      const { count: pendingTickets } = await supabase
        .from('support_tickets')
        .select('*', { count: 'exact', head: true })
        .in('status', ['open', 'in_progress']);

      // Calculate active users (last 7 days)
      const sevenDaysAgo = subDays(new Date(), 7).toISOString();
      const { data: activeData } = await supabase
        .from('analytics_events')
        .select('user_id')
        .gte('created_at', sevenDaysAgo);

      const activeUsers = new Set(activeData?.map(e => e.user_id).filter(Boolean)).size;

      // Calculate revenue (from subscriptions)
      const { data: subscriptions } = await supabase
        .from('subscriptions')
        .select('tier, started_at')
        .eq('status', 'active');

      // Estimate revenue based on tier
      let totalRevenue = 0;
      let monthlyRevenue = 0;
      const thisMonth = new Date().toISOString().slice(0, 7);

      subscriptions?.forEach(sub => {
        const monthlyAmount = sub.tier === 'premium' ? 19.99 : sub.tier === 'pro' ? 9.99 : 0;
        totalRevenue += monthlyAmount;
        if (sub.started_at?.startsWith(thisMonth)) {
          monthlyRevenue += monthlyAmount;
        }
      });

      setStats({
        totalUsers: totalUsers || 0,
        activeUsers,
        newUsersToday: newUsersToday || 0,
        freeUsers: freeUsers || 0,
        proUsers: proUsers || 0,
        premiumUsers: premiumUsers || 0,
        totalRevenue,
        monthlyRevenue,
        totalTrips: totalTrips || 0,
        totalMiles,
        documentsProcessed: documentsProcessed || 0,
        pendingTickets: pendingTickets || 0,
      });

      // Get recent users
      const { data: users } = await supabase
        .from('profiles')
        .select('id, full_name, subscription_tier, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      // Get emails separately (from auth.users via service function or join)
      setRecentUsers(users?.map(u => ({
        ...u,
        email: 'user@example.com', // Would need service function to get actual emails
      })) || []);

    } catch (error) {
      console.error('Failed to load admin dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.secondary} />
      </View>
    );
  }

  const conversionRate = stats && stats.totalUsers > 0
    ? (((stats.proUsers + stats.premiumUsers) / stats.totalUsers) * 100).toFixed(1)
    : '0';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.secondary} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Admin Dashboard</Text>
          <Text style={styles.subtitle}>Role: {adminRole}</Text>
        </View>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.push('/(tabs)')}
        >
          <Text style={styles.backButtonText}>Exit Admin</Text>
        </TouchableOpacity>
      </View>

      {/* Key Metrics for Investors */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Key Metrics</Text>
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{stats?.totalUsers.toLocaleString()}</Text>
            <Text style={styles.metricLabel}>Total Users</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{stats?.activeUsers.toLocaleString()}</Text>
            <Text style={styles.metricLabel}>Active (7d)</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={[styles.metricValue, { color: COLORS.profit }]}>
              ${stats?.monthlyRevenue.toFixed(0)}
            </Text>
            <Text style={styles.metricLabel}>MRR</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{conversionRate}%</Text>
            <Text style={styles.metricLabel}>Conversion</Text>
          </View>
        </View>
      </View>

      {/* Subscription Breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Subscriptions</Text>
        <View style={styles.subscriptionCard}>
          <View style={styles.subscriptionRow}>
            <Text style={styles.subscriptionLabel}>Free</Text>
            <View style={styles.subscriptionBarContainer}>
              <View
                style={[
                  styles.subscriptionBar,
                  {
                    width: `${stats && stats.totalUsers > 0 ? (stats.freeUsers / stats.totalUsers) * 100 : 0}%`,
                    backgroundColor: COLORS.textSecondary,
                  },
                ]}
              />
            </View>
            <Text style={styles.subscriptionCount}>{stats?.freeUsers}</Text>
          </View>
          <View style={styles.subscriptionRow}>
            <Text style={styles.subscriptionLabel}>Pro</Text>
            <View style={styles.subscriptionBarContainer}>
              <View
                style={[
                  styles.subscriptionBar,
                  {
                    width: `${stats && stats.totalUsers > 0 ? (stats.proUsers / stats.totalUsers) * 100 : 0}%`,
                    backgroundColor: COLORS.secondary,
                  },
                ]}
              />
            </View>
            <Text style={styles.subscriptionCount}>{stats?.proUsers}</Text>
          </View>
          <View style={styles.subscriptionRow}>
            <Text style={styles.subscriptionLabel}>Premium</Text>
            <View style={styles.subscriptionBarContainer}>
              <View
                style={[
                  styles.subscriptionBar,
                  {
                    width: `${stats && stats.totalUsers > 0 ? (stats.premiumUsers / stats.totalUsers) * 100 : 0}%`,
                    backgroundColor: COLORS.accent,
                  },
                ]}
              />
            </View>
            <Text style={styles.subscriptionCount}>{stats?.premiumUsers}</Text>
          </View>
        </View>
      </View>

      {/* Product Metrics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Product Metrics</Text>
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{stats?.totalTrips.toLocaleString()}</Text>
            <Text style={styles.metricLabel}>Trips</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>
              {(stats?.totalMiles || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </Text>
            <Text style={styles.metricLabel}>Miles</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{stats?.documentsProcessed.toLocaleString()}</Text>
            <Text style={styles.metricLabel}>Docs</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={[
              styles.metricValue,
              { color: (stats?.pendingTickets || 0) > 0 ? COLORS.accent : COLORS.profit }
            ]}>
              {stats?.pendingTickets}
            </Text>
            <Text style={styles.metricLabel}>Tickets</Text>
          </View>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(admin)/users')}
          >
            <Text style={styles.actionIcon}>👥</Text>
            <Text style={styles.actionLabel}>Users</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(admin)/analytics')}
          >
            <Text style={styles.actionIcon}>📊</Text>
            <Text style={styles.actionLabel}>Analytics</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(admin)/subscriptions')}
          >
            <Text style={styles.actionIcon}>💳</Text>
            <Text style={styles.actionLabel}>Billing</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(admin)/support')}
          >
            <Text style={styles.actionIcon}>🎫</Text>
            <Text style={styles.actionLabel}>Support</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent Users */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>New Users Today</Text>
          <Text style={styles.todayCount}>+{stats?.newUsersToday}</Text>
        </View>
        {recentUsers.map((user) => (
          <TouchableOpacity
            key={user.id}
            style={styles.userCard}
            onPress={() => router.push(`/(admin)/users?id=${user.id}`)}
          >
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user.full_name || 'Unnamed User'}</Text>
              <Text style={styles.userDate}>
                {format(new Date(user.created_at), 'MMM d, h:mm a')}
              </Text>
            </View>
            <View style={[
              styles.tierBadge,
              { backgroundColor: user.subscription_tier === 'premium' ? COLORS.accent :
                user.subscription_tier === 'pro' ? COLORS.secondary : COLORS.surfaceLight }
            ]}>
              <Text style={styles.tierText}>{user.subscription_tier || 'free'}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Last updated: {format(new Date(), 'MMM d, yyyy h:mm a')}
        </Text>
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
    paddingTop: 60,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  backButton: {
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  backButtonText: {
    color: COLORS.text,
    fontSize: 14,
  },
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
  todayCount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.profit,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  metricLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  subscriptionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
  },
  subscriptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  subscriptionLabel: {
    width: 70,
    fontSize: 14,
    color: COLORS.text,
  },
  subscriptionBarContainer: {
    flex: 1,
    height: 20,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 10,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  subscriptionBar: {
    height: '100%',
    borderRadius: 10,
  },
  subscriptionCount: {
    width: 40,
    fontSize: 14,
    color: COLORS.text,
    textAlign: 'right',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  userCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },
  userDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  tierBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tierText: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  footer: {
    marginTop: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
});
