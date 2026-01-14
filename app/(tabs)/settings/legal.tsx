import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  AccessibilityInfo,
  useColorScheme,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  TERMS_OF_SERVICE,
  PRIVACY_POLICY,
  LEGAL_VERSION,
  COMPANY_INFO,
} from '@/constants/legal';

const COLORS = {
  background: '#0D1B2A',
  surface: '#1B2838',
  text: '#FFFFFF',
  textSecondary: '#8892A0',
  primary: '#2ECC71',
  border: '#243447',
};

export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>(
    doc === 'privacy' ? 'privacy' : 'terms'
  );

  const content = activeTab === 'terms' ? TERMS_OF_SERVICE : PRIVACY_POLICY;

  return (
    <View style={styles.container}>
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
          Legal Documents
        </Text>
        <Text style={styles.version}>Version {LEGAL_VERSION}</Text>
      </View>

      {/* Tab Switcher */}
      <View
        style={styles.tabContainer}
        accessibilityRole="tablist"
      >
        <TouchableOpacity
          style={[styles.tab, activeTab === 'terms' && styles.activeTab]}
          onPress={() => setActiveTab('terms')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'terms' }}
          accessibilityLabel="Terms of Service"
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'terms' && styles.activeTabText,
            ]}
          >
            Terms of Service
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'privacy' && styles.activeTab]}
          onPress={() => setActiveTab('privacy')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'privacy' }}
          accessibilityLabel="Privacy Policy"
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'privacy' && styles.activeTabText,
            ]}
          >
            Privacy Policy
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.contentContainer}
        contentContainerStyle={styles.contentInner}
        accessibilityLabel={`${activeTab === 'terms' ? 'Terms of Service' : 'Privacy Policy'} document`}
      >
        <Text
          style={styles.legalText}
          selectable
          accessibilityRole="text"
        >
          {content}
        </Text>
      </ScrollView>

      {/* Company Info Footer */}
      <View style={styles.footer} accessibilityLabel="Company contact information">
        <Text style={styles.footerText}>{COMPANY_INFO.name}</Text>
        <Text style={styles.footerText}>{COMPANY_INFO.address}</Text>
        <Text style={styles.footerText}>
          {COMPANY_INFO.city}, {COMPANY_INFO.state} {COMPANY_INFO.zip}
        </Text>
        <Text style={styles.footerText}>{COMPANY_INFO.email}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    marginBottom: 16,
    minHeight: 44, // Accessibility: minimum touch target
    justifyContent: 'center',
  },
  backButtonText: {
    color: COLORS.textSecondary,
    fontSize: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  version: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    minHeight: 44, // Accessibility: minimum touch target
  },
  activeTab: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  activeTabText: {
    color: COLORS.background,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  contentInner: {
    paddingBottom: 24,
  },
  legalText: {
    fontSize: 14,
    lineHeight: 22,
    color: COLORS.text,
    fontFamily: 'System',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
});
