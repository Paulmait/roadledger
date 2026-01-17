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
import { notificationService } from '@/services/notifications/notificationService';

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
        // Initialize auth first (critical)
        await initialize();
        // Check network status
        await checkNetworkStatus();
      } catch (error) {
        console.error('Initialization error:', error);
      } finally {
        // Hide splash screen regardless of errors
        await SplashScreen.hideAsync();
      }

      // Non-critical initialization (don't block app startup)
      try {
        await startSyncEngine();
      } catch (error) {
        console.error('Sync engine init error:', error);
      }

      try {
        const user = useAuthStore.getState().user;
        await analytics.initialize(user?.id);
      } catch (error) {
        console.error('Analytics init error:', error);
      }

      // Initialize push notifications and schedule IFTA reminders
      try {
        await notificationService.initialize();
        const user = useAuthStore.getState().user;
        if (user?.id) {
          // Save push token and schedule IFTA reminders
          await notificationService.savePushToken(user.id);
          await notificationService.scheduleIFTAReminders(7); // 7 days before deadline
          await notificationService.scheduleDailySummary(20, 0); // 8 PM daily summary
        }
      } catch (error) {
        console.error('Notification init error:', error);
      }
    }

    init();

    // Cleanup on unmount
    return () => {
      try {
        analytics.shutdown();
        notificationService.removeListeners();
      } catch (error) {
        // Ignore cleanup errors
      }
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
