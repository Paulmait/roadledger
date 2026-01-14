import { Redirect, Stack } from 'expo-router';
import { useIsAuthenticated } from '@/stores/authStore';

export default function AuthLayout() {
  const isAuthenticated = useIsAuthenticated();

  // If user is authenticated, redirect to main app
  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="onboarding" />
    </Stack>
  );
}
