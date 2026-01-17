// RoadLedger Push Notification Service
// IFTA deadlines, payment alerts, fuel prices, trip reminders

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface ScheduledNotification {
  id: string;
  title: string;
  body: string;
  trigger: Date;
  data?: Record<string, unknown>;
}

// IFTA quarterly deadlines (last day of month following quarter end)
const IFTA_DEADLINES = {
  Q1: { month: 3, day: 31 }, // April 30 for Jan-Mar
  Q2: { month: 6, day: 30 }, // July 31 for Apr-Jun
  Q3: { month: 9, day: 31 }, // October 31 for Jul-Sep
  Q4: { month: 0, day: 31 }, // January 31 (next year) for Oct-Dec
};

class NotificationService {
  private expoPushToken: string | null = null;
  private notificationListener: Notifications.Subscription | null = null;
  private responseListener: Notifications.Subscription | null = null;

  /**
   * Initialize notification service and request permissions
   */
  async initialize(): Promise<string | null> {
    if (!Device.isDevice) {
      console.log('Push notifications require a physical device');
      return null;
    }

    // Check existing permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permission if not granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission denied');
      return null;
    }

    // Get push token
    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      const token = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
      this.expoPushToken = token.data;

      // Configure Android channel
      if (Platform.OS === 'android') {
        Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#2ECC71',
        });

        Notifications.setNotificationChannelAsync('ifta', {
          name: 'IFTA Reminders',
          importance: Notifications.AndroidImportance.HIGH,
          description: 'Quarterly IFTA filing deadline reminders',
        });

        Notifications.setNotificationChannelAsync('payments', {
          name: 'Payment Alerts',
          importance: Notifications.AndroidImportance.HIGH,
          description: 'Payment received and overdue notifications',
        });

        Notifications.setNotificationChannelAsync('fuel', {
          name: 'Fuel Prices',
          importance: Notifications.AndroidImportance.DEFAULT,
          description: 'Fuel price alerts and optimization tips',
        });
      }

      return this.expoPushToken;
    } catch (error) {
      console.error('Failed to get push token:', error);
      return null;
    }
  }

  /**
   * Save push token to database
   */
  async savePushToken(userId: string): Promise<void> {
    if (!this.expoPushToken) return;

    try {
      await supabase.from('notification_preferences').upsert({
        user_id: userId,
        push_token: this.expoPushToken,
      });
    } catch (error) {
      console.error('Failed to save push token:', error);
    }
  }

  /**
   * Set up notification listeners
   */
  setupListeners(
    onNotification?: (notification: Notifications.Notification) => void,
    onResponse?: (response: Notifications.NotificationResponse) => void
  ): void {
    // Listen for incoming notifications
    this.notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('Notification received:', notification);
        onNotification?.(notification);
      }
    );

    // Listen for notification taps
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log('Notification tapped:', response);
        onResponse?.(response);
      }
    );
  }

  /**
   * Remove notification listeners
   */
  removeListeners(): void {
    if (this.notificationListener) {
      this.notificationListener.remove();
    }
    if (this.responseListener) {
      this.responseListener.remove();
    }
  }

  /**
   * Schedule IFTA deadline reminders
   */
  async scheduleIFTAReminders(daysBefore: number = 7): Promise<void> {
    const now = new Date();
    const currentYear = now.getFullYear();

    // Cancel existing IFTA notifications
    await this.cancelNotificationsByTag('ifta');

    // Schedule reminders for each quarter
    for (const [quarter, deadline] of Object.entries(IFTA_DEADLINES)) {
      let deadlineDate = new Date(currentYear, deadline.month, deadline.day);

      // If Q4, deadline is in January of next year
      if (quarter === 'Q4') {
        deadlineDate = new Date(currentYear + 1, 0, 31);
      }

      // If deadline has passed, schedule for next year
      if (deadlineDate < now) {
        deadlineDate.setFullYear(deadlineDate.getFullYear() + 1);
      }

      // Calculate reminder date
      const reminderDate = new Date(deadlineDate);
      reminderDate.setDate(reminderDate.getDate() - daysBefore);

      // Only schedule if reminder is in the future
      if (reminderDate > now) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `IFTA ${quarter} Filing Due Soon`,
            body: `Your IFTA quarterly report for ${quarter} is due on ${deadlineDate.toLocaleDateString()}. File now to avoid penalties.`,
            data: { type: 'ifta', quarter },
            categoryIdentifier: 'ifta',
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: reminderDate,
            channelId: 'ifta',
          },
        });
      }
    }
  }

  /**
   * Schedule trip end reminder
   */
  async scheduleTripReminder(tripId: string, hoursAfterStart: number = 14): Promise<string> {
    const trigger = new Date();
    trigger.setHours(trigger.getHours() + hoursAfterStart);

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Trip Still Active',
        body: "Don't forget to end your trip to save your mileage data.",
        data: { type: 'trip_reminder', tripId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: trigger,
      },
    });

    return id;
  }

  /**
   * Send immediate notification
   */
  async sendLocalNotification(
    title: string,
    body: string,
    data?: Record<string, unknown>
  ): Promise<string> {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
      },
      trigger: null, // Immediate
    });

    return id;
  }

  /**
   * Schedule daily profit summary
   */
  async scheduleDailySummary(hour: number = 20, minute: number = 0): Promise<void> {
    // Cancel existing daily summary
    await this.cancelNotificationsByTag('daily_summary');

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Today's Earnings Summary",
        body: 'Tap to view your daily profit breakdown.',
        data: { type: 'daily_summary' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
  }

  /**
   * Cancel notifications by data tag
   */
  async cancelNotificationsByTag(tag: string): Promise<void> {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();

    for (const notification of scheduled) {
      if (notification.content.data?.type === tag) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }
  }

  /**
   * Cancel a specific notification
   */
  async cancelNotification(id: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(id);
  }

  /**
   * Cancel all notifications
   */
  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  /**
   * Get all scheduled notifications
   */
  async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    return Notifications.getAllScheduledNotificationsAsync();
  }

  /**
   * Get badge count
   */
  async getBadgeCount(): Promise<number> {
    return Notifications.getBadgeCountAsync();
  }

  /**
   * Set badge count
   */
  async setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
  }

  /**
   * Get push token
   */
  getToken(): string | null {
    return this.expoPushToken;
  }

  /**
   * Schedule subscription renewal reminder
   * @param expiryDate - When the subscription expires
   * @param daysBefore - Days before expiry to send reminder
   */
  async scheduleRenewalReminder(expiryDate: Date, daysBefore: number = 3): Promise<void> {
    // Cancel existing renewal reminders
    await this.cancelNotificationsByTag('subscription_renewal');

    const reminderDate = new Date(expiryDate);
    reminderDate.setDate(reminderDate.getDate() - daysBefore);

    // Only schedule if reminder is in the future
    if (reminderDate > new Date()) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Subscription Renewing Soon',
          body: `Your RoadLedger subscription will automatically renew on ${expiryDate.toLocaleDateString()}. Manage your subscription in Settings.`,
          data: { type: 'subscription_renewal' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminderDate,
          channelId: 'payments',
        },
      });
    }
  }

  /**
   * Schedule subscription expiry warning (for cancelled subscriptions)
   * @param expiryDate - When access expires
   */
  async scheduleExpiryWarning(expiryDate: Date): Promise<void> {
    // Cancel existing expiry warnings
    await this.cancelNotificationsByTag('subscription_expiry');

    // 7 days before
    const weekBefore = new Date(expiryDate);
    weekBefore.setDate(weekBefore.getDate() - 7);

    if (weekBefore > new Date()) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Subscription Ending Soon',
          body: 'Your Pro access expires in 7 days. Renew now to keep unlimited trips and IFTA reports.',
          data: { type: 'subscription_expiry', action: 'renew' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: weekBefore,
          channelId: 'payments',
        },
      });
    }

    // 1 day before
    const dayBefore = new Date(expiryDate);
    dayBefore.setDate(dayBefore.getDate() - 1);

    if (dayBefore > new Date()) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Last Day of Pro Access',
          body: 'Your Pro subscription expires tomorrow. Renew now to avoid losing your unlimited features.',
          data: { type: 'subscription_expiry', action: 'renew', urgent: true },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: dayBefore,
          channelId: 'payments',
        },
      });
    }
  }

  /**
   * Send usage limit warning notification
   * @param limitType - Type of limit being approached
   * @param remaining - Number remaining
   */
  async sendUsageLimitWarning(
    limitType: 'trips' | 'documents' | 'insights',
    remaining: number
  ): Promise<string> {
    const messages = {
      trips: {
        title: remaining > 0 ? 'Trip Limit Warning' : 'Trip Limit Reached',
        body: remaining > 0
          ? `You have ${remaining} free trip${remaining === 1 ? '' : 's'} remaining this month. Upgrade to Pro for unlimited trips.`
          : 'You\'ve used all your free trips this month. Upgrade to Pro to keep tracking.',
      },
      documents: {
        title: remaining > 0 ? 'Document Limit Warning' : 'Document Limit Reached',
        body: remaining > 0
          ? `You have ${remaining} free document upload${remaining === 1 ? '' : 's'} remaining. Upgrade for unlimited AI scanning.`
          : 'You\'ve reached your document upload limit. Upgrade to Pro for unlimited uploads.',
      },
      insights: {
        title: remaining > 0 ? 'AI Insights Running Low' : 'AI Insights Limit Reached',
        body: remaining > 0
          ? `${remaining} AI insight${remaining === 1 ? '' : 's'} remaining. Upgrade to Premium for unlimited insights.`
          : 'You\'ve used all your AI insights. Upgrade to Premium for unlimited AI-powered analysis.',
      },
    };

    const { title, body } = messages[limitType];

    return this.sendLocalNotification(title, body, {
      type: 'usage_warning',
      limitType,
      remaining,
    });
  }

  /**
   * Send payment success notification
   */
  async sendPaymentSuccessNotification(tier: string): Promise<string> {
    return this.sendLocalNotification(
      'Welcome to RoadLedger ' + tier.charAt(0).toUpperCase() + tier.slice(1) + '!',
      'Your subscription is now active. Enjoy unlimited features!',
      { type: 'payment_success', tier }
    );
  }

  /**
   * Send payment failed notification
   */
  async sendPaymentFailedNotification(): Promise<string> {
    return this.sendLocalNotification(
      'Payment Issue',
      'We couldn\'t process your payment. Please update your payment method to continue your subscription.',
      { type: 'payment_failed', action: 'update_payment' }
    );
  }
}

export const notificationService = new NotificationService();
