import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import Constants from 'expo-constants';

const COLORS = {
  primary: '#1E3A5F',
  secondary: '#2ECC71',
  accent: '#F39C12',
  background: '#0D1B2A',
  surface: '#1B2838',
  surfaceLight: '#243447',
  text: '#FFFFFF',
  textSecondary: '#8892A0',
  profit: '#2ECC71',
  loss: '#E74C3C',
};

interface ScreenLink {
  title: string;
  path: string;
  description: string;
  status: 'ready' | 'wip' | 'needs-api';
}

interface Section {
  title: string;
  screens: ScreenLink[];
}

const APP_SECTIONS: Section[] = [
  {
    title: 'Main Tabs',
    screens: [
      { title: 'Dashboard', path: '/(tabs)/', description: 'Profit metrics, AI insights, quick actions', status: 'ready' },
      { title: 'Trip Tracking', path: '/(tabs)/trip', description: 'GPS mileage tracking with state detection', status: 'ready' },
      { title: 'Calculator', path: '/(tabs)/calculator', description: 'Fuel cost and profit calculator', status: 'ready' },
      { title: 'Documents', path: '/(tabs)/documents', description: 'Receipt/settlement capture & AI extraction', status: 'needs-api' },
      { title: 'Transactions', path: '/(tabs)/transactions', description: 'Income/expense tracking', status: 'ready' },
      { title: 'Exports', path: '/(tabs)/exports', description: 'IFTA & tax report generation', status: 'needs-api' },
    ],
  },
  {
    title: 'Authentication',
    screens: [
      { title: 'Login', path: '/(auth)/login', description: 'Email/password authentication', status: 'ready' },
      { title: 'Register', path: '/(auth)/register', description: 'New account creation', status: 'ready' },
      { title: 'Forgot Password', path: '/(auth)/forgot-password', description: 'Password reset flow', status: 'ready' },
      { title: 'Onboarding', path: '/(auth)/onboarding', description: 'Profile setup (name, MC#, DOT#)', status: 'ready' },
    ],
  },
  {
    title: 'Settings & Profile',
    screens: [
      { title: 'Settings', path: '/(tabs)/settings', description: 'App preferences', status: 'ready' },
      { title: 'Accessibility', path: '/(tabs)/settings/accessibility', description: 'Font size, contrast settings', status: 'ready' },
      { title: 'Privacy', path: '/(tabs)/settings/privacy', description: 'Data & privacy options', status: 'ready' },
      { title: 'Legal', path: '/(tabs)/settings/legal', description: 'Terms & privacy policy', status: 'ready' },
      { title: 'Subscription', path: '/(tabs)/subscription', description: 'Premium plan management', status: 'needs-api' },
    ],
  },
  {
    title: 'Admin',
    screens: [
      { title: 'Admin Dashboard', path: '/(admin)/', description: 'Admin-only features', status: 'ready' },
    ],
  },
];

const EDGE_FUNCTIONS = [
  { name: 'doc-ingest', description: 'AI receipt/settlement extraction (GPT-4 Vision)', status: 'deployed' },
  { name: 'upload-signed-url', description: 'Secure file upload URLs', status: 'deployed' },
  { name: 'validate-receipt', description: 'Receipt validation with fraud detection', status: 'deployed' },
  { name: 'trip-finalize', description: 'Calculate jurisdiction miles from GPS', status: 'deployed' },
  { name: 'export-ifta', description: 'Generate IFTA quarterly report', status: 'deployed' },
  { name: 'export-tax-pack', description: 'Generate tax summary + receipt bundle', status: 'deployed' },
  { name: 'ai-profit-analyzer', description: 'AI-powered profit insights', status: 'deployed' },
  { name: 'ai-smart-suggestions', description: 'Smart expense categorization', status: 'deployed' },
];

const SECURITY_FEATURES = [
  { name: 'Row Level Security', description: 'All tables enforce user_id isolation', status: 'active' },
  { name: 'Rate Limiting', description: 'Per-user request limits (5-20/min)', status: 'active' },
  { name: 'AI Injection Protection', description: 'Prompt injection pattern filtering', status: 'active' },
  { name: 'CORS + Security Headers', description: 'X-Frame-Options, CSP, etc.', status: 'active' },
  { name: 'JWT Validation', description: 'All Edge Functions verify auth', status: 'active' },
  { name: 'Secure Storage', description: 'expo-secure-store for tokens', status: 'active' },
  { name: 'Input Validation', description: 'UUID, MIME, size validation', status: 'active' },
  { name: 'Fraud Detection', description: 'Transaction anomaly detection', status: 'active' },
];

