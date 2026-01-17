// RoadLedger Analytics Service
// Comprehensive analytics tracking for business insights

import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import { supabase } from '@/lib/supabase';

// Use expo-crypto for UUID generation (works natively on iOS/Android)
const uuidv4 = () => Crypto.randomUUID();

// Event types for type safety
export type AnalyticsEventType =
  // Auth events
  | 'app_open'
  | 'sign_up'
  | 'sign_in'
  | 'sign_out'
  | 'password_reset_request'
  | 'password_reset_complete'
  | 'profile_update'
  // Trip events
  | 'trip_start'
  | 'trip_end'
  | 'trip_finalize'
  | 'trip_view'
  // Document events
  | 'document_upload'
  | 'document_scan'
  | 'document_view'
  | 'document_ai_extract'
  // Transaction events
  | 'transaction_create'
  | 'transaction_update'
  | 'transaction_delete'
  // Export events
  | 'export_ifta_start'
  | 'export_ifta_complete'
  | 'export_tax_start'
  | 'export_tax_complete'
  // Subscription events
  | 'subscription_view'
  | 'subscription_started'
  | 'subscription_upgraded'
  | 'subscription_downgraded'
  | 'subscription_cancelled'
  | 'subscription_restored'
  // Feature usage
  | 'ai_insight_view'
  | 'ai_suggestion_action'
  | 'screen_view'
  | 'feature_use'
  // Errors
  | 'error';

interface DeviceInfo {
  platform: string;
  osVersion: string;
  deviceModel: string;
  appVersion: string;
  buildNumber: string;
}

interface AnalyticsEvent {
  eventType: AnalyticsEventType;
  eventData?: Record<string, unknown>;
  screenName?: string;
}

class AnalyticsService {
  private _sessionId: string | null = null;
  private deviceInfo: DeviceInfo | null = null;
  private userId: string | null = null;
  private eventQueue: AnalyticsEvent[] = [];
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private isInitialized = false;

  // Lazy initialization of sessionId to avoid calling expo-crypto at module load time
  private get sessionId(): string {
    if (!this._sessionId) {
      this._sessionId = uuidv4();
    }
    return this._sessionId;
  }

  private set sessionId(value: string) {
    this._sessionId = value;
  }

  constructor() {
    // Don't initialize sessionId here - it will be lazily created when first accessed
  }

  /**
   * Initialize analytics service
   */
  async initialize(userId?: string): Promise<void> {
    if (this.isInitialized) return;

    this.userId = userId || null;
    await this.collectDeviceInfo();

    // Start batch flush interval (every 30 seconds)
    this.flushInterval = setInterval(() => this.flush(), 30000);

    this.isInitialized = true;

    // Track app open
    this.track('app_open');
  }

  /**
   * Set user ID (called after sign in)
   */
  setUserId(userId: string | null): void {
    this.userId = userId;
  }

  /**
   * Start new session
   */
  startNewSession(): void {
    this.sessionId = uuidv4();
    this.track('app_open');
  }

  /**
   * Collect device information
   */
  private async collectDeviceInfo(): Promise<void> {
    try {
      this.deviceInfo = {
        platform: Platform.OS,
        osVersion: Platform.Version?.toString() || 'unknown',
        deviceModel: Device.modelName || 'unknown',
        appVersion: Application.nativeApplicationVersion || '1.0.0',
        buildNumber: Application.nativeBuildVersion || '1',
      };
    } catch (error) {
      console.error('Failed to collect device info:', error);
      this.deviceInfo = {
        platform: Platform.OS,
        osVersion: 'unknown',
        deviceModel: 'unknown',
        appVersion: '1.0.0',
        buildNumber: '1',
      };
    }
  }

  /**
   * Track an analytics event
   */
  track(
    eventType: AnalyticsEventType,
    eventData?: Record<string, unknown>,
    screenName?: string
  ): void {
    this.eventQueue.push({
      eventType,
      eventData,
      screenName,
    });

    // Auto-flush if queue is large
    if (this.eventQueue.length >= 10) {
      this.flush();
    }
  }

