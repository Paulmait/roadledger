import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { format, startOfQuarter, endOfQuarter, subQuarters } from 'date-fns';
import { router } from 'expo-router';
import { useUser, useProfile } from '@/stores/authStore';
import { getTotalMilesByJurisdiction, getUserTransactions } from '@/lib/database';
import { getJurisdictionName, getCurrentIFTAQuarter } from '@/constants';
import { canAccessFeature, type SubscriptionTier } from '@/constants/pricing';
import { supabase } from '@/lib/supabase/client';
import type { ExportType } from '@/types/database.types';

interface QuarterOption {
  label: string;
  value: string;
  startDate: string;
  endDate: string;
}

export default function ExportsScreen() {
  const user = useUser();
  const profile = useProfile();
  const [selectedQuarter, setSelectedQuarter] = useState<QuarterOption | null>(null);
  const [jurisdictionMiles, setJurisdictionMiles] = useState<
    { jurisdiction: string; total_miles: number }[]
  >([]);
  const [fuelExpenses, setFuelExpenses] = useState(0);
  const [totalMiles, setTotalMiles] = useState(0);
  const [exporting, setExporting] = useState<ExportType | null>(null);

  // Generate quarter options (current + last 3)
  const quarterOptions: QuarterOption[] = [];
  const now = new Date();
  for (let i = 0; i < 4; i++) {
    const quarterDate = subQuarters(now, i);
    const start = startOfQuarter(quarterDate);
    const end = endOfQuarter(quarterDate);
    const year = start.getFullYear();
    const quarter = Math.ceil((start.getMonth() + 1) / 3);

    quarterOptions.push({
      label: `Q${quarter} ${year}`,
      value: `${year}-Q${quarter}`,
      startDate: format(start, 'yyyy-MM-dd'),
      endDate: format(end, 'yyyy-MM-dd'),
    });
  }

  useEffect(() => {
    if (!selectedQuarter) {
      setSelectedQuarter(quarterOptions[0]);
    }
  }, []);

  useEffect(() => {
    loadQuarterData();
  }, [selectedQuarter, user?.id]);

  const loadQuarterData = async () => {
    if (!selectedQuarter || !user?.id) return;

    try {
      // Load jurisdiction miles
      const miles = await getTotalMilesByJurisdiction(
        user.id,
        selectedQuarter.startDate,
        selectedQuarter.endDate
      );
      setJurisdictionMiles(miles);
      setTotalMiles(miles.reduce((sum, m) => sum + m.total_miles, 0));

      // Load fuel expenses
      const transactions = await getUserTransactions(user.id, {
        startDate: selectedQuarter.startDate,
        endDate: selectedQuarter.endDate,
        category: 'fuel',
      });
      const totalFuel = transactions.reduce((sum, t) => sum + t.amount, 0);
      setFuelExpenses(totalFuel);
    } catch (error) {
      console.error('Failed to load quarter data:', error);
    }
  };

  const handleExport = async (type: ExportType) => {
    if (!selectedQuarter || !user?.id) return;

    // Check subscription tier for export features
    const tier = (profile?.subscription_tier || 'free') as SubscriptionTier;
    if (!canAccessFeature(tier, 'pro')) {
      Alert.alert(
        'Pro Feature',
        'IFTA and Tax reports require a Pro subscription. Upgrade to unlock exports.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Upgrade',
            onPress: () => router.push('/(tabs)/subscription'),
          },
        ]
      );
      return;
    }

    Alert.alert(
      `Generate ${type === 'ifta' ? 'IFTA' : 'Tax Pack'} Report`,
      `This will generate a ${type === 'ifta' ? 'IFTA quarterly' : 'tax'} report for ${selectedQuarter.label}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate',
          onPress: async () => {
            setExporting(type);

            try {
              // Get auth session
              const { data: sessionData } = await supabase.auth.getSession();
              const session = sessionData?.session;

              if (!session?.access_token) {
                Alert.alert('Error', 'You must be logged in to generate reports.');
                return;
              }

              // Determine which edge function to call
              const functionName = type === 'ifta' ? 'export-ifta' : 'export-tax-pack';

              const response = await fetch(
                `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/${functionName}`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                  },
                  body: JSON.stringify({
                    quarter: selectedQuarter.value,
                    start_date: selectedQuarter.startDate,
                    end_date: selectedQuarter.endDate,
                  }),
                }
              );

              if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('Export error:', errorData);
                Alert.alert(
                  'Export Failed',
                  errorData.error || 'Failed to generate report. Please try again.'
                );
                return;
              }

              const result = await response.json();

              if (result.download_url) {
                Alert.alert(
                  'Report Ready',
                  `Your ${type === 'ifta' ? 'IFTA' : 'Tax Pack'} report for ${selectedQuarter.label} is ready.`,
                  [
                    { text: 'Later', style: 'cancel' },
                    {
                      text: 'Download',
                      onPress: () => {
                        Linking.openURL(result.download_url);
                      },
                    },
                  ]
                );
              } else {
                Alert.alert(
                  'Report Generated',
                  `Your ${type === 'ifta' ? 'IFTA' : 'Tax Pack'} report for ${selectedQuarter.label} has been generated. Check your email or the exports tab for the download link.`
                );
              }
            } catch (error) {
              console.error('Export error:', error);
              Alert.alert('Error', 'Failed to generate report. Please try again.');
            } finally {
              setExporting(null);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Quarter Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Select Period</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.quarterScroll}
        >
          {quarterOptions.map((quarter) => (
            <TouchableOpacity
              key={quarter.value}
              style={[
                styles.quarterButton,
                selectedQuarter?.value === quarter.value &&
                  styles.quarterButtonActive,
              ]}
              onPress={() => setSelectedQuarter(quarter)}
            >
              <Text
                style={[
                  styles.quarterButtonText,
                  selectedQuarter?.value === quarter.value &&
                    styles.quarterButtonTextActive,
                ]}
              >
                {quarter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* IFTA Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>IFTA Summary</Text>

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Miles</Text>
            <Text style={styles.summaryValue}>
              {totalMiles.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Fuel Purchases</Text>
            <Text style={styles.summaryValue}>${fuelExpenses.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>States Traveled</Text>
            <Text style={styles.summaryValue}>{jurisdictionMiles.length}</Text>
          </View>
        </View>
      </View>

      {/* Miles by State */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Miles by State</Text>

        {jurisdictionMiles.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              No mileage data for this period
            </Text>
          </View>
        ) : (
          jurisdictionMiles.map((jm) => (
            <View key={jm.jurisdiction} style={styles.jurisdictionRow}>
              <View>
                <Text style={styles.jurisdictionCode}>{jm.jurisdiction}</Text>
                <Text style={styles.jurisdictionName}>
                  {getJurisdictionName(jm.jurisdiction)}
                </Text>
              </View>
              <Text style={styles.jurisdictionMiles}>
                {jm.total_miles.toFixed(1)} mi
              </Text>
            </View>
          ))
        )}
      </View>

      {/* Export Options */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Generate Reports</Text>

        <TouchableOpacity
          style={[styles.exportButton, exporting === 'ifta' && styles.buttonDisabled]}
          onPress={() => handleExport('ifta')}
          disabled={exporting !== null}
        >
          <View style={styles.exportIcon}>
            {exporting === 'ifta' ? (
              <ActivityIndicator color="#4f46e5" />
            ) : (
              <Text style={styles.exportIconText}>📊</Text>
            )}
          </View>
          <View style={styles.exportInfo}>
            <Text style={styles.exportTitle}>IFTA Quarterly Report</Text>
            <Text style={styles.exportDescription}>
              Miles by jurisdiction + fuel purchases for IFTA filing
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.exportButton, exporting === 'tax_pack' && styles.buttonDisabled]}
          onPress={() => handleExport('tax_pack')}
          disabled={exporting !== null}
        >
          <View style={styles.exportIcon}>
            {exporting === 'tax_pack' ? (
              <ActivityIndicator color="#4f46e5" />
            ) : (
              <Text style={styles.exportIconText}>📁</Text>
            )}
          </View>
          <View style={styles.exportInfo}>
            <Text style={styles.exportTitle}>Tax Pack</Text>
            <Text style={styles.exportDescription}>
              Income/expense summary + receipt bundle for tax filing
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Help Text */}
      <View style={styles.helpSection}>
        <Text style={styles.helpTitle}>About IFTA Reporting</Text>
        <Text style={styles.helpText}>
          The International Fuel Tax Agreement (IFTA) requires quarterly
          reporting of miles traveled and fuel purchased in each jurisdiction.
          RoadLedger automatically tracks your miles by state using GPS and
          organizes your fuel receipts for easy reporting.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  quarterScroll: {
    flexDirection: 'row',
  },
  quarterButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#2d2d44',
    marginRight: 12,
  },
  quarterButtonActive: {
    backgroundColor: '#4f46e5',
  },
  quarterButtonText: {
    color: '#888',
    fontSize: 16,
    fontWeight: '500',
  },
  quarterButtonTextActive: {
    color: '#fff',
  },
  summaryCard: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#3d3d5c',
  },
  summaryLabel: {
    color: '#888',
    fontSize: 14,
  },
  summaryValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  emptyState: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: '#888',
    fontSize: 14,
  },
  jurisdictionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2d2d44',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
  },
  jurisdictionCode: {
    color: '#4f46e5',
    fontSize: 16,
    fontWeight: '600',
  },
  jurisdictionName: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  jurisdictionMiles: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  exportIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#3d3d5c',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  exportIconText: {
    fontSize: 24,
  },
  exportInfo: {
    flex: 1,
  },
  exportTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  exportDescription: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  helpSection: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  helpTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  helpText: {
    color: '#888',
    fontSize: 12,
    lineHeight: 18,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
