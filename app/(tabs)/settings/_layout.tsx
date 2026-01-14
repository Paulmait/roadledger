import { Stack } from 'expo-router';

const COLORS = {
  background: '#0D1B2A',
  text: '#FFFFFF',
};

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.background },
        headerTintColor: COLORS.text,
        headerTitleStyle: { fontWeight: 'bold' },
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Settings' }} />
      <Stack.Screen name="legal" options={{ title: 'Legal' }} />
      <Stack.Screen name="privacy" options={{ title: 'Privacy' }} />
      <Stack.Screen name="accessibility" options={{ title: 'Accessibility' }} />
    </Stack>
  );
}
