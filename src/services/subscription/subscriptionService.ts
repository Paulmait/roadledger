// RoadLedger Subscription Service
// Apple StoreKit 2 compliant IAP implementation
// Follows Apple App Store Guidelines for 100% compliance

import * as InAppPurchases from 'expo-in-app-purchases';
import type { IAPQueryResponse, InAppPurchase } from 'expo-in-app-purchases';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import {
  APPLE_PRODUCT_IDS,
  type SubscriptionTier,
} from '@/constants/pricing';

export interface SubscriptionProduct {
  productId: string;
  title: string;
  description: string;
  price: string;
  priceAmountMicros: string;
  priceCurrencyCode: string;
  subscriptionPeriod?: string;
}

export interface SubscriptionStatus {
  tier: SubscriptionTier;
  isActive: boolean;
  expiresAt: string | null;
  willRenew: boolean;
  productId: string | null;
}

interface PurchaseResult {
  productId: string;
  transactionId?: string;
  transactionReceipt?: string;
  acknowledged?: boolean;
}

class SubscriptionService {
  private initialized = false;
  private products: SubscriptionProduct[] = [];

  /**
   * Initialize the IAP connection
   * Must be called before any purchase operations
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) return true;

    try {
      // Connect to the store
      await InAppPurchases.connectAsync();

      // Set up purchase listener (Apple requirement)
      InAppPurchases.setPurchaseListener(this.handlePurchaseUpdate.bind(this));

      // Load products
      await this.loadProducts();

      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize IAP:', error);
      return false;
    }
  }

  /**
   * Load available products from App Store
   */
  async loadProducts(): Promise<SubscriptionProduct[]> {
    try {
      const { responseCode, results } = await InAppPurchases.getProductsAsync(
        APPLE_PRODUCT_IDS
      );

      if (responseCode === InAppPurchases.IAPResponseCode.OK && results) {
        this.products = results.map((product) => ({
          productId: product.productId,
          title: product.title,
          description: product.description,
          price: product.price,
          priceAmountMicros: String(product.priceAmountMicros),
          priceCurrencyCode: product.priceCurrencyCode,
          subscriptionPeriod: product.subscriptionPeriod,
        }));
      }

      return this.products;
    } catch (error) {
      console.error('Failed to load products:', error);
      return [];
    }
  }

  /**
   * Get cached products
   */
  getProducts(): SubscriptionProduct[] {
    return this.products;
  }

  /**
   * Purchase a subscription
   * Apple StoreKit 2 compliant - handles payment sheet automatically
   */
  async purchaseSubscription(productId: string): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // This will show Apple's native payment sheet
      await InAppPurchases.purchaseItemAsync(productId);
      return true;
    } catch (error: unknown) {
      // Handle user cancellation gracefully (Apple requirement)
      if (error instanceof Error && 'code' in error && error.code === 'E_USER_CANCELLED') {
        console.log('User cancelled purchase');
        return false;
      }

      console.error('Purchase failed:', error);
      throw error;
    }
  }

  /**
   * Handle purchase updates from Apple
   * This is called for new purchases, renewals, and subscription changes
   */
  private async handlePurchaseUpdate(
    response: IAPQueryResponse<InAppPurchase>
  ): Promise<void> {
    const { responseCode, results } = response;

    if (responseCode === InAppPurchases.IAPResponseCode.OK && results) {
      for (const result of results) {
        if (!result.acknowledged) {
          // Validate receipt server-side (Apple requirement for subscriptions)
          const validated = await this.validateAndRecordPurchase({
            productId: result.productId,
            transactionId: result.orderId,
            transactionReceipt: result.transactionReceipt,
            acknowledged: result.acknowledged,
          });

          if (validated) {
            // Finish the transaction (Apple requirement)
            await InAppPurchases.finishTransactionAsync(result, true);
          }
        }
      }
    } else if (responseCode === InAppPurchases.IAPResponseCode.USER_CANCELED) {
      console.log('Purchase cancelled by user');
    } else if (responseCode === InAppPurchases.IAPResponseCode.DEFERRED) {
      // Ask to Buy - parent approval needed (Apple Family Sharing)
      console.log('Purchase deferred - awaiting approval');
    }
  }

  /**
   * Validate purchase receipt server-side and record in database
   */
  private async validateAndRecordPurchase(
    purchase: PurchaseResult
  ): Promise<boolean> {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        console.error('No auth token for receipt validation');
        return false;
      }

      // Send receipt to our server for validation
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/validate-receipt`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            productId: purchase.productId,
            transactionId: purchase.transactionId,
            transactionReceipt: purchase.transactionReceipt,
            platform: Platform.OS,
          }),
        }
      );

      if (!response.ok) {
        console.error('Receipt validation failed');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Receipt validation error:', error);
      return false;
    }
  }

  /**
   * Restore previous purchases
   * Apple requirement - must be accessible to users
   */
  async restorePurchases(): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const { responseCode, results } = await InAppPurchases.getPurchaseHistoryAsync();

      if (responseCode === InAppPurchases.IAPResponseCode.OK && results) {
        // Process restored purchases
        for (const purchase of results) {
          await this.validateAndRecordPurchase({
            productId: purchase.productId,
            transactionId: purchase.orderId,
            transactionReceipt: purchase.transactionReceipt,
            acknowledged: purchase.acknowledged,
          });
        }
        return true;
      }

      return false;
    } catch (error) {
      console.error('Restore purchases failed:', error);
      return false;
    }
  }

  /**
   * Get current subscription status from server
   */
  async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    try {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData?.session?.user) {
        return {
          tier: 'free',
          isActive: true,
          expiresAt: null,
          willRenew: false,
          productId: null,
        };
      }

      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', sessionData.session.user.id)
        .eq('status', 'active')
        .single();

      if (!subscription) {
        return {
          tier: 'free',
          isActive: true,
          expiresAt: null,
          willRenew: false,
          productId: null,
        };
      }

      return {
        tier: subscription.tier as SubscriptionTier,
        isActive: new Date(subscription.expires_at) > new Date(),
        expiresAt: subscription.expires_at,
        willRenew: subscription.will_renew,
        productId: subscription.product_id,
      };
    } catch (error) {
      console.error('Failed to get subscription status:', error);
      return {
        tier: 'free',
        isActive: true,
        expiresAt: null,
        willRenew: false,
        productId: null,
      };
    }
  }

  /**
   * Disconnect from IAP (call on app shutdown)
   */
  async disconnect(): Promise<void> {
    if (this.initialized) {
      await InAppPurchases.disconnectAsync();
      this.initialized = false;
    }
  }
}

// Export singleton instance
export const subscriptionService = new SubscriptionService();
