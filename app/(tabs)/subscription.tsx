import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import {
  PRICING_TIERS,
  type SubscriptionTier,
  formatPrice,
  calculateYearlySavings,
} from '@/constants/pricing';
import { subscriptionService, type SubscriptionStatus } from '@/services/subscription/subscriptionService';
import { analytics } from '@/services/analytics/analyticsService';

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
};

export default function SubscriptionScreen() {
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('yearly');
  const [currentSubscription, setCurrentSubscription] = useState<SubscriptionStatus | null>(null);

  useEffect(() => {
    loadSubscriptionStatus();
    analytics.trackSubscriptionView(currentSubscription?.tier || 'free');
  }, []);

  const loadSubscriptionStatus = async () => {
    try {
      await subscriptionService.initialize();
      const status = await subscriptionService.getSubscriptionStatus();
      setCurrentSubscription(status);
    } catch (error) {
      console.error('Failed to load subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (tier: 'pro' | 'premium') => {
    if (Platform.OS === 'web') {
      Alert.alert('Web Purchase', 'Please use the mobile app to purchase a subscription.');
      return;
    }

    setPurchasing(true);

    try {
      const productId = billingPeriod === 'yearly'
        ? tier === 'premium'
          ? PRICING_TIERS.PREMIUM.appleProductIdYearly
          : PRICING_TIERS.PRO.appleProductIdYearly
        : tier === 'premium'
          ? PRICING_TIERS.PREMIUM.appleProductId
          : PRICING_TIERS.PRO.appleProductId;

      const success = await subscriptionService.purchaseSubscription(productId!);

      if (success) {
        await loadSubscriptionStatus();
        Alert.alert('Success', `You are now subscribed to ${tier.toUpperCase()}!`);
      }
    } catch (error: any) {
      Alert.alert('Purchase Failed', error.message || 'Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setPurchasing(true);
    try {
      const restored = await subscriptionService.restorePurchases();
      if (restored) {
        await loadSubscriptionStatus();
        Alert.alert('Success', 'Your purchases have been restored.');
      } else {
        Alert.alert('No Purchases', 'No previous purchases found to restore.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to restore purchases. Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.secondary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Choose Your Plan</Text>
        <Text style={styles.subtitle}>
          Maximize your profit with the right tools
        </Text>
      </View>

      {/* Billing Toggle */}
      <View style={styles.billingToggle}>
        <TouchableOpacity
          style={[
            styles.billingOption,
            billingPeriod === 'monthly' && styles.billingOptionActive,
          ]}
          onPress={() => setBillingPeriod('monthly')}
        >
          <Text
            style={[
              styles.billingOptionText,
              billingPeriod === 'monthly' && styles.billingOptionTextActive,
            ]}
          >
            Monthly
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.billingOption,
            billingPeriod === 'yearly' && styles.billingOptionActive,
          ]}
          onPress={() => setBillingPeriod('yearly')}
        >
          <Text
            style={[
              styles.billingOptionText,
              billingPeriod === 'yearly' && styles.billingOptionTextActive,
            ]}
          >
            Yearly
          </Text>
          <View style={styles.savingsBadge}>
            <Text style={styles.savingsText}>Save 33%</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Free Plan */}
      <View style={styles.planCard}>
        <View style={styles.planHeader}>
          <Text style={styles.planName}>{PRICING_TIERS.FREE.name}</Text>
          <Text style={styles.planPrice}>Free</Text>
        </View>
        <Text style={styles.planDescription}>{PRICING_TIERS.FREE.description}</Text>
        <View style={styles.featureList}>
          {PRICING_TIERS.FREE.features.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <Text style={styles.featureCheck}>✓</Text>
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>
        {currentSubscription?.tier === 'free' && (
          <View style={styles.currentPlanBadge}>
            <Text style={styles.currentPlanText}>Current Plan</Text>
          </View>
        )}
      </View>

      {/* Pro Plan */}
      <View style={[styles.planCard, styles.popularPlan]}>
        <View style={styles.popularBadge}>
          <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
        </View>
        <View style={styles.planHeader}>
          <Text style={styles.planName}>{PRICING_TIERS.PRO.name}</Text>
          <View>
            <Text style={styles.planPrice}>
              ${billingPeriod === 'yearly'
                ? (PRICING_TIERS.PRO.yearlyPrice / 12).toFixed(2)
                : PRICING_TIERS.PRO.monthlyPrice}
              <Text style={styles.planPriceUnit}>/mo</Text>
            </Text>
            {billingPeriod === 'yearly' && (
              <Text style={styles.billedText}>
                Billed ${PRICING_TIERS.PRO.yearlyPrice}/year
              </Text>
            )}
          </View>
        </View>
        <Text style={styles.planDescription}>{PRICING_TIERS.PRO.description}</Text>
        <View style={styles.featureList}>
          {PRICING_TIERS.PRO.features.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <Text style={[styles.featureCheck, { color: COLORS.secondary }]}>✓</Text>
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>
        {currentSubscription?.tier === 'pro' ? (
          <View style={styles.currentPlanBadge}>
            <Text style={styles.currentPlanText}>Current Plan</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.purchaseButton, purchasing && styles.buttonDisabled]}
            onPress={() => handlePurchase('pro')}
            disabled={purchasing}
          >
            {purchasing ? (
              <ActivityIndicator color={COLORS.background} />
            ) : (
              <Text style={styles.purchaseButtonText}>
                {currentSubscription?.tier === 'free' ? 'Upgrade to Pro' : 'Switch to Pro'}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Premium Plan */}
      <View style={[styles.planCard, styles.premiumPlan]}>
        <View style={styles.planHeader}>
          <Text style={styles.planName}>{PRICING_TIERS.PREMIUM.name}</Text>
          <View>
            <Text style={styles.planPrice}>
              ${billingPeriod === 'yearly'
                ? (PRICING_TIERS.PREMIUM.yearlyPrice / 12).toFixed(2)
                : PRICING_TIERS.PREMIUM.monthlyPrice}
              <Text style={styles.planPriceUnit}>/mo</Text>
            </Text>
            {billingPeriod === 'yearly' && (
              <Text style={styles.billedText}>
                Billed ${PRICING_TIERS.PREMIUM.yearlyPrice}/year
              </Text>
            )}
          </View>
        </View>
        <Text style={styles.planDescription}>{PRICING_TIERS.PREMIUM.description}</Text>
        <View style={styles.featureList}>
          {PRICING_TIERS.PREMIUM.features.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <Text style={[styles.featureCheck, { color: COLORS.accent }]}>✓</Text>
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>
        {currentSubscription?.tier === 'premium' ? (
          <View style={styles.currentPlanBadge}>
            <Text style={styles.currentPlanText}>Current Plan</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.purchaseButton, styles.premiumButton, purchasing && styles.buttonDisabled]}
            onPress={() => handlePurchase('premium')}
            disabled={purchasing}
          >
            {purchasing ? (
              <ActivityIndicator color={COLORS.background} />
            ) : (
              <Text style={styles.purchaseButtonText}>
                {currentSubscription?.tier === 'free' ? 'Go Premium' : 'Upgrade to Premium'}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Restore Purchases */}
      <TouchableOpacity style={styles.restoreButton} onPress={handleRestore}>
        <Text style={styles.restoreButtonText}>Restore Purchases</Text>
      </TouchableOpacity>

      {/* Terms */}
      <Text style={styles.terms}>
        Subscriptions automatically renew unless cancelled at least 24 hours before
        the end of the current period. Your account will be charged for renewal
        within 24 hours prior to the end of the current period. You can manage and
        cancel your subscriptions in your App Store account settings.
      </Text>
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
    paddingTop: 60,
    paddingBottom: 32,
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
  billingToggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  billingOption: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  billingOptionActive: {
    backgroundColor: COLORS.surfaceLight,
  },
  billingOptionText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  billingOptionTextActive: {
    color: COLORS.text,
    fontWeight: '600',
  },
  savingsBadge: {
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  savingsText: {
    fontSize: 10,
    color: COLORS.background,
    fontWeight: 'bold',
  },
  planCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.surfaceLight,
  },
  popularPlan: {
    borderColor: COLORS.secondary,
    borderWidth: 2,
  },
  premiumPlan: {
    borderColor: COLORS.accent,
    borderWidth: 1,
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    right: 20,
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.background,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  planName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  planPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'right',
  },
  planPriceUnit: {
    fontSize: 14,
    fontWeight: 'normal',
    color: COLORS.textSecondary,
  },
  billedText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'right',
  },
  planDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  featureList: {
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  featureCheck: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginRight: 10,
  },
  featureText: {
    fontSize: 14,
    color: COLORS.text,
    flex: 1,
  },
  currentPlanBadge: {
    backgroundColor: COLORS.surfaceLight,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  currentPlanText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  purchaseButton: {
    backgroundColor: COLORS.secondary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  premiumButton: {
    backgroundColor: COLORS.accent,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  purchaseButtonText: {
    color: COLORS.background,
    fontSize: 16,
    fontWeight: '600',
  },
  restoreButton: {
    padding: 16,
    alignItems: 'center',
  },
  restoreButtonText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  terms: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 8,
  },
});
