import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { loadCalculator, type LoadProfitability } from '@/services/load/loadCalculator';

const COLORS = {
  background: '#0D1B2A',
  surface: '#1B2838',
  surfaceLight: '#243447',
  text: '#FFFFFF',
  textSecondary: '#8892A0',
  primary: '#2ECC71',
  secondary: '#3498DB',
  warning: '#F39C12',
  danger: '#E74C3C',
  border: '#243447',
};

const VERDICT_COLORS = {
  excellent: COLORS.primary,
  good: COLORS.secondary,
  marginal: COLORS.warning,
  bad: COLORS.danger,
  loss: COLORS.danger,
};

export default function LoadCalculatorScreen() {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [loadedMiles, setLoadedMiles] = useState('');
  const [deadheadMiles, setDeadheadMiles] = useState('');
  const [rate, setRate] = useState('');
  const [fuelSurcharge, setFuelSurcharge] = useState('');
  const [result, setResult] = useState<LoadProfitability | null>(null);

  const handleCalculate = () => {
    if (!loadedMiles || !rate) return;

    const loadResult = loadCalculator.calculate({
      origin: origin || 'Origin',
      originState: '',
      destination: destination || 'Destination',
      destinationState: '',
      loadedMiles: parseFloat(loadedMiles) || 0,
      deadheadMilesToPickup: parseFloat(deadheadMiles) || 0,
      rate: parseFloat(rate) || 0,
      fuelSurcharge: parseFloat(fuelSurcharge) || 0,
    });

    setResult(loadResult);
  };

  const handleClear = () => {
    setOrigin('');
    setDestination('');
    setLoadedMiles('');
    setDeadheadMiles('');
    setRate('');
    setFuelSurcharge('');
    setResult(null);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityLabel="Go back"
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Load Calculator</Text>
          <Text style={styles.subtitle}>
            Know if a load is worth it BEFORE you accept
          </Text>
        </View>

        {/* Input Form */}
        <View style={styles.form}>
          <View style={styles.row}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Origin</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Atlanta, GA"
                placeholderTextColor={COLORS.textSecondary}
                value={origin}
                onChangeText={setOrigin}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Destination</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Dallas, TX"
                placeholderTextColor={COLORS.textSecondary}
                value={destination}
                onChangeText={setDestination}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Loaded Miles *</Text>
              <TextInput
                style={styles.input}
                placeholder="800"
                placeholderTextColor={COLORS.textSecondary}
                value={loadedMiles}
                onChangeText={setLoadedMiles}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Deadhead Miles</Text>
              <TextInput
                style={styles.input}
                placeholder="50"
                placeholderTextColor={COLORS.textSecondary}
                value={deadheadMiles}
                onChangeText={setDeadheadMiles}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Rate ($) *</Text>
              <TextInput
                style={styles.input}
                placeholder="2000"
                placeholderTextColor={COLORS.textSecondary}
                value={rate}
                onChangeText={setRate}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Fuel Surcharge ($)</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor={COLORS.textSecondary}
                value={fuelSurcharge}
                onChangeText={setFuelSurcharge}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.clearButton}
              onPress={handleClear}
            >
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.calculateButton,
                (!loadedMiles || !rate) && styles.buttonDisabled,
              ]}
              onPress={handleCalculate}
              disabled={!loadedMiles || !rate}
            >
              <Text style={styles.calculateButtonText}>Calculate</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Results */}
        {result && (
          <View style={styles.results}>
            {/* Verdict Card */}
            <View
              style={[
                styles.verdictCard,
                { borderColor: VERDICT_COLORS[result.verdict] },
              ]}
            >
              <Text
                style={[
                  styles.verdictLabel,
                  { color: VERDICT_COLORS[result.verdict] },
                ]}
              >
                {result.verdict.toUpperCase()}
              </Text>
              <Text style={styles.verdictReason}>{result.verdictReason}</Text>
              <Text style={styles.recommendation}>{result.recommendation}</Text>
            </View>

            {/* Key Metrics */}
            <View style={styles.metricsGrid}>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>
                  ${result.netProfit.toFixed(0)}
                </Text>
                <Text style={styles.metricLabel}>Net Profit</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>
                  ${result.profitPerMile.toFixed(2)}
                </Text>
                <Text style={styles.metricLabel}>Profit/Mile</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>
                  ${result.ratePerAllMiles.toFixed(2)}
                </Text>
                <Text style={styles.metricLabel}>Rate/Mile</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>
                  {result.profitMargin.toFixed(0)}%
                </Text>
                <Text style={styles.metricLabel}>Margin</Text>
              </View>
            </View>

            {/* Comparison */}
            <View style={styles.comparisonCard}>
              <Text style={styles.comparisonTitle}>vs. Industry Average</Text>
              <Text
                style={[
                  styles.comparisonValue,
                  {
                    color:
                      result.percentVsAverage >= 0
                        ? COLORS.primary
                        : COLORS.danger,
                  },
                ]}
              >
                {result.percentVsAverage >= 0 ? '+' : ''}
                {result.percentVsAverage}%
              </Text>
              <Text style={styles.comparisonSubtext}>
                Industry avg: ${result.industryAvgRPM.toFixed(2)}/mile
              </Text>
            </View>

            {/* Cost Breakdown */}
            <View style={styles.breakdownCard}>
              <Text style={styles.breakdownTitle}>Cost Breakdown</Text>
              {result.breakdown.map((item, index) => (
                <View key={index} style={styles.breakdownRow}>
                  <Text style={styles.breakdownCategory}>{item.category}</Text>
                  <View style={styles.breakdownValues}>
                    <Text style={styles.breakdownAmount}>
                      ${item.amount.toFixed(2)}
                    </Text>
                    <Text style={styles.breakdownPerMile}>
                      ${item.perMile.toFixed(2)}/mi
                    </Text>
                  </View>
                </View>
              ))}
              <View style={[styles.breakdownRow, styles.totalRow]}>
                <Text style={styles.breakdownTotal}>Total Costs</Text>
                <Text style={styles.breakdownTotalValue}>
                  ${result.totalCosts.toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Revenue Summary */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Revenue</Text>
                <Text style={styles.summaryValue}>
                  ${result.totalRevenue.toFixed(2)}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Costs</Text>
                <Text style={[styles.summaryValue, { color: COLORS.danger }]}>
                  -${result.totalCosts.toFixed(2)}
                </Text>
              </View>
              <View style={[styles.summaryRow, styles.summaryTotal]}>
                <Text style={styles.summaryTotalLabel}>Net Profit</Text>
                <Text
                  style={[
                    styles.summaryTotalValue,
                    {
                      color:
                        result.netProfit >= 0 ? COLORS.primary : COLORS.danger,
                    },
                  ]}
                >
                  ${result.netProfit.toFixed(2)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Tips */}
        {!result && (
          <View style={styles.tips}>
            <Text style={styles.tipsTitle}>Pro Tips</Text>
            <Text style={styles.tip}>
              • Always include deadhead miles - they cost money too
            </Text>
            <Text style={styles.tip}>
              • Don't forget fuel surcharge - it adds up
            </Text>
            <Text style={styles.tip}>
              • Aim for at least $2.00/mile (all miles) to be profitable
            </Text>
            <Text style={styles.tip}>
              • Factor in detention time for shipper/receiver delays
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 16,
    paddingTop: 60,
    paddingBottom: 32,
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
  form: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  inputGroup: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: COLORS.text,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  clearButton: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  clearButtonText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  calculateButton: {
    flex: 2,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  calculateButtonText: {
    color: COLORS.background,
    fontSize: 16,
    fontWeight: '600',
  },
  results: {
    gap: 16,
  },
  verdictCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    alignItems: 'center',
  },
  verdictLabel: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  verdictReason: {
    fontSize: 16,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  recommendation: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  comparisonCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  comparisonTitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  comparisonValue: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  comparisonSubtext: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  breakdownCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
  },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  breakdownCategory: {
    fontSize: 14,
    color: COLORS.text,
  },
  breakdownValues: {
    flexDirection: 'row',
    gap: 16,
  },
  breakdownAmount: {
    fontSize: 14,
    color: COLORS.text,
    width: 70,
    textAlign: 'right',
  },
  breakdownPerMile: {
    fontSize: 12,
    color: COLORS.textSecondary,
    width: 60,
    textAlign: 'right',
  },
  totalRow: {
    borderBottomWidth: 0,
    marginTop: 8,
  },
  breakdownTotal: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  breakdownTotalValue: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.danger,
  },
  summaryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: COLORS.text,
  },
  summaryValue: {
    fontSize: 14,
    color: COLORS.text,
  },
  summaryTotal: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 8,
    paddingTop: 16,
  },
  summaryTotalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  summaryTotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  tips: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  tip: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
    lineHeight: 20,
  },
});
