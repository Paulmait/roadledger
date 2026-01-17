// RoadLedger Pricing Configuration
// Competitive pricing based on market research (Jan 2026):
// - TruckLogics: $75/mo (PREMIUM only)
// - Motive/KeepTruckin: $20-35/mo per vehicle
// - Fleet management: $25-50/mo
//
// Our strategy: Premium pricing for AI-powered features that competitors don't have

export const PRICING_TIERS = {
  FREE: {
    id: 'free',
    name: 'Free',
    description: 'Try RoadLedger with basic tracking',
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      'Trip tracking (up to 5 trips/month)',
      'Manual expense entry',
      'Basic mileage reports',
      'State-by-state breakdown',
    ],
    limits: {
      tripsPerMonth: 5,  // Reduced from 10 to prevent abuse
      documentsPerMonth: 3,  // Reduced from 5
      aiInsightsPerMonth: 0,
      exportsPerMonth: 1,
    },
  },
  PRO: {
    id: 'pro',
    name: 'Pro',
    description: 'Everything you need to maximize profit',
    monthlyPrice: 14.99,
    yearlyPrice: 119.99, // 33% savings
    appleProductId: 'com.roadledger.pro.monthly',
    appleProductIdYearly: 'com.roadledger.pro.yearly',
    features: [
      'Unlimited trip tracking',
      'AI receipt scanning',
      'IFTA quarterly reports',
      'Profit per mile tracking',
      'Expense categorization',
      'Offline mode',
      'Tax summary exports',
    ],
    limits: {
      tripsPerMonth: -1, // unlimited
      documentsPerMonth: -1,
      aiInsightsPerMonth: 10,
      exportsPerMonth: -1,
    },
    popular: true,
  },
  PREMIUM: {
    id: 'premium',
    name: 'Premium',
    description: 'AI-powered insights for serious haulers',
    monthlyPrice: 29.99,
    yearlyPrice: 239.99, // 33% savings
    appleProductId: 'com.roadledger.premium.monthly',
    appleProductIdYearly: 'com.roadledger.premium.yearly',
    features: [
      'Everything in Pro',
      'Unlimited AI profit insights',
      'AI-powered recommendations',
      'Fuel price optimization',
      'Route profitability analysis',
      'Settlement document scanning',
      'Priority email support',
    ],
    limits: {
      tripsPerMonth: -1,
      documentsPerMonth: -1,
      aiInsightsPerMonth: -1, // unlimited
      exportsPerMonth: -1,
    },
  },
} as const;

// Apple App Store Product IDs
export const APPLE_PRODUCT_IDS = [
  'com.roadledger.pro.monthly',
  'com.roadledger.pro.yearly',
  'com.roadledger.premium.monthly',
  'com.roadledger.premium.yearly',
];

// Subscription benefits by tier
export const TIER_ORDER = ['free', 'pro', 'premium'] as const;
export type SubscriptionTier = typeof TIER_ORDER[number];

// Helper to check feature access
export function canAccessFeature(
  userTier: SubscriptionTier,
  requiredTier: SubscriptionTier
): boolean {
  const userIndex = TIER_ORDER.indexOf(userTier);
  const requiredIndex = TIER_ORDER.indexOf(requiredTier);
  return userIndex >= requiredIndex;
}

// Get tier details
export function getTierDetails(tier: SubscriptionTier) {
  switch (tier) {
    case 'premium':
      return PRICING_TIERS.PREMIUM;
    case 'pro':
      return PRICING_TIERS.PRO;
    default:
      return PRICING_TIERS.FREE;
  }
}

// Format price for display
export function formatPrice(amount: number, period: 'month' | 'year' = 'month'): string {
  if (amount === 0) return 'Free';
  return `$${amount.toFixed(2)}/${period === 'year' ? 'yr' : 'mo'}`;
}

// Calculate savings
export function calculateYearlySavings(monthlyPrice: number, yearlyPrice: number): number {
  const monthlyTotal = monthlyPrice * 12;
  return Math.round(((monthlyTotal - yearlyPrice) / monthlyTotal) * 100);
}