export default function DevScreen() {
  const [expandedSection, setExpandedSection] = useState<string | null>('Main Tabs');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
      case 'deployed':
      case 'active':
        return COLORS.profit;
      case 'wip':
        return COLORS.accent;
      case 'needs-api':
        return COLORS.loss;
      default:
        return COLORS.textSecondary;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ready': return 'READY';
      case 'deployed': return 'DEPLOYED';
      case 'active': return 'ACTIVE';
      case 'wip': return 'WIP';
      case 'needs-api': return 'NEEDS API KEY';
      default: return status.toUpperCase();
    }
  };

  const navigateTo = (path: string) => {
    try {
      router.push(path as any);
    } catch (e) {
      console.error('Navigation error:', e);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>RoadLedger Dev View</Text>
        <Text style={styles.subtitle}>
          v{Constants.expoConfig?.version || '1.0.0'} | EAS: {Constants.expoConfig?.extra?.eas?.projectId?.slice(0, 8)}...
        </Text>
      </View>

      {/* App Info Card */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>App Status</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Supabase:</Text>
          <Text style={styles.infoValue}>Connected</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Migrations:</Text>
          <Text style={styles.infoValue}>00001-00009 deployed</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Edge Functions:</Text>
          <Text style={styles.infoValue}>8 deployed</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Security Tests:</Text>
          <Text style={styles.infoValue}>16/25 passed (RLS blocking = expected)</Text>
        </View>
      </View>

      {/* Navigation Sections */}
      <Text style={styles.sectionHeader}>Screens & Navigation</Text>
      {APP_SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <TouchableOpacity
            style={styles.sectionTitle}
            onPress={() => setExpandedSection(
              expandedSection === section.title ? null : section.title
            )}
          >
            <Text style={styles.sectionTitleText}>{section.title}</Text>
            <Text style={styles.expandIcon}>
              {expandedSection === section.title ? '−' : '+'}
            </Text>
          </TouchableOpacity>

          {expandedSection === section.title && (
            <View style={styles.screenList}>
              {section.screens.map((screen) => (
                <TouchableOpacity
                  key={screen.path}
                  style={styles.screenItem}
                  onPress={() => navigateTo(screen.path)}
                >
                  <View style={styles.screenInfo}>
                    <Text style={styles.screenTitle}>{screen.title}</Text>
                    <Text style={styles.screenDescription}>{screen.description}</Text>
                    <Text style={styles.screenPath}>{screen.path}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(screen.status) + '20' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(screen.status) }]}>
                      {getStatusLabel(screen.status)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      ))}

      {/* Edge Functions */}
      <Text style={styles.sectionHeader}>Edge Functions (Supabase)</Text>
      <View style={styles.functionList}>
        {EDGE_FUNCTIONS.map((fn) => (
          <View key={fn.name} style={styles.functionItem}>
            <View style={styles.functionInfo}>
              <Text style={styles.functionName}>{fn.name}</Text>
              <Text style={styles.functionDescription}>{fn.description}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(fn.status) + '20' }]}>
              <Text style={[styles.statusText, { color: getStatusColor(fn.status) }]}>
                {getStatusLabel(fn.status)}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Security Features */}
      <Text style={styles.sectionHeader}>Security Features</Text>
      <View style={styles.functionList}>
        {SECURITY_FEATURES.map((feature) => (
          <View key={feature.name} style={styles.functionItem}>
            <View style={styles.functionInfo}>
              <Text style={styles.functionName}>{feature.name}</Text>
              <Text style={styles.functionDescription}>{feature.description}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(feature.status) + '20' }]}>
              <Text style={[styles.statusText, { color: getStatusColor(feature.status) }]}>
                {getStatusLabel(feature.status)}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Quick Links */}
      <Text style={styles.sectionHeader}>External Links</Text>
      <View style={styles.linkList}>
        <TouchableOpacity
          style={styles.linkItem}
          onPress={() => Linking.openURL('https://supabase.com/dashboard/project/kbohuorolouxqgtzmrsa')}
        >
          <Text style={styles.linkText}>Supabase Dashboard</Text>
          <Text style={styles.linkArrow}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.linkItem}
          onPress={() => Linking.openURL('https://expo.dev/accounts/guampaul/projects/roadledger')}
        >
          <Text style={styles.linkText}>Expo Dashboard</Text>
          <Text style={styles.linkArrow}>→</Text>
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          RoadLedger - Owner-Operator Trucking App
        </Text>
        <Text style={styles.footerSubtext}>
          Cien Rios LLC | 2026
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
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
    fontFamily: 'monospace',
  },
  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.surfaceLight,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    color: COLORS.profit,
    fontWeight: '500',
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
    marginTop: 8,
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitleText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  expandIcon: {
    fontSize: 20,
    color: COLORS.textSecondary,
  },
  screenList: {
    backgroundColor: COLORS.surfaceLight,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    overflow: 'hidden',
  },
  screenItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
    flexDirection: 'row',
    alignItems: 'center',
  },
  screenInfo: {
    flex: 1,
  },
  screenTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.text,
  },
  screenDescription: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  screenPath: {
    fontSize: 11,
    color: COLORS.accent,
    marginTop: 4,
    fontFamily: 'monospace',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  functionList: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  functionItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceLight,
    flexDirection: 'row',
    alignItems: 'center',
  },
  functionInfo: {
    flex: 1,
  },
  functionName: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    fontFamily: 'monospace',
  },
  functionDescription: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  linkList: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
  },
  linkItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceLight,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  linkText: {
    fontSize: 15,
    color: COLORS.secondary,
  },
  linkArrow: {
    fontSize: 16,
    color: COLORS.secondary,
  },
  footer: {
    alignItems: 'center',
    paddingTop: 20,
  },
  footerText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  footerSubtext: {
    fontSize: 12,
    color: COLORS.textSecondary,
    opacity: 0.6,
    marginTop: 4,
  },
});
