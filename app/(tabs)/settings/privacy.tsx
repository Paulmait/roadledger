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
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { CONSENT_TYPES, LEGAL_VERSION, COMPANY_INFO } from '@/constants/legal';

const COLORS = {
  background: '#0D1B2A',
  surface: '#1B2838',
  text: '#FFFFFF',
  textSecondary: '#8892A0',
  primary: '#2ECC71',
  danger: '#E74C3C',
  warning: '#F39C12',
  border: '#243447',
};

interface ConsentStatus {
  type: string;
  consented: boolean;
  version: string;
  date: string;
}

export default function PrivacyScreen() {
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const [loading, setLoading] = useState(true);
  const [consents, setConsents] = useState<ConsentStatus[]>([]);
  const [locationTracking, setLocationTracking] = useState(true);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(false);
  const [deletionRequested, setDeletionRequested] = useState(false);

  useEffect(() => {
    loadConsents();
    checkDeletionStatus();
  }, []);

  const loadConsents = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      const { data } = await supabase
        .from('user_consents')
        .select('*')
        .eq('user_id', user.id);

      if (data) {
        setConsents(
          data.map((c) => ({
            type: c.consent_type,
            consented: c.consented,
            version: c.version,
            date: c.consented_at,
          }))
        );

        // Set individual toggles
        const locationConsent = data.find((c) => c.consent_type === CONSENT_TYPES.LOCATION_TRACKING);
        const analyticsConsent = data.find((c) => c.consent_type === CONSENT_TYPES.ANALYTICS);
        const marketingConsent = data.find((c) => c.consent_type === CONSENT_TYPES.MARKETING);

        if (locationConsent) setLocationTracking(locationConsent.consented);
        if (analyticsConsent) setAnalytics(analyticsConsent.consented);
        if (marketingConsent) setMarketing(marketingConsent.consented);
      }
    } catch (error) {
      console.error('Failed to load consents:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkDeletionStatus = async () => {
    if (!user?.id) return;

    try {
      const { data } = await supabase
        .from('data_deletion_requests')
        .select('status')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .single();

      setDeletionRequested(!!data);
    } catch (error) {
      // No pending request
    }
  };

  const updateConsent = async (type: string, consented: boolean) => {
    if (!user?.id) return;

    try {
      await supabase.from('user_consents').upsert({
        user_id: user.id,
        consent_type: type,
        version: LEGAL_VERSION,
        consented,
        consented_at: new Date().toISOString(),
      });

      // Update local state
      switch (type) {
        case CONSENT_TYPES.LOCATION_TRACKING:
          setLocationTracking(consented);
          break;
        case CONSENT_TYPES.ANALYTICS:
          setAnalytics(consented);
          break;
        case CONSENT_TYPES.MARKETING:
          setMarketing(consented);
          break;
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update preference');
    }
  };

  const handleExportData = async () => {
    Alert.alert(
      'Export Your Data',
      'We will prepare a complete export of your data. This may take a few minutes. You will be notified when it is ready for download.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Export',
          onPress: async () => {
            try {
              // Record export request in analytics
              await supabase.from('analytics_events').insert({
                user_id: user?.id,
                event_type: 'data_export_requested',
                event_data: { format: 'json' },
              });

              Alert.alert(
                'Export Requested',
                'Your data export has been requested. You will be notified when it is ready.',
              );
            } catch (error) {
              Alert.alert('Error', 'Failed to request data export');
            }
          },
        },
      ],
    );
  };

  const handleDeleteData = () => {
    Alert.alert(
      'Delete My Data',
      'This will permanently delete your account and all associated data. This action cannot be undone.\n\nYou will receive confirmation within 30 days as required by law.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('data_deletion_requests')
                .insert({
                  user_id: user?.id,
                  reason: 'User requested deletion from privacy settings',
                });

              if (error) throw error;

              setDeletionRequested(true);
              Alert.alert(
                'Deletion Requested',
                'Your data deletion request has been submitted. Your account will be deleted within 30 days. You will receive confirmation by email.',
                [
                  {
                    text: 'Sign Out',
                    onPress: () => {
                      signOut();
                      router.replace('/(auth)/login');
                    },
                  },
                ],
              );
            } catch (error) {
              Alert.alert('Error', 'Failed to submit deletion request');
            }
          },
        },
      ],
    );
  };

  const handleCancelDeletion = async () => {
    try {
      await supabase
        .from('data_deletion_requests')
        .update({ status: 'cancelled' })
        .eq('user_id', user?.id)
        .eq('status', 'pending');

      setDeletionRequested(false);
      Alert.alert('Cancelled', 'Your deletion request has been cancelled.');
    } catch (error) {
      Alert.alert('Error', 'Failed to cancel deletion request');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      accessibilityLabel="Privacy Settings"
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
          Privacy & Data
        </Text>
        <Text style={styles.subtitle}>
          Control how your data is used and manage your privacy
        </Text>
      </View>

      {/* Deletion Warning */}
      {deletionRequested && (
        <View style={styles.warningBox} accessibilityRole="alert">
          <Text style={styles.warningTitle}>Deletion Pending</Text>
          <Text style={styles.warningText}>
            Your account deletion is pending. It will be processed within 30 days.
          </Text>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancelDeletion}
            accessibilityLabel="Cancel deletion request"
          >
            <Text style={styles.cancelButtonText}>Cancel Deletion</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Data Collection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Data Collection
        </Text>
        <View style={styles.sectionContent}>
          <View style={styles.item}>
            <View style={styles.itemContent}>
              <Text style={styles.itemLabel}>Location Tracking</Text>
              <Text style={styles.itemDescription}>
                Allow GPS tracking for automatic mileage logging
              </Text>
            </View>
            <Switch
              value={locationTracking}
              onValueChange={(value) =>
                updateConsent(CONSENT_TYPES.LOCATION_TRACKING, value)
              }
              accessibilityLabel="Location tracking consent"
            />
          </View>

          <View style={[styles.item, styles.itemBorder]}>
            <View style={styles.itemContent}>
              <Text style={styles.itemLabel}>Analytics</Text>
              <Text style={styles.itemDescription}>
                Help improve the app with anonymous usage data
              </Text>
            </View>
            <Switch
              value={analytics}
              onValueChange={(value) =>
                updateConsent(CONSENT_TYPES.ANALYTICS, value)
              }
              accessibilityLabel="Analytics consent"
            />
          </View>

          <View style={[styles.item, styles.itemBorder]}>
            <View style={styles.itemContent}>
              <Text style={styles.itemLabel}>Marketing Communications</Text>
              <Text style={styles.itemDescription}>
                Receive tips, updates, and promotional offers
              </Text>
            </View>
            <Switch
              value={marketing}
              onValueChange={(value) =>
                updateConsent(CONSENT_TYPES.MARKETING, value)
              }
              accessibilityLabel="Marketing consent"
            />
          </View>
        </View>
      </View>

      {/* Your Rights */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Your Rights
        </Text>
        <View style={styles.sectionContent}>
          <TouchableOpacity
            style={styles.actionItem}
            onPress={handleExportData}
            accessibilityLabel="Export your data"
            accessibilityRole="button"
          >
            <View style={styles.itemContent}>
              <Text style={styles.itemLabel}>Export My Data</Text>
              <Text style={styles.itemDescription}>
                Download a copy of all your data (GDPR/CCPA)
              </Text>
            </View>
            <Text style={styles.chevron}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionItem, styles.itemBorder]}
            onPress={() => router.push('/(tabs)/settings/legal?doc=privacy')}
            accessibilityLabel="Read privacy policy"
            accessibilityRole="button"
          >
            <View style={styles.itemContent}>
              <Text style={styles.itemLabel}>Privacy Policy</Text>
              <Text style={styles.itemDescription}>
                Read our full privacy policy
              </Text>
            </View>
            <Text style={styles.chevron}>→</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Danger Zone */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, styles.dangerTitle]} accessibilityRole="header">
          Danger Zone
        </Text>
        <View style={styles.dangerContent}>
          <Text style={styles.dangerText}>
            Permanently delete your account and all associated data. This action
            cannot be undone.
          </Text>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeleteData}
            disabled={deletionRequested}
            accessibilityLabel="Delete all my data"
            accessibilityRole="button"
          >
            <Text style={styles.deleteButtonText}>
              {deletionRequested ? 'Deletion Pending' : 'Delete My Data'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Contact */}
      <View style={styles.contact}>
        <Text style={styles.contactTitle}>Data Protection Contact</Text>
        <Text style={styles.contactText}>
          For privacy inquiries: privacy@cienrios.com
        </Text>
        <Text style={styles.contactText}>
          {COMPANY_INFO.name}
        </Text>
        <Text style={styles.contactText}>
          {COMPANY_INFO.address}, {COMPANY_INFO.city}, {COMPANY_INFO.state} {COMPANY_INFO.zip}
        </Text>
      </View>
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
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  warningBox: {
    backgroundColor: COLORS.warning,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.background,
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: COLORS.background,
    marginBottom: 12,
  },
  cancelButton: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: COLORS.warning,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
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
    minHeight: 60,
  },
  itemBorder: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  itemContent: {
    flex: 1,
    marginRight: 16,
  },
  itemLabel: {
    fontSize: 16,
    color: COLORS.text,
  },
  itemDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 60,
  },
  chevron: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  dangerTitle: {
    color: COLORS.danger,
  },
  dangerContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  dangerText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  deleteButton: {
    backgroundColor: COLORS.danger,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    minHeight: 48,
  },
  deleteButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  contact: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  contactTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  contactText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
});
