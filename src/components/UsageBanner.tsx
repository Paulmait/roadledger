// Usage Banner Component - Shows remaining usage with upgrade CTA
// Displays on Dashboard for free tier users

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { router } from 'expo-router';
import { useUsageLimits } from '@/hooks/useUsageLimits';

const COLORS = {
  background: '#0D1B2A',
  surface: '#1B2838',
  surfaceLight: '#243447',
  text: '#FFFFFF',
  textSecondary: '#8892A0',
  secondary: '#2ECC71',
  accent: '#F39C12',
  warning: '#E67E22',
  danger: '#E74C3C',
};

interface ProgressBarProps {
  progress: number; // 0-100
  color: string;
}

function ProgressBar({ progress, color }: ProgressBarProps) {
  return (
    <View style={styles.progressBarContainer}>
      <View style={[styles.progressBarFill, { width: `${Math.min(100, progress)}%`, backgroundColor: color }]} />
    </View>
  );
}

export function UsageBanner() {
  const { usage, loading, isFreeTier, manageSubscription } = useUsageLimits();

  if (loading || !usage || !isFreeTier) {
    return null;
  }

  const getProgressColor = (percent: number) => {
    if (percent >= 100) return COLORS.danger;
    if (percent >= 80) return COLORS.warning;
    return COLORS.secondary;
  };

  const tripsRemaining = usage.trips.remaining;
  const docsRemaining = usage.documents.remaining;
  const tripsProgress = usage.trips.percentUsed;
  const docsProgress = usage.documents.percentUsed;

  // Don't show banner if lots of usage remaining
  if (tripsProgress < 60 && docsProgress < 60) {
    return null;
  }

  const isAtLimit = tripsRemaining <= 0 || docsRemaining <= 0;
  const isNearLimit = tripsProgress >= 80 || docsProgress >= 80;

  return (
    <View style={[styles.container, isAtLimit && styles.containerDanger]}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {isAtLimit ? 'Limit Reached' : 'Free Plan Usage'}
        </Text>
        <Text style={styles.resetText}>
          Resets in {usage.daysUntilReset} day{usage.daysUntilReset !== 1 ? 's' : ''}
        </Text>
      </View>

      <View style={styles.usageRow}>
        <View style={styles.usageItem}>
          <View style={styles.usageHeader}>
            <Text style={styles.usageLabel}>Trips</Text>
            <Text style={[styles.usageCount, tripsRemaining <= 1 && styles.usageCountWarning]}>
              {usage.trips.used}/{usage.trips.limit}
            </Text>
          </View>
          <ProgressBar progress={tripsProgress} color={getProgressColor(tripsProgress)} />
        </View>

        <View style={styles.usageItem}>
          <View style={styles.usageHeader}>
            <Text style={styles.usageLabel}>Documents</Text>
            <Text style={[styles.usageCount, docsRemaining <= 1 && styles.usageCountWarning]}>
              {usage.documents.used}/{usage.documents.limit}
            </Text>
          </View>
          <ProgressBar progress={docsProgress} color={getProgressColor(docsProgress)} />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.upgradeButton, isAtLimit && styles.upgradeButtonUrgent]}
        onPress={() => router.push('/(tabs)/subscription')}
        activeOpacity={0.8}
      >
        <Text style={styles.upgradeButtonText}>
          {isAtLimit ? 'Upgrade Now - Unlock Unlimited' : 'Upgrade to Pro - Unlimited Everything'}
        </Text>
      </TouchableOpacity>

      {isNearLimit && !isAtLimit && (
        <Text style={styles.savingsText}>
          Pro drivers save an average of $2,400/year with RoadLedger
        </Text>
      )}
    </View>
  );
}

// Compact version for other screens
export function UsageBadge() {
  const { usage, isFreeTier } = useUsageLimits();

  if (!usage || !isFreeTier) return null;

  const tripsRemaining = usage.trips.remaining;
  const isLow = tripsRemaining <= 2;

  if (!isLow) return null;

  return (
    <TouchableOpacity
      style={[styles.badge, tripsRemaining === 0 && styles.badgeDanger]}
      onPress={() => router.push('/(tabs)/subscription')}
    >
      <Text style={styles.badgeText}>
        {tripsRemaining === 0
          ? 'Trip limit reached - Upgrade'
          : `${tripsRemaining} trip${tripsRemaining !== 1 ? 's' : ''} left`}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.surfaceLight,
  },
  containerDanger: {
    borderColor: COLORS.danger,
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  resetText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  usageRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  usageItem: {
    flex: 1,
  },
  usageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  usageLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  usageCount: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '500',
  },
  usageCountWarning: {
    color: COLORS.warning,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  upgradeButton: {
    backgroundColor: COLORS.secondary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  upgradeButtonUrgent: {
    backgroundColor: COLORS.accent,
  },
  upgradeButtonText: {
    color: COLORS.background,
    fontSize: 14,
    fontWeight: '600',
  },
  savingsText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  badge: {
    backgroundColor: COLORS.warning,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  badgeDanger: {
    backgroundColor: COLORS.danger,
  },
  badgeText: {
    color: COLORS.background,
    fontSize: 12,
    fontWeight: '600',
  },
});
