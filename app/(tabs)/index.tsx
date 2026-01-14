import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useProfile, useAuthStore } from '@/stores/authStore';
import { useTripStore, useActiveTrip, useIsTracking } from '@/stores/tripStore';
import { useSyncStore, useIsOnline, useSyncStatus } from '@/stores/syncStore';
import { getUserTransactions, getUserTrips } from '@/lib/database';
import type { Transaction, Trip } from '@/types/database.types';
import { format } from 'date-fns';

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
  const [recentTrips, setRecentTrips] = useState<Trip[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState({
    totalMilesThisMonth: 0,
    totalExpensesThisMonth: 0,
    totalIncomeThisMonth: 0,
  });

  const loadDashboardData = async () => {
    if (!user?.id) return;

    try {
      // Get recent trips
      const trips = await getUserTrips(user.id, { limit: 5, status: 'finalized' });
      setRecentTrips(trips);

      // Get recent transactions
      const transactions = await getUserTransactions(user.id, { limit: 5 });
      setRecentTransactions(transactions);

      // Calculate this month's stats
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

      setStats({
        totalMilesThisMonth: totalMiles,
        totalExpensesThisMonth: expenses,
        totalIncomeThisMonth: income,
      });
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  };

  useEffect(() => {
    loadDashboardData();
    checkNetworkStatus();
  }, [user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    await checkNetworkStatus();
    setRefreshing(false);
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#4f46e5"
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
          </Text>
          <Text style={styles.companyName}>
            {profile?.company_name || 'Set up your profile'}
          </Text>
        </View>
        <TouchableOpacity onPress={handleSignOut} style={styles.signOutButton}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Sync Status */}
      <View style={styles.statusBar}>
        <View style={[styles.statusDot, isOnline ? styles.online : styles.offline]} />
        <Text style={styles.statusText}>
          {isOnline ? 'Online' : 'Offline'} - {syncStatus}
        </Text>
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

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {stats.totalMilesThisMonth.toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}
          </Text>
          <Text style={styles.statLabel}>Miles This Month</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            ${stats.totalIncomeThisMonth.toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}
          </Text>
          <Text style={styles.statLabel}>Income</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, styles.expenseValue]}>
            ${stats.totalExpensesThisMonth.toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}
          </Text>
          <Text style={styles.statLabel}>Expenses</Text>
        </View>
      </View>

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
    backgroundColor: '#1a1a2e',
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  companyName: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  signOutButton: {
    padding: 8,
  },
  signOutText: {
    color: '#888',
    fontSize: 14,
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
    backgroundColor: '#22c55e',
  },
  offline: {
    backgroundColor: '#ef4444',
  },
  statusText: {
    color: '#888',
    fontSize: 12,
  },
  activeTripBanner: {
    backgroundColor: '#4f46e5',
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
    backgroundColor: '#22c55e',
    marginRight: 12,
  },
  activeTripContent: {
    flex: 1,
  },
  activeTripTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  activeTripSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  activeTripArrow: {
    color: '#fff',
    fontSize: 18,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  expenseValue: {
    color: '#ef4444',
  },
  statLabel: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
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
    color: '#fff',
    marginBottom: 12,
  },
  seeAllText: {
    color: '#4f46e5',
    fontSize: 14,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  actionText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
  listItem: {
    backgroundColor: '#2d2d44',
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
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  listItemSubtitle: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  listItemArrow: {
    color: '#888',
    fontSize: 16,
  },
  listItemAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  income: {
    color: '#22c55e',
  },
  expense: {
    color: '#ef4444',
  },
  emptyState: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: '#888',
    fontSize: 14,
  },
});
