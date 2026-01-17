// RoadLedger Analytics Service
// Comprehensive analytics tracking for business insights and investor metrics

import { Platform, AppState, AppStateStatus } from 'react-native';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

// Use expo-crypto for UUID generation (works natively on iOS/Android)
const uuidv4 = () => Crypto.randomUUID();

// Storage keys for persistent metrics
const STORAGE_KEYS = {
  FIRST_OPEN: 'analytics_first_open',
  LAST_OPEN: 'analytics_last_open',
  SESSION_COUNT: 'analytics_session_count',
  TOTAL_SESSION_TIME: 'analytics_total_session_time',
  DAILY_OPENS: 'analytics_daily_opens',
  WEEKLY_ACTIVE_DAYS: 'analytics_weekly_active_days',
  INSTALL_DATE: 'analytics_install_date',
  DEVICE_ID: 'analytics_device_id',
};

// Event types for type safety
export type AnalyticsEventType =
  // Auth events
  | 'app_open'
  | 'app_close'
  | 'app_background'
  | 'app_foreground'
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
  // Engagement events
  | 'session_start'
  | 'session_end'
  | 'daily_active'
  | 'weekly_active'
  | 'monthly_active'
  // Errors
  | 'error';

interface DeviceInfo {
  platform: string;
  osVersion: string;
  deviceModel: string;
  deviceBrand: string | null;
  deviceType: string | null;
  isDevice: boolean;
  appVersion: string;
  buildNumber: string;
  screenWidth: number;
  screenHeight: number;
  locale: string;
  timezone: string;
}

interface EngagementMetrics {
  sessionCount: number;
  totalSessionTimeMs: number;
  avgSessionTimeMs: number;
  daysActive: number;
  daysSinceInstall: number;
  lastActiveDate: string;
  installDate: string;
  retentionDay1: boolean;
  retentionDay7: boolean;
  retentionDay30: boolean;
}

interface AnalyticsEvent {
  eventType: AnalyticsEventType;
  eventData?: Record<string, unknown>;
  screenName?: string;
}

class AnalyticsService {
  private _sessionId: string | null = null;
  private deviceId: string | null = null;
  private deviceInfo: DeviceInfo | null = null;
  private userId: string | null = null;
  private eventQueue: AnalyticsEvent[] = [];
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private isInitialized = false;

  // Session tracking
  private sessionStartTime: number = 0;
  private currentScreenStartTime: number = 0;
  private currentScreen: string = '';
  private screenTimeMap: Map<string, number> = new Map();
  private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

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
    await this.initializeDeviceId();
    await this.recordSessionStart();

    // Start batch flush interval (every 30 seconds)
    this.flushInterval = setInterval(() => this.flush(), 30000);

