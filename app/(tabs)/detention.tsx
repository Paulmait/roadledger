import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { format } from 'date-fns';
import { useUser } from '@/stores/authStore';
import {
  createDetentionEvent,
  getActiveDetentionEvent,
  getUserDetentionEvents,
  completeDetentionEvent,
  updateDetentionEvent,
  type DetentionEvent,
} from '@/lib/database';

const COLORS = {
  background: '#0D1B2A',
  surface: '#1B2838',
  surfaceLight: '#243447',
  primary: '#4f46e5',
  secondary: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  text: '#FFFFFF',
  textSecondary: '#8892A0',
};

export default function DetentionScreen() {
  const user = useUser();
  const [activeEvent, setActiveEvent] = useState<DetentionEvent | null>(null);
  const [recentEvents, setRecentEvents] = useState<DetentionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);

  // Form state
  const [locationType, setLocationType] = useState<'pickup' | 'delivery'>('pickup');
  const [facilityName, setFacilityName] = useState('');

  // Timer state
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async () => {
    if (!user?.id) return;

    try {
      const active = await getActiveDetentionEvent(user.id);
      setActiveEvent(active);

      const events = await getUserDetentionEvents(user.id, { limit: 10 });
      setRecentEvents(events.filter((e) => e.status === 'completed'));
    } catch (error) {
      console.error('Failed to load detention data:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Timer effect
  useEffect(() => {
    if (activeEvent) {
      const updateTimer = () => {
        const arrivedTime = new Date(activeEvent.arrived_at).getTime();
        const now = Date.now();
        setElapsedTime(Math.floor((now - arrivedTime) / 1000));
      };

      updateTimer();
      timerRef.current = setInterval(updateTimer, 1000);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    } else {
      setElapsedTime(0);
    }
  }, [activeEvent]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const handleStartDetention = async () => {
    if (!user?.id) return;

    setStarting(true);
    try {
      const event = await createDetentionEvent(user.id, {
        location_type: locationType,
        facility_name: facilityName.trim() || null,
        arrived_at: new Date().toISOString(),
        status: 'active',
      });

      setActiveEvent(event);
      setFacilityName('');
      Alert.alert('Timer Started', 'Detention tracking has begun. Free time is 2 hours.');
    } catch (error) {
      console.error('Failed to start detention:', error);
      Alert.alert('Error', 'Failed to start detention tracking.');
    } finally {
      setStarting(false);
    }
  };

  const handleStopDetention = async () => {
    if (!activeEvent) return;

    Alert.alert(
      'End Detention',
      'Stop the detention timer and calculate billable time?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop Timer',
          onPress: async () => {
            setStopping(true);
            try {
              const completedEvent = await completeDetentionEvent(activeEvent.id);
              setActiveEvent(null);
              await loadData();

              if (completedEvent && completedEvent.billable_minutes && completedEvent.billable_minutes > 0) {
                Alert.alert(
                  'Detention Complete',
                  `Billable time: ${formatDuration(completedEvent.billable_minutes)}\n` +
                    `Detention pay: $${completedEvent.total_detention_pay?.toFixed(2) || '0.00'}`
                );
              } else {
                Alert.alert('Detention Complete', 'No billable time (within free time period).');
              }
            } catch (error) {
              console.error('Failed to stop detention:', error);
              Alert.alert('Error', 'Failed to complete detention tracking.');
            } finally {
              setStopping(false);
            }
          },
        },
      ]
    );
  };

  const handleMarkLoading = async () => {
    if (!activeEvent) return;

    try {
      await updateDetentionEvent(activeEvent.id, {
        loading_started_at: new Date().toISOString(),
      });
      await loadData();
      Alert.alert('Marked', 'Loading/unloading has started.');
    } catch (error) {
      console.error('Failed to mark loading:', error);
    }
  };

  // Calculate billable status for active event
  const elapsedMinutes = Math.floor(elapsedTime / 60);
  const freeTimeMinutes = activeEvent?.free_time_minutes ?? 120;
  const isBillable = elapsedMinutes > freeTimeMinutes;
  const billableMinutes = Math.max(0, elapsedMinutes - freeTimeMinutes);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Detention Tracker</Text>
      <Text style={styles.subtitle}>Track wait time at shippers & receivers</Text>

      {activeEvent ? (
        /* Active Detention Timer */
        <View style={styles.activeSection}>
          <View style={styles.timerCard}>
            <Text style={styles.timerLabel}>Time at Facility</Text>
            <Text style={[styles.timer, isBillable && styles.timerBillable]}>
              {formatTime(elapsedTime)}
            </Text>

            {isBillable ? (
              <View style={styles.billableAlert}>
                <Text style={styles.billableAlertText}>
                  Billable: {formatDuration(billableMinutes)} @ ${activeEvent.hourly_rate}/hr
                </Text>
                <Text style={styles.billableAmount}>
                  ${((billableMinutes / 60) * activeEvent.hourly_rate).toFixed(2)}
                </Text>
              </View>
            ) : (
              <Text style={styles.freeTimeText}>
                Free time remaining: {formatDuration(freeTimeMinutes - elapsedMinutes)}
              </Text>
            )}
          </View>

          <View style={styles.facilityInfo}>
            <Text style={styles.facilityLabel}>
              {activeEvent.location_type === 'pickup' ? 'Pickup' : 'Delivery'}
            </Text>
            {activeEvent.facility_name && (
              <Text style={styles.facilityName}>{activeEvent.facility_name}</Text>
            )}
            <Text style={styles.arrivedTime}>
              Arrived: {format(new Date(activeEvent.arrived_at), 'h:mm a')}
            </Text>
            {activeEvent.loading_started_at && (
              <Text style={styles.loadingTime}>
                Loading started: {format(new Date(activeEvent.loading_started_at), 'h:mm a')}
              </Text>
            )}
          </View>

          <View style={styles.activeActions}>
            {!activeEvent.loading_started_at && (
              <TouchableOpacity style={styles.markLoadingButton} onPress={handleMarkLoading}>
                <Text style={styles.markLoadingText}>Mark Loading Started</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.stopButton, stopping && styles.buttonDisabled]}
              onPress={handleStopDetention}
              disabled={stopping}
            >
              {stopping ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.stopButtonText}>Stop Timer & Calculate</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* Start New Detention */
        <View style={styles.startSection}>
          <Text style={styles.sectionTitle}>Start Detention Timer</Text>

          <View style={styles.typeSelector}>
            <TouchableOpacity
              style={[styles.typeButton, locationType === 'pickup' && styles.typeButtonActive]}
              onPress={() => setLocationType('pickup')}
            >
              <Text
                style={[styles.typeButtonText, locationType === 'pickup' && styles.typeButtonTextActive]}
              >
                Pickup
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, locationType === 'delivery' && styles.typeButtonActive]}
              onPress={() => setLocationType('delivery')}
            >
              <Text
                style={[styles.typeButtonText, locationType === 'delivery' && styles.typeButtonTextActive]}
              >
                Delivery
              </Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Facility name (optional)"
            placeholderTextColor={COLORS.textSecondary}
            value={facilityName}
            onChangeText={setFacilityName}
          />

          <TouchableOpacity
            style={[styles.startButton, starting && styles.buttonDisabled]}
            onPress={handleStartDetention}
            disabled={starting}
          >
            {starting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.startButtonText}>Start Timer (I've Arrived)</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.freeTimeNote}>
            Standard free time: 2 hours. Billing starts at $50/hr after.
          </Text>
        </View>
      )}

      {/* Recent Detention Events */}
      <View style={styles.recentSection}>
        <Text style={styles.sectionTitle}>Recent Detention Events</Text>

        {recentEvents.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No completed detention events yet</Text>
          </View>
        ) : (
          recentEvents.map((event) => (
            <View key={event.id} style={styles.eventCard}>
              <View style={styles.eventHeader}>
                <Text style={styles.eventType}>
                  {event.location_type === 'pickup' ? 'Pickup' : 'Delivery'}
                </Text>
                <Text style={styles.eventDate}>
                  {format(new Date(event.arrived_at), 'MMM d, yyyy')}
                </Text>
              </View>

              {event.facility_name && (
                <Text style={styles.eventFacility}>{event.facility_name}</Text>
              )}

              <View style={styles.eventStats}>
                <View style={styles.eventStat}>
                  <Text style={styles.eventStatLabel}>Total Time</Text>
                  <Text style={styles.eventStatValue}>
                    {event.billable_minutes !== null
                      ? formatDuration(event.billable_minutes + event.free_time_minutes)
                      : '--'}
                  </Text>
                </View>
                <View style={styles.eventStat}>
                  <Text style={styles.eventStatLabel}>Billable</Text>
                  <Text style={styles.eventStatValue}>
                    {event.billable_minutes !== null ? formatDuration(event.billable_minutes) : '--'}
                  </Text>
                </View>
                <View style={styles.eventStat}>
                  <Text style={styles.eventStatLabel}>Pay</Text>
                  <Text style={[styles.eventStatValue, styles.payValue]}>
                    ${event.total_detention_pay?.toFixed(2) || '0.00'}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
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
    paddingTop: 60,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  title: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: 24,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  // Active Section
  activeSection: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: COLORS.warning,
  },
  timerCard: {
    alignItems: 'center',
    marginBottom: 20,
  },
  timerLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: 8,
  },
  timer: {
    color: COLORS.text,
    fontSize: 48,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  timerBillable: {
    color: COLORS.secondary,
  },
  billableAlert: {
    backgroundColor: COLORS.secondary + '20',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    alignItems: 'center',
  },
  billableAlertText: {
    color: COLORS.secondary,
    fontSize: 14,
    fontWeight: '500',
  },
  billableAmount: {
    color: COLORS.secondary,
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 4,
  },
  freeTimeText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 8,
  },
  facilityInfo: {
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceLight,
    paddingTop: 16,
    marginBottom: 16,
  },
  facilityLabel: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  facilityName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  arrivedTime: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  loadingTime: {
    color: COLORS.secondary,
    fontSize: 14,
    marginTop: 4,
  },
  activeActions: {
    gap: 12,
  },
  markLoadingButton: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  markLoadingText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  stopButton: {
    backgroundColor: COLORS.danger,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  stopButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Start Section
  startSection: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  typeButton: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: COLORS.primary,
  },
  typeButtonText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  input: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 12,
    padding: 16,
    color: COLORS.text,
    fontSize: 16,
    marginBottom: 16,
  },
  startButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  startButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  freeTimeNote: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  // Recent Section
  recentSection: {
    marginTop: 8,
  },
  emptyState: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  eventCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventType: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  eventDate: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  eventFacility: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
  },
  eventStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  eventStat: {
    alignItems: 'center',
  },
  eventStatLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginBottom: 4,
  },
  eventStatValue: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  payValue: {
    color: COLORS.secondary,
  },
});
