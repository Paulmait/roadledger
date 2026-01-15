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
}

export default function AdminUsersScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTier, setFilterTier] = useState<string | null>(null);

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

      // Get trip counts for each user
      const usersWithTrips = await Promise.all(
        (data || []).map(async (user) => {
          const { count } = await supabase
            .from('trips')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id);

          return {
            ...user,
            email: user.email || 'N/A',
            trip_count: count || 0,
          };
        })
      );

      setUsers(usersWithTrips);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filterTier]);

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
            <View key={user.id} style={styles.userCard}>
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
                </View>
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
              </View>
            </View>
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
});
