import { Stack } from 'expo-router';

export default function TransactionsLayout() {
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
          title: 'Transactions',
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: 'Transaction Details',
        }}
      />
    </Stack>
  );
}
