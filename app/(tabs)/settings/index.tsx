import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { COMPANY_INFO, LEGAL_VERSION } from '@/constants/legal';
import { biometricService, type BiometricCapabilities } from '@/services/auth/biometricService';
import { notificationService } from '@/services/notifications/notificationService';

const COLORS = {
  background: '#0D1B2A',
  surface: '#1B2838',
  surfaceLight: '#243447',
  text: '#FFFFFF',
  textSecondary: '#8892A0',
  primary: '#2ECC71',
  danger: '#E74C3C',
  border: '#243447',
};

interface SettingsSection {
  title: string;
  items: SettingsItem[];
}

interface SettingsItem {
  label: string;
  type: 'link' | 'toggle' | 'button' | 'info';
  value?: boolean | string;
  onPress?: () => void;
  onToggle?: (value: boolean) => void;
  accessibilityLabel?: string;
  destructive?: boolean;
}

export default function SettingsScreen() {
  const signOut = useAuthStore((state) => state.signOut);
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricCapabilities, setBiometricCapabilities] = useState<BiometricCapabilities | null>(null);
  const [iftaRemindersEnabled, setIftaRemindersEnabled] = useState(true);
  const [dailySummaryEnabled, setDailySummaryEnabled] = useState(true);

  // Load biometric settings on mount
  useEffect(() => {
    const loadBiometricSettings = async () => {
      const capabilities = await biometricService.checkCapabilities();
      setBiometricCapabilities(capabilities);

      if (capabilities.isAvailable) {
        const enabled = await biometricService.isEnabled();
        setBiometricEnabled(enabled);
      }
    };
    loadBiometricSettings();
  }, []);

  const handleBiometricToggle = async (value: boolean) => {
    if (value) {
      // Test biometric before enabling
      const result = await biometricService.authenticate('Confirm to enable biometric login');
      if (result.success) {
        await biometricService.setEnabled(true);
        setBiometricEnabled(true);
        Alert.alert('Enabled', `${biometricCapabilities?.biometricTypeName} login enabled.`);
      } else {
        Alert.alert('Failed', result.error || 'Could not enable biometric login.');
      }
    } else {
      await biometricService.setEnabled(false);
      setBiometricEnabled(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await signOut();
              router.replace('/(auth)/login');
            } catch (error) {
              Alert.alert('Error', 'Failed to sign out');
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone. All your data will be permanently deleted within 30 days.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            try {
              // Create deletion request
              const { error } = await supabase
                .from('data_deletion_requests')
                .insert({
                  user_id: user?.id,
                  reason: 'User requested account deletion',
                });

              if (error) throw error;

              Alert.alert(
                'Request Submitted',
                'Your account deletion request has been submitted. You will receive confirmation within 30 days.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      signOut();
                      router.replace('/(auth)/login');
                    },
                  },
                ],
              );
            } catch (error) {
              Alert.alert('Error', 'Failed to submit deletion request. Please contact support.');
            }
          },
        },
      ],
    );
  };

  const handleManageSubscription = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('https://apps.apple.com/account/subscriptions');
    } else {
      Linking.openURL('https://play.google.com/store/account/subscriptions');
    }
  };

  const handleContactSupport = () => {
    Linking.openURL(`mailto:${COMPANY_INFO.email}?subject=RoadLedger Support Request`);
  };

  const handleIftaRemindersToggle = async (value: boolean) => {
    setIftaRemindersEnabled(value);
    if (value) {
      await notificationService.scheduleIFTAReminders(7);
      Alert.alert('Enabled', 'IFTA quarterly deadline reminders enabled. You\'ll be notified 7 days before each deadline.');
    } else {
      await notificationService.cancelNotificationsByTag('ifta');
      Alert.alert('Disabled', 'IFTA reminders have been turned off.');
    }
  };

  const handleDailySummaryToggle = async (value: boolean) => {
    setDailySummaryEnabled(value);
    if (value) {
      await notificationService.scheduleDailySummary(20, 0);
      Alert.alert('Enabled', 'Daily profit summary notifications enabled at 8 PM.');
    } else {
      await notificationService.cancelNotificationsByTag('daily_summary');
      Alert.alert('Disabled', 'Daily summary notifications turned off.');
    }
  };

  const sections: SettingsSection[] = [
    {
      title: 'Account',
      items: [
        {
          label: 'Email',
          type: 'info',
          value: user?.email || 'Not signed in',
          accessibilityLabel: `Account email: ${user?.email}`,
        },
        {
          label: 'Manage Subscription',
          type: 'link',
          onPress: handleManageSubscription,
          accessibilityLabel: 'Manage your subscription in app store',
        },
        {
          label: 'Upgrade Plan',
          type: 'link',
          onPress: () => router.push('/(tabs)/subscription'),
          accessibilityLabel: 'View subscription plans',
        },
      ],
    },
    {
      title: 'Security',
      items: [
        ...(biometricCapabilities?.isAvailable
          ? [
              {
                label: `${biometricCapabilities.biometricTypeName} Login`,
                type: 'toggle' as const,
                value: biometricEnabled,
                onToggle: handleBiometricToggle,
                accessibilityLabel: `Toggle ${biometricCapabilities.biometricTypeName} login`,
              },
            ]
          : []),
        {
          label: 'Change Password',
          type: 'link' as const,
          onPress: () => {
            Alert.alert(
              'Change Password',
              'We will send a password reset link to your email.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Send Link',
                  onPress: async () => {
                    if (user?.email) {
                      const { error } = await supabase.auth.resetPasswordForEmail(user.email);
                      if (error) {
                        Alert.alert('Error', 'Failed to send reset email.');
                      } else {
                        Alert.alert('Sent', 'Check your email for the reset link.');
                      }
                    }
                  },
                },
              ]
            );
          },
          accessibilityLabel: 'Change your password',
        },
      ],
    },
    {
      title: 'Notifications',
      items: [
        {
          label: 'IFTA Deadline Reminders',
          type: 'toggle',
          value: iftaRemindersEnabled,
          onToggle: handleIftaRemindersToggle,
          accessibilityLabel: 'Toggle IFTA quarterly deadline reminders',
        },
        {
          label: 'Daily Profit Summary',
          type: 'toggle',
          value: dailySummaryEnabled,
          onToggle: handleDailySummaryToggle,
          accessibilityLabel: 'Toggle daily profit summary notifications',
        },
      ],
    },
    {
      title: 'Accessibility',
      items: [
        {
          label: 'Accessibility Settings',
          type: 'link',
          onPress: () => router.push('/(tabs)/settings/accessibility'),
          accessibilityLabel: 'Open accessibility settings',
        },
      ],
    },
    {
      title: 'Privacy & Data',
      items: [
        {
          label: 'Privacy Settings',
          type: 'link',
          onPress: () => router.push('/(tabs)/settings/privacy'),
          accessibilityLabel: 'Open privacy settings',
        },
        {
          label: 'Analytics',
          type: 'toggle',
          value: analyticsEnabled,
          onToggle: (value) => setAnalyticsEnabled(value),
          accessibilityLabel: 'Toggle anonymous analytics',
        },
        {
          label: 'Export My Data',
          type: 'link',
          onPress: () => router.push('/(tabs)/exports'),
          accessibilityLabel: 'Export your data',
        },
      ],
    },
    {
      title: 'Legal',
      items: [
        {
          label: 'Terms of Service',
          type: 'link',
          onPress: () => router.push('/(tabs)/settings/legal?doc=terms'),
          accessibilityLabel: 'Read terms of service',
        },
        {
          label: 'Privacy Policy',
          type: 'link',
          onPress: () => router.push('/(tabs)/settings/legal?doc=privacy'),
          accessibilityLabel: 'Read privacy policy',
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          label: 'Contact Support',
          type: 'link',
          onPress: handleContactSupport,
          accessibilityLabel: 'Email customer support',
        },
        {
          label: 'App Version',
          type: 'info',
          value: `1.0.0 (Legal v${LEGAL_VERSION})`,
          accessibilityLabel: 'App version 1.0.0',
        },
      ],
    },
    {
      title: 'Account Actions',
      items: [
        {
          label: 'Sign Out',
          type: 'button',
          onPress: handleSignOut,
          accessibilityLabel: 'Sign out of your account',
        },
        {
          label: 'Delete My Account',
          type: 'button',
          onPress: handleDeleteAccount,
          destructive: true,
          accessibilityLabel: 'Permanently delete your account and data',
        },
      ],
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      accessibilityLabel="Settings"
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title} accessibilityRole="header">
          Settings
        </Text>
      </View>

      {/* Sections */}
      {sections.map((section, sectionIndex) => (
        <View key={sectionIndex} style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            {section.title}
          </Text>
          <View style={styles.sectionContent}>
            {section.items.map((item, itemIndex) => (
              <TouchableOpacity
                key={itemIndex}
                style={[
                  styles.item,
                  itemIndex < section.items.length - 1 && styles.itemBorder,
                ]}
                onPress={item.type !== 'toggle' && item.type !== 'info' ? item.onPress : undefined}
                disabled={item.type === 'info' || item.type === 'toggle'}
                accessibilityLabel={item.accessibilityLabel || item.label}
                accessibilityRole={item.type === 'toggle' ? 'switch' : item.type === 'info' ? 'text' : 'button'}
              >
                <Text
                  style={[
                    styles.itemLabel,
                    item.destructive && styles.destructiveText,
                  ]}
                >
                  {item.label}
                </Text>
                {item.type === 'toggle' && (
                  <Switch
                    value={item.value as boolean}
                    onValueChange={item.onToggle}
                    trackColor={{ false: COLORS.surfaceLight, true: COLORS.primary }}
                    accessibilityLabel={item.accessibilityLabel}
                  />
                )}
                {item.type === 'info' && (
                  <Text style={styles.itemValue}>{item.value as string}</Text>
                )}
                {item.type === 'link' && (
                  <Text style={styles.chevron}>→</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingTop: 60,
    paddingBottom: 32,
  },
  header: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  backButton: {
    marginBottom: 16,
    minHeight: 44,
    justifyContent: 'center',
  },
  backButtonText: {
    color: COLORS.textSecondary,
    fontSize: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 48, // Accessibility: minimum touch target
  },
  itemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  itemLabel: {
    fontSize: 16,
    color: COLORS.text,
    flex: 1,
  },
  itemValue: {
    fontSize: 14,
    color: COLORS.textSecondary,
    maxWidth: '50%',
    textAlign: 'right',
  },
  chevron: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  destructiveText: {
    color: COLORS.danger,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
