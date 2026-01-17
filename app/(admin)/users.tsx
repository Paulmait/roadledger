import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';

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

interface User {
  id: string;
  email: string;
  full_name: string | null;
  subscription_tier: string;
  created_at: string;
  last_login: string | null;
  trip_count: number;
  doc_count: number;
  monthly_trips: number;
  monthly_docs: number;
}

interface UserDetailModal {
  visible: boolean;
  user: User | null;
}

export default function AdminUsersScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTier, setFilterTier] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      let query = supabase
        .from('profiles')
        .select('id, email, full_name, subscription_tier, created_at, last_login')
        .order('created_at', { ascending: false })
        .limit(100);

      if (filterTier) {
        query = query.eq('subscription_tier', filterTier);
      }

      if (searchQuery) {
        query = query.or(`email.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Get counts for each user (trips, documents, monthly usage)
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

      const usersWithStats = await Promise.all(
        (data || []).map(async (user) => {
          const [tripResult, docResult, monthlyTripResult, monthlyDocResult] = await Promise.all([
            supabase.from('trips').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
            supabase.from('documents').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
            supabase.from('trips').select('*', { count: 'exact', head: true }).eq('user_id', user.id).gte('started_at', startOfMonth),
            supabase.from('documents').select('*', { count: 'exact', head: true }).eq('user_id', user.id).gte('uploaded_at', startOfMonth),
          ]);

          return {
            ...user,
            email: user.email || 'N/A',
            trip_count: tripResult.count || 0,
            doc_count: docResult.count || 0,
            monthly_trips: monthlyTripResult.count || 0,
            monthly_docs: monthlyDocResult.count || 0,
          };
        })
      );

      setUsers(usersWithStats);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filterTier]);

  // Admin action: Log admin actions for audit trail
  const logAdminAction = async (action: string, targetUserId: string, details: string) => {
    try {
      const { data: { user: adminUser } } = await supabase.auth.getUser();
      if (adminUser) {
        await supabase.from('admin_audit_log').insert({
          admin_id: adminUser.id,
          action,
          target_entity: 'user',
          target_id: targetUserId,
          details,
          ip_address: 'admin-panel',
        });
      }
    } catch (error) {
      console.error('Failed to log admin action:', error);
    }
  };

  // Admin action: Reset user's monthly usage counters
  const handleResetUsage = async (user: User) => {
    Alert.alert(
      'Reset Monthly Usage',
      `This will reset ${user.full_name || user.email}'s monthly trip and document counters. This is useful if a user had technical issues that consumed their free quota.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Usage',
          style: 'destructive',
          onPress: async () => {
            try {
              // Log the action
              await logAdminAction('reset_usage', user.id, `Reset monthly usage for ${user.email}`);

              // Note: Since we count from database, we can add a usage_reset_at timestamp
              await supabase
                .from('profiles')
                .update({ usage_reset_at: new Date().toISOString() })
                .eq('id', user.id);

              Alert.alert('Success', 'User usage has been reset. They can now use their monthly quota again.');
              loadUsers();
            } catch (error) {
              Alert.alert('Error', 'Failed to reset usage.');
            }
          },
        },
      ]
    );
  };

  // Admin action: Grant trial/comp subscription
  const handleGrantTrial = async (user: User, days: number, tier: string) => {
    Alert.alert(
      `Grant ${days}-Day ${tier.charAt(0).toUpperCase() + tier.slice(1)} Trial`,
      `This will grant ${user.full_name || user.email} a ${days}-day complimentary ${tier} subscription.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Grant Trial',
          onPress: async () => {
            try {
              const expiryDate = new Date();
              expiryDate.setDate(expiryDate.getDate() + days);

              // Update profile tier
              await supabase
                .from('profiles')
                .update({ subscription_tier: tier })
                .eq('id', user.id);

              // Create/update subscription record
              await supabase.from('subscriptions').upsert({
                user_id: user.id,
                tier,
                status: 'trial',
                current_period_start: new Date().toISOString(),
                current_period_end: expiryDate.toISOString(),
                cancel_at_period_end: true, // Will downgrade after trial
              });

              await logAdminAction('grant_trial', user.id, `Granted ${days}-day ${tier} trial to ${user.email}`);

              Alert.alert('Success', `${days}-day ${tier} trial granted.`);
              loadUsers();
            } catch (error) {
              Alert.alert('Error', 'Failed to grant trial.');
            }
          },
        },
      ]
    );
  };

  // Admin action: View user details
  const showUserDetails = (user: User) => {
    const tierLimits = {
      free: { trips: 5, docs: 3 },
      pro: { trips: 'Unlimited', docs: 'Unlimited' },
      premium: { trips: 'Unlimited', docs: 'Unlimited' },
    };
    const limits = tierLimits[user.subscription_tier as keyof typeof tierLimits] || tierLimits.free;

    Alert.alert(
      `User: ${user.full_name || 'No Name'}`,
      `Email: ${user.email}\n` +
      `Tier: ${user.subscription_tier.toUpperCase()}\n` +
      `Joined: ${format(new Date(user.created_at), 'MMM d, yyyy')}\n` +
      `Last Login: ${user.last_login ? format(new Date(user.last_login), 'MMM d, yyyy h:mm a') : 'Never'}\n\n` +
      `--- All Time ---\n` +
      `Total Trips: ${user.trip_count}\n` +
      `Total Documents: ${user.doc_count}\n\n` +
      `--- This Month ---\n` +
      `Trips: ${user.monthly_trips} / ${limits.trips}\n` +
      `Documents: ${user.monthly_docs} / ${limits.docs}`,
      [
        { text: 'Close', style: 'cancel' },
        { text: 'Reset Usage', onPress: () => handleResetUsage(user) },
        { text: 'Grant Trial', onPress: () => showTrialOptions(user) },
      ]
    );
  };

  // Show trial duration options
  const showTrialOptions = (user: User) => {
    Alert.alert(
      'Grant Trial',
      'Select trial duration:',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: '7 Days Pro', onPress: () => handleGrantTrial(user, 7, 'pro') },
        { text: '14 Days Pro', onPress: () => handleGrantTrial(user, 14, 'pro') },
        { text: '30 Days Premium', onPress: () => handleGrantTrial(user, 30, 'premium') },
      ]
    );
  };

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadUsers();
    setRefreshing(false);
  }, [loadUsers]);

  const handleUpdateTier = async (userId: string, newTier: string) => {
    Alert.alert(
      'Update Subscription',
      `Change user's subscription to ${newTier}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('profiles')
                .update({ subscription_tier: newTier })
                .eq('id', userId);

              if (error) throw error;

              Alert.alert('Success', 'User subscription updated.');
              loadUsers();
            } catch (error) {
              Alert.alert('Error', 'Failed to update subscription.');
            }
          },
        },
      ]
    );
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
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by email or name..."
          placeholderTextColor={COLORS.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={loadUsers}
        />
      </View>

      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
      >
        {[null, 'free', 'pro', 'premium'].map((tier) => (
          <TouchableOpacity
            key={tier || 'all'}
            style={[
              styles.filterTab,
              filterTier === tier && styles.filterTabActive,
            ]}
            onPress={() => setFilterTier(tier)}
          >
            <Text
              style={[
                styles.filterTabText,
                filterTier === tier && styles.filterTabTextActive,
              ]}
            >
              {tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : 'All'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* User List */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.secondary}
          />
        }
      >
        {users.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No users found</Text>
          </View>
        ) : (
          users.map((user) => (
            <TouchableOpacity
              key={user.id}
              style={styles.userCard}
              onPress={() => showUserDetails(user)}
              activeOpacity={0.7}
            >
              <View style={styles.userInfo}>
                <Text style={styles.userName}>
                  {user.full_name || 'No name'}
                </Text>
                <Text style={styles.userEmail}>{user.email}</Text>
                <View style={styles.userMeta}>
                  <Text style={styles.userMetaText}>
                    Joined: {format(new Date(user.created_at), 'MMM d, yyyy')}
                  </Text>
                  <Text style={styles.userMetaText}>
                    Trips: {user.trip_count}
                  </Text>
                  <Text style={styles.userMetaText}>
                    Docs: {user.doc_count}
                  </Text>
                </View>
                {/* Monthly usage for free tier */}
                {user.subscription_tier === 'free' && (
                  <View style={styles.usageIndicator}>
                    <Text style={[
                      styles.usageText,
                      user.monthly_trips >= 5 && styles.usageTextWarning
                    ]}>
                      {user.monthly_trips}/5 trips
                    </Text>
                    <Text style={[
                      styles.usageText,
                      user.monthly_docs >= 3 && styles.usageTextWarning
                    ]}>
                      {user.monthly_docs}/3 docs
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.userActions}>
                <View
                  style={[
                    styles.tierBadge,
                    { backgroundColor: getTierColor(user.subscription_tier) },
                  ]}
                >
                  <Text style={styles.tierBadgeText}>
                    {user.subscription_tier.toUpperCase()}
                  </Text>
                </View>

                <View style={styles.tierButtons}>
                  {['free', 'pro', 'premium'].map((tier) =>
                    tier !== user.subscription_tier ? (
                      <TouchableOpacity
                        key={tier}
                        style={styles.tierButton}
                        onPress={() => handleUpdateTier(user.id, tier)}
                      >
                        <Text style={styles.tierButtonText}>{tier}</Text>
                      </TouchableOpacity>
                    ) : null
                  )}
                </View>

                <TouchableOpacity
                  style={styles.detailsButton}
                  onPress={() => showUserDetails(user)}
                >
                  <Text style={styles.detailsButtonText}>Details</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  searchContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
  },
  searchInput: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: 12,
    color: COLORS.text,
    fontSize: 16,
  },
  filterContainer: {
    maxHeight: 50,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginLeft: 8,
  },
  filterTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.secondary,
  },
  filterTabText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: COLORS.secondary,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 16,
  },
  userCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  userEmail: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 2,
  },
  userMeta: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  userMetaText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  userActions: {
    alignItems: 'flex-end',
  },
  tierBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tierBadgeText: {
    color: COLORS.background,
    fontSize: 10,
    fontWeight: '700',
  },
  tierButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  tierButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 4,
  },
  tierButtonText: {
    color: COLORS.textSecondary,
    fontSize: 10,
  },
  usageIndicator: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  usageText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  usageTextWarning: {
    color: COLORS.loss,
    backgroundColor: 'rgba(231, 76, 60, 0.2)',
  },
  detailsButton: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 4,
    alignItems: 'center',
  },
  detailsButtonText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '500',
  },
});