  /**
   * Track screen view
   */
  trackScreen(screenName: string): void {
    this.track('screen_view', { screen: screenName }, screenName);
  }

  /**
   * Track error
   */
  trackError(error: Error, context?: Record<string, unknown>): void {
    this.track('error', {
      message: error.message,
      stack: error.stack?.slice(0, 500),
      ...context,
    });
  }

  /**
   * Flush event queue to server
   */
  async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const eventsToSend = [...this.eventQueue];
    this.eventQueue = [];

    try {
      const formattedEvents = eventsToSend.map((event) => ({
        user_id: this.userId,
        session_id: this.sessionId,
        event_type: event.eventType,
        event_data: {
          ...event.eventData,
          screen: event.screenName,
        },
        device_info: this.deviceInfo,
        created_at: new Date().toISOString(),
      }));

      // Use service role via edge function or direct insert if user is authenticated
      if (this.userId) {
        await supabase.from('analytics_events').insert(formattedEvents);
      } else {
        // For anonymous events, send to edge function
        await fetch(
          `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/track-analytics`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ events: formattedEvents }),
          }
        );
      }
    } catch (error) {
      // Re-queue events on failure
      this.eventQueue.unshift(...eventsToSend);
      console.error('Failed to flush analytics:', error);
    }
  }

  /**
   * Shutdown analytics service
   */
  shutdown(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flush();
    this.isInitialized = false;
  }

  // ============================================
  // CONVENIENCE METHODS
  // ============================================

  // Auth events
  trackSignUp(method: string = 'email'): void {
    this.track('sign_up', { method });
  }

  trackSignIn(method: string = 'email'): void {
    this.track('sign_in', { method });
  }

  trackSignOut(): void {
    this.track('sign_out');
  }

  // Trip events
  trackTripStart(tripId: string, mode: string): void {
    this.track('trip_start', { trip_id: tripId, mode });
  }

  trackTripEnd(tripId: string, miles: number, duration: number): void {
    this.track('trip_end', { trip_id: tripId, miles, duration_minutes: duration });
  }

  // Document events
  trackDocumentUpload(docType: string, source: string): void {
    this.track('document_upload', { doc_type: docType, source });
  }

  trackDocumentScan(success: boolean, extractedFields?: string[]): void {
    this.track('document_scan', { success, extracted_fields: extractedFields });
  }

  // Subscription events
  trackSubscriptionView(currentTier: string): void {
    this.track('subscription_view', { current_tier: currentTier });
  }

  trackSubscriptionChange(fromTier: string, toTier: string, productId: string): void {
    const isUpgrade = this.compareTiers(fromTier, toTier) < 0;
    this.track(isUpgrade ? 'subscription_upgraded' : 'subscription_downgraded', {
      from_tier: fromTier,
      to_tier: toTier,
      product_id: productId,
    });
  }

  // AI feature usage
  trackAIInsight(insightType: string, actionTaken?: string): void {
    this.track('ai_insight_view', { insight_type: insightType, action: actionTaken });
  }

  // Feature usage
  trackFeatureUse(feature: string, details?: Record<string, unknown>): void {
    this.track('feature_use', { feature, ...details });
  }

  // Export events
  trackExportStart(exportType: 'ifta' | 'tax_pack', period: string): void {
    this.track(
      exportType === 'ifta' ? 'export_ifta_start' : 'export_tax_start',
      { period }
    );
  }

  trackExportComplete(exportType: 'ifta' | 'tax_pack', success: boolean): void {
    this.track(
      exportType === 'ifta' ? 'export_ifta_complete' : 'export_tax_complete',
      { success }
    );
  }

  // Helper to compare tiers
  private compareTiers(tier1: string, tier2: string): number {
    const order = ['free', 'pro', 'premium'];
    return order.indexOf(tier1) - order.indexOf(tier2);
  }
}

// Export singleton instance
export const analytics = new AnalyticsService();
