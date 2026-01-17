import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { useSyncStore } from '@/stores/syncStore';
import { startSyncEngine } from '@/services/sync';
import { analytics } from '@/services/analytics/analyticsService';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

// Create a query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const initialize = useAuthStore((state) => state.initialize);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const checkNetworkStatus = useSyncStore((state) => state.checkNetworkStatus);

  useEffect(() => {
    async function init() {
      try {
        // Initialize auth
        await initialize();
        // Check network status
        await checkNetworkStatus();
        // Start sync engine for offline support
        await startSyncEngine();
        // Initialize analytics
        const user = useAuthStore.getState().user;
        await analytics.initialize(user?.id);
      } catch (error) {
        console.error('Initialization error:', error);
      } finally {
        // Hide splash screen
        await SplashScreen.hideAsync();
      }
    }

    init();

    // Cleanup on unmount
    return () => {
      analytics.shutdown();
    };
  }, [initialize, checkNetworkStatus]);

  // Don't render until initialized
  if (!isInitialized) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </QueryClientProvider>
  );
}