    // Listen for app state changes (background/foreground)
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);

    this.isInitialized = true;

    // Track app open with engagement data
    await this.trackAppOpen();
  }

  /**
   * Generate or retrieve persistent device ID
   */
  private async initializeDeviceId(): Promise<void> {
    try {
      let deviceId = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_ID);
      if (!deviceId) {
        deviceId = uuidv4();
        await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_ID, deviceId);
      }
      this.deviceId = deviceId;

      // Set install date if first time
      const installDate = await AsyncStorage.getItem(STORAGE_KEYS.INSTALL_DATE);
      if (!installDate) {
        await AsyncStorage.setItem(STORAGE_KEYS.INSTALL_DATE, new Date().toISOString());
      }
    } catch (error) {
      console.error('Failed to initialize device ID:', error);
      this.deviceId = uuidv4();
    }
  }

  /**
   * Record session start and increment counters
   */
  private async recordSessionStart(): Promise<void> {
    this.sessionStartTime = Date.now();

    try {
      // Increment session count
      const countStr = await AsyncStorage.getItem(STORAGE_KEYS.SESSION_COUNT);
      const count = countStr ? parseInt(countStr, 10) + 1 : 1;
      await AsyncStorage.setItem(STORAGE_KEYS.SESSION_COUNT, count.toString());

      // Track daily opens for DAU
      const today = new Date().toISOString().split('T')[0];
      const dailyOpensStr = await AsyncStorage.getItem(STORAGE_KEYS.DAILY_OPENS);
      const dailyOpens = dailyOpensStr ? JSON.parse(dailyOpensStr) : {};
      dailyOpens[today] = (dailyOpens[today] || 0) + 1;

      // Keep only last 90 days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);
      const cutoffStr = cutoffDate.toISOString().split('T')[0];
      Object.keys(dailyOpens).forEach(date => {
        if (date < cutoffStr) delete dailyOpens[date];
      });
      await AsyncStorage.setItem(STORAGE_KEYS.DAILY_OPENS, JSON.stringify(dailyOpens));

      // Update last open
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_OPEN, new Date().toISOString());
    } catch (error) {
      console.error('Failed to record session start:', error);
    }
  }

  /**
   * Handle app state changes (background/foreground)
   */
  private handleAppStateChange = async (nextAppState: AppStateStatus): Promise<void> => {
    if (nextAppState === 'background' || nextAppState === 'inactive') {
      await this.recordSessionEnd();
      this.track('app_background');
    } else if (nextAppState === 'active') {
      await this.recordSessionStart();
      this.track('app_foreground');
    }
  };

  /**
   * Record session end and calculate duration
   */
  private async recordSessionEnd(): Promise<void> {
    if (this.sessionStartTime === 0) return;

    const sessionDuration = Date.now() - this.sessionStartTime;

    try {
      // Update total session time
      const totalStr = await AsyncStorage.getItem(STORAGE_KEYS.TOTAL_SESSION_TIME);
      const total = totalStr ? parseInt(totalStr, 10) + sessionDuration : sessionDuration;
      await AsyncStorage.setItem(STORAGE_KEYS.TOTAL_SESSION_TIME, total.toString());

      // Track session end with duration
      this.track('session_end', {
        duration_ms: sessionDuration,
        duration_minutes: Math.round(sessionDuration / 60000),
        screens_visited: Array.from(this.screenTimeMap.keys()),
      });
    } catch (error) {
      console.error('Failed to record session end:', error);
    }

    this.sessionStartTime = 0;
  }

  /**
   * Track app open with engagement metrics
   */
  private async trackAppOpen(): Promise<void> {
    const engagement = await this.getEngagementMetrics();

    this.track('app_open', {
      session_number: engagement.sessionCount,
      days_since_install: engagement.daysSinceInstall,
      is_returning_user: engagement.sessionCount > 1,
      device_id: this.deviceId,
    });

    // Track active user events
    this.track('daily_active', { date: new Date().toISOString().split('T')[0] });
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
   * Collect comprehensive device information
   */
  private async collectDeviceInfo(): Promise<void> {
    try {
      const { Dimensions } = await import('react-native');
      const { width, height } = Dimensions.get('window');
      const { NativeModules } = await import('react-native');

      // Get locale safely
      let locale = 'en-US';
      try {
        if (Platform.OS === 'ios') {
          locale = NativeModules.SettingsManager?.settings?.AppleLocale ||
                   NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] ||
                   'en-US';
        } else {
          locale = NativeModules.I18nManager?.localeIdentifier || 'en-US';
        }
      } catch {
        locale = 'en-US';
      }

      // Get timezone
      let timezone = 'UTC';
      try {
        timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      } catch {
        timezone = 'UTC';
      }

      this.deviceInfo = {
        platform: Platform.OS,
        osVersion: Platform.Version?.toString() || 'unknown',
        deviceModel: Device.modelName || 'unknown',
        deviceBrand: Device.brand,
        deviceType: Device.deviceType ? String(Device.deviceType) : null,
        isDevice: Device.isDevice,
        appVersion: Application.nativeApplicationVersion || '1.0.0',
        buildNumber: Application.nativeBuildVersion || '1',
        screenWidth: Math.round(width),
        screenHeight: Math.round(height),
        locale,
        timezone,
      };
    } catch (error) {
      console.error('Failed to collect device info:', error);
      this.deviceInfo = {
        platform: Platform.OS,
        osVersion: 'unknown',
        deviceModel: 'unknown',
        deviceBrand: null,
        deviceType: null,
        isDevice: true,
        appVersion: '1.0.0',
        buildNumber: '1',
        screenWidth: 0,
        screenHeight: 0,
        locale: 'en-US',
        timezone: 'UTC',
      };
    }
  }

  /**
   * Get engagement metrics for reporting
   */
  async getEngagementMetrics(): Promise<EngagementMetrics> {
    try {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];

      // Get stored values
      const [sessionCountStr, totalTimeStr, installDateStr, dailyOpensStr] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.SESSION_COUNT),
        AsyncStorage.getItem(STORAGE_KEYS.TOTAL_SESSION_TIME),
        AsyncStorage.getItem(STORAGE_KEYS.INSTALL_DATE),
        AsyncStorage.getItem(STORAGE_KEYS.DAILY_OPENS),
      ]);

      const sessionCount = sessionCountStr ? parseInt(sessionCountStr, 10) : 1;
      const totalSessionTimeMs = totalTimeStr ? parseInt(totalTimeStr, 10) : 0;
      const installDate = installDateStr || now.toISOString();
      const dailyOpens = dailyOpensStr ? JSON.parse(dailyOpensStr) : {};

      // Calculate days active
      const daysActive = Object.keys(dailyOpens).length;

      // Calculate days since install
      const installDateTime = new Date(installDate);
      const daysSinceInstall = Math.floor((now.getTime() - installDateTime.getTime()) / (1000 * 60 * 60 * 24));

      // Calculate retention
      const day1 = new Date(installDateTime);
      day1.setDate(day1.getDate() + 1);
      const day7 = new Date(installDateTime);
      day7.setDate(day7.getDate() + 7);
      const day30 = new Date(installDateTime);
      day30.setDate(day30.getDate() + 30);

      return {
        sessionCount,
        totalSessionTimeMs,
        avgSessionTimeMs: sessionCount > 0 ? Math.round(totalSessionTimeMs / sessionCount) : 0,
        daysActive,
        daysSinceInstall,
        lastActiveDate: todayStr,
        installDate: installDate.split('T')[0],
        retentionDay1: dailyOpens[day1.toISOString().split('T')[0]] !== undefined,
        retentionDay7: dailyOpens[day7.toISOString().split('T')[0]] !== undefined,
        retentionDay30: dailyOpens[day30.toISOString().split('T')[0]] !== undefined,
      };
    } catch (error) {
      console.error('Failed to get engagement metrics:', error);
      return {
        sessionCount: 1,
        totalSessionTimeMs: 0,
        avgSessionTimeMs: 0,
        daysActive: 1,
        daysSinceInstall: 0,
        lastActiveDate: new Date().toISOString().split('T')[0],
        installDate: new Date().toISOString().split('T')[0],
        retentionDay1: false,
        retentionDay7: false,
        retentionDay30: false,
      };
    }
  }

  /**
   * Get daily/weekly/monthly active user data
   */
  async getActiveUserMetrics(): Promise<{
    dau: number; // Today's opens
    wau: number; // Active days this week
    mau: number; // Active days this month
    dailyHistory: Record<string, number>;
  }> {
    try {
      const dailyOpensStr = await AsyncStorage.getItem(STORAGE_KEYS.DAILY_OPENS);
      const dailyOpens = dailyOpensStr ? JSON.parse(dailyOpensStr) : {};

      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];

      // Calculate week start (Sunday)
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      const weekStartStr = weekStart.toISOString().split('T')[0];

      // Calculate month start
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthStartStr = monthStart.toISOString().split('T')[0];

      let wau = 0;
      let mau = 0;

      Object.keys(dailyOpens).forEach(date => {
        if (date >= weekStartStr) wau++;
        if (date >= monthStartStr) mau++;
      });

      return {
        dau: dailyOpens[todayStr] || 0,
        wau,
        mau,
        dailyHistory: dailyOpens,
      };
    } catch (error) {
      console.error('Failed to get active user metrics:', error);
      return { dau: 0, wau: 0, mau: 0, dailyHistory: {} };
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
   * Track screen view with time tracking
   */
  trackScreen(screenName: string): void {
    // Record time on previous screen
    if (this.currentScreen && this.currentScreenStartTime > 0) {
      const timeSpent = Date.now() - this.currentScreenStartTime;
      const currentTime = this.screenTimeMap.get(this.currentScreen) || 0;
      this.screenTimeMap.set(this.currentScreen, currentTime + timeSpent);
    }

    // Start tracking new screen
    this.currentScreen = screenName;
    this.currentScreenStartTime = Date.now();

    this.track('screen_view', { screen: screenName }, screenName);
  }

  /**
   * Get time spent on screens in current session
   */
  getScreenTimeStats(): Record<string, number> {
    // Finalize current screen time
    if (this.currentScreen && this.currentScreenStartTime > 0) {
      const timeSpent = Date.now() - this.currentScreenStartTime;
      const currentTime = this.screenTimeMap.get(this.currentScreen) || 0;
      this.screenTimeMap.set(this.currentScreen, currentTime + timeSpent);
    }

    const stats: Record<string, number> = {};
    this.screenTimeMap.forEach((time, screen) => {
      stats[screen] = Math.round(time / 1000); // Convert to seconds
    });
    return stats;
  }

  /**
   * Get current session duration in milliseconds
   */
  getSessionDuration(): number {
    if (this.sessionStartTime === 0) return 0;
    return Date.now() - this.sessionStartTime;
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
  async shutdown(): Promise<void> {
    // Record session end
    await this.recordSessionEnd();

    // Remove app state listener
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    await this.flush();
    this.isInitialized = false;
  }

  /**
   * Get device ID for analytics correlation
   */
  getDeviceId(): string | null {
    return this.deviceId;
  }

  /**
   * Get full analytics summary for investor reporting
   */
  async getInvestorMetrics(): Promise<{
    device: DeviceInfo | null;
    engagement: EngagementMetrics;
    activeUsers: {
      dau: number;
      wau: number;
      mau: number;
    };
    currentSession: {
      durationMs: number;
      screenViews: string[];
      screenTimes: Record<string, number>;
    };
  }> {
    const engagement = await this.getEngagementMetrics();
    const activeUsers = await this.getActiveUserMetrics();

    return {
      device: this.deviceInfo,
      engagement,
      activeUsers: {
        dau: activeUsers.dau,
        wau: activeUsers.wau,
        mau: activeUsers.mau,
      },
      currentSession: {
        durationMs: this.getSessionDuration(),
        screenViews: Array.from(this.screenTimeMap.keys()),
        screenTimes: this.getScreenTimeStats(),
      },
    };
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
