// Usage Limits Hook - Tracks user limits and provides warnings
// Shows warnings at 80% usage and blocks at 100%

import { useState, useEffect, useCallback } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { getTierDetails, type SubscriptionTier } from '@/constants/pricing';
import { getMonthlyTripCount, getMonthlyDocumentCount } from '@/lib/database/queries';
import { notificationService } from '@/services/notifications/notificationService';

export interface UsageStats {
  trips: {
    used: number;
    limit: number;
    remaining: number;
    percentUsed: number;
    isUnlimited: boolean;
  };
  documents: {
    used: number;
    limit: number;
    remaining: number;
    percentUsed: number;
    isUnlimited: boolean;
  };
  aiInsights: {
    used: number;
    limit: number;
    remaining: number;
    percentUsed: number;
    isUnlimited: boolean;
  };
  exports: {
    used: number;
    limit: number;
    remaining: number;
    percentUsed: number;
    isUnlimited: boolean;
  };
  tier: SubscriptionTier;
  daysUntilReset: number;
}

const WARNING_THRESHOLD = 0.8; // 80%

export function useUsageLimits() {
  const { profile, user } = useAuthStore();
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);

  const tier = (profile?.subscription_tier || 'free') as SubscriptionTier;
  const tierDetails = getTierDetails(tier);

  const refreshUsage = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      // Get current usage counts
      const [tripCount, docCount] = await Promise.all([
        getMonthlyTripCount(user.id),
        getMonthlyDocumentCount(user.id),
      ]);

      // TODO: Track AI insights and exports usage in database
      const aiInsightCount = 0;
      const exportCount = 0;

      // Calculate days until month reset
      const now = new Date();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const daysUntilReset = Math.ceil((endOfMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      const createUsageStat = (used: number, limit: number) => ({
        used,
        limit,
        remaining: limit === -1 ? Infinity : Math.max(0, limit - used),
        percentUsed: limit === -1 ? 0 : (used / limit) * 100,
        isUnlimited: limit === -1,
      });

      setUsage({
        trips: createUsageStat(tripCount, tierDetails.limits.tripsPerMonth),
        documents: createUsageStat(docCount, tierDetails.limits.documentsPerMonth),
        aiInsights: createUsageStat(aiInsightCount, tierDetails.limits.aiInsightsPerMonth),
        exports: createUsageStat(exportCount, tierDetails.limits.exportsPerMonth),
        tier,
        daysUntilReset,
      });
    } catch (error) {
      console.error('Failed to load usage stats:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, tier, tierDetails]);

  useEffect(() => {
    refreshUsage();
  }, [refreshUsage]);

  // Check if user is approaching limit and show warning
  const checkAndWarnLimits = useCallback(() => {
    if (!usage || tier !== 'free') return;

    const warnings: string[] = [];

    if (!usage.trips.isUnlimited && usage.trips.percentUsed >= WARNING_THRESHOLD * 100) {
      const remaining = usage.trips.remaining;
      if (remaining > 0) {
        warnings.push(`Only ${remaining} trip${remaining === 1 ? '' : 's'} remaining this month`);
      }
    }

    if (!usage.documents.isUnlimited && usage.documents.percentUsed >= WARNING_THRESHOLD * 100) {
      const remaining = usage.documents.remaining;
      if (remaining > 0) {
        warnings.push(`Only ${remaining} document upload${remaining === 1 ? '' : 's'} remaining`);
      }
    }

    if (warnings.length > 0) {
      // Schedule a local notification if app is backgrounded
      notificationService.sendLocalNotification(
        'Approaching Usage Limit',
        `${warnings.join('. ')}. Upgrade to Pro for unlimited access.`,
        { type: 'usage_warning' }
      );
    }
  }, [usage, tier]);

  // Show upgrade prompt with compelling CTA
  const showUpgradePrompt = useCallback((feature: string, limitType: 'trips' | 'documents' | 'aiInsights' | 'exports') => {
    const benefits = {
      trips: 'Unlimited trip tracking',
      documents: 'Unlimited document uploads with AI scanning',
      aiInsights: 'Unlimited AI-powered profit insights',
      exports: 'Unlimited IFTA and tax exports',
    };

    Alert.alert(
      `${feature} Limit Reached`,
      `You've used all your free ${feature.toLowerCase()} for this month.\n\nUpgrade to Pro for:\n• ${benefits[limitType]}\n• Save hours on IFTA reports\n• Maximize your profit per mile\n\nPro drivers save an average of $2,400/year with RoadLedger Pro.`,
      [
        { text: 'Maybe Later', style: 'cancel' },
        {
          text: 'View Plans',
          onPress: () => router.push('/(tabs)/subscription'),
          style: 'default',
        },
      ]
    );
  }, []);

  // Check if action is allowed (returns true if allowed, shows prompt if not)
  const canPerformAction = useCallback((actionType: 'trip' | 'document' | 'aiInsight' | 'export'): boolean => {
    if (!usage) return false;

    const usageMap = {
      trip: usage.trips,
      document: usage.documents,
      aiInsight: usage.aiInsights,
      export: usage.exports,
    };

    const featureNames = {
      trip: 'Trips',
      document: 'Documents',
      aiInsight: 'AI Insights',
      export: 'Exports',
    };

    const limitTypeMap = {
      trip: 'trips' as const,
      document: 'documents' as const,
      aiInsight: 'aiInsights' as const,
      export: 'exports' as const,
    };

    const stat = usageMap[actionType];

    if (stat.isUnlimited) return true;
    if (stat.remaining <= 0) {
      showUpgradePrompt(featureNames[actionType], limitTypeMap[actionType]);
      return false;
    }

    // Show warning if approaching limit (but still allow)
    if (stat.percentUsed >= WARNING_THRESHOLD * 100 && stat.remaining <= 2) {
      // Don't block, just warn
      setTimeout(() => {
        Alert.alert(
          'Almost at Limit',
          `You have ${stat.remaining} ${featureNames[actionType].toLowerCase()} remaining this month. Consider upgrading to Pro for unlimited access.`,
          [
            { text: 'Continue', style: 'cancel' },
            { text: 'View Plans', onPress: () => router.push('/(tabs)/subscription') },
          ]
        );
      }, 500);
    }

    return true;
  }, [usage, showUpgradePrompt]);

  // Open App Store subscription management (one-click cancellation)
  const manageSubscription = useCallback(async () => {
    if (Platform.OS === 'ios') {
      // Deep link to App Store subscription management
      const url = 'https://apps.apple.com/account/subscriptions';
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert(
          'Manage Subscription',
          'To manage your subscription, go to Settings > Your Name > Subscriptions on your device.'
        );
      }
    } else if (Platform.OS === 'android') {
      // Deep link to Play Store subscription management
      const url = 'https://play.google.com/store/account/subscriptions';
      await Linking.openURL(url);
    } else {
      Alert.alert(
        'Manage Subscription',
        'Please manage your subscription through your device\'s app store settings.'
      );
    }
  }, []);

  return {
    usage,
    loading,
    refreshUsage,
    checkAndWarnLimits,
    canPerformAction,
    showUpgradePrompt,
    manageSubscription,
    tier,
    isFreeTier: tier === 'free',
    isPro: tier === 'pro',
    isPremium: tier === 'premium',
  };
}
