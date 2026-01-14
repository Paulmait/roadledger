import { Stack } from 'expo-router';

export default function TripLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#1a1a2e',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: '600',
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Trip Tracking',
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: 'Trip Details',
        }}
      />
    </Stack>
  );
}
