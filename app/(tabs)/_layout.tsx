import { useEffect } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { useIsAuthenticated, useUser } from '@/stores/authStore';
import { useTripStore } from '@/stores/tripStore';
import { getDatabase } from '@/lib/database';

// Simple icon component (replace with actual icons later)
function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    home: '🏠',
    trip: '🚛',
    calculator: '🧮',
    documents: '📄',
    transactions: '💰',
    exports: '📊',
    detention: '⏱️',
    dev: '🔧',
  };

  return (
    <View style={styles.iconContainer}>
      <Text style={[styles.icon, focused && styles.iconFocused]}>
        {icons[name] || '●'}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  const isAuthenticated = useIsAuthenticated();
  const user = useUser();
  const loadActiveTrip = useTripStore((state) => state.loadActiveTrip);

  // Initialize database and load active trip when authenticated
  useEffect(() => {
    async function init() {
      if (user?.id) {
        try {
          // Ensure database is initialized
          await getDatabase();
          // Load any active trip
          await loadActiveTrip(user.id);
        } catch (error) {
          console.error('Failed to initialize:', error);
        }
      }
    }
    init();
  }, [user?.id, loadActiveTrip]);

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: '#1a1a2e',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: '600',
        },
        tabBarStyle: {
          backgroundColor: '#1a1a2e',
          borderTopColor: '#2d2d44',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#4f46e5',
        tabBarInactiveTintColor: '#888',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="trip"
        options={{
          title: 'Trip',
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabIcon name="trip" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="calculator"
        options={{
          title: 'Calculator',
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabIcon name="calculator" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="documents"
        options={{
          title: 'Documents',
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabIcon name="documents" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Money',
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabIcon name="transactions" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="exports"
        options={{
          title: 'Exports',
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabIcon name="exports" focused={focused} />,
        }}
      />
      {/* Hidden screens - accessible via navigation but not in tab bar */}
      <Tabs.Screen
        name="detention"
        options={{
          href: null, // Hide from tab bar - accessed via dashboard
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="subscription"
        options={{
          href: null, // Hide from tab bar
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null, // Hide from tab bar
          headerShown: false,
        }}
      />
      {/* Dev screen completely removed from production routing for App Store compliance (guideline 2.3.1a) */}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 20,
    opacity: 0.6,
  },
  iconFocused: {
    opacity: 1,
  },
});
