import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { format } from 'date-fns';
import * as Location from 'expo-location';
import { useUser, useProfile } from '@/stores/authStore';
import {
  useTripStore,
  useActiveTrip,
  useIsTracking,
  useTrackingMode,
  useCurrentJurisdiction,
  useClearActiveTrip,
} from '@/stores/tripStore';
import { getUserTrips, getMonthlyTripCount, createTrip as createManualTrip, updateTrip } from '@/lib/database';
import { TRACKING_MODES, type TrackingMode } from '@/constants';
import { getJurisdictionName } from '@/constants/jurisdictions';
import {
  requestLocationPermissions,
  startLocationTracking,
  stopLocationTracking,
  updateTrackingMode,
  getDistanceBetweenPoints,
} from '@/services/location/locationService';
import {
  initializeBoundaries,
  detectJurisdictionWithConfidence,
  resetJurisdictionCache,
} from '@/services/location/jurisdictionDetector';
import { supabase } from '@/lib/supabase/client';
import { getTierDetails, type SubscriptionTier } from '@/constants/pricing';
import type { Trip } from '@/types/database.types';

export default function TripScreen() {
  const user = useUser();
  const profile = useProfile();
  const activeTrip = useActiveTrip();
  const isTracking = useIsTracking();
  const trackingMode = useTrackingMode();
  const currentJurisdiction = useCurrentJurisdiction();

  const startTrip = useTripStore((state) => state.startTrip);
  const endTrip = useTripStore((state) => state.endTrip);
  const pauseTrip = useTripStore((state) => state.pauseTrip);
  const resumeTrip = useTripStore((state) => state.resumeTrip);
  const clearActiveTrip = useClearActiveTrip();
  const setTrackingMode = useTripStore((state) => state.setTrackingMode);
  const addPoint = useTripStore((state) => state.addPoint);
  const updateJurisdictionMiles = useTripStore((state) => state.updateJurisdictionMiles);
  const setCurrentJurisdiction = useTripStore((state) => state.setCurrentJurisdiction);
  const activeTripPoints = useTripStore((state) => state.activeTripPoints);
  const activeTripJurisdictionMiles = useTripStore(
    (state) => state.activeTripJurisdictionMiles
  );

  const [loaded, setLoaded] = useState(false);
  const [recentTrips, setRecentTrips] = useState<Trip[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [boundariesReady, setBoundariesReady] = useState(false);
  const [isCreatingManual, setIsCreatingManual] = useState(false);

  // Ref to track last location for distance calculation
  const lastLocationRef = useRef<{ lat: number; lng: number } | null>(null);

  // Initialize jurisdiction boundaries on mount
  useEffect(() => {
    initializeBoundaries()
      .then(() => setBoundariesReady(true))
      .catch((err) => console.error('Failed to initialize boundaries:', err));
  }, []);

  // Location callback handler
  const handleLocationUpdate = useCallback(
    async (location: Location.LocationObject) => {
      const { latitude, longitude } = location.coords;
      const timestamp = new Date(location.timestamp).toISOString();

      // Detect jurisdiction
      const { jurisdiction, confidence } = detectJurisdictionWithConfidence(
        latitude,
        longitude
      );

      // Add point to trip
      await addPoint({
        trip_id: '', // Will be set by store
        lat: latitude,
        lng: longitude,
        ts: timestamp,
        accuracy_m: location.coords.accuracy ?? null,
        speed: location.coords.speed ?? null,
        jurisdiction,
      });

      // Update current jurisdiction in store
      if (jurisdiction) {
        setCurrentJurisdiction(jurisdiction);

        // Calculate distance from last point and update jurisdiction miles
        if (lastLocationRef.current) {
          const distance = getDistanceBetweenPoints(
            lastLocationRef.current.lat,
            lastLocationRef.current.lng,
            latitude,
            longitude
          );

          if (distance > 0.01) {
            // Only count if moved more than ~50 feet
            // Get current miles for this jurisdiction
            const currentMiles =
              activeTripJurisdictionMiles.find((jm) => jm.jurisdiction === jurisdiction)
                ?.miles ?? 0;
            await updateJurisdictionMiles(
              jurisdiction,
              currentMiles + distance,
              confidence
            );
          }
        }
      }

      lastLocationRef.current = { lat: latitude, lng: longitude };
    },
    [addPoint, setCurrentJurisdiction, updateJurisdictionMiles, activeTripJurisdictionMiles]
  );

  const loadRecentTrips = async () => {
    if (!user?.id) return;
    const trips = await getUserTrips(user.id, { limit: 10, status: 'finalized' });
    setRecentTrips(trips);
  };

  useEffect(() => {
    loadRecentTrips();
  }, [user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRecentTrips();
    setRefreshing(false);
  };

  const handleCreateManualTrip = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in to create a trip');
      return;
    }

    // Check subscription limits
    const tier = (profile?.subscription_tier || 'free') as SubscriptionTier;
    const tierDetails = getTierDetails(tier);
    const tripLimit = tierDetails.limits.tripsPerMonth;

    if (tripLimit !== -1) {
      try {
        const tripCount = await getMonthlyTripCount(user.id);
        if (tripCount >= tripLimit) {
          Alert.alert(
            'Trip Limit Reached',
            `Your ${tier} plan allows ${tripLimit} trips per month. Upgrade to Pro for unlimited trips.`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Upgrade',
                onPress: () => router.push('/(tabs)/subscription'),
              },
            ]
          );
          return;
        }
      } catch (error) {
        console.error('Failed to check trip count:', error);
      }
    }

    setIsCreatingManual(true);

    try {
      const now = new Date().toISOString();
      const trip = await createManualTrip(user.id, {
        status: 'finalized',
        loaded: false,
        source: 'manual',
        started_at: now,
        ended_at: now,
      });

      // Navigate to trip detail to add mileage
      router.push(`/(tabs)/trip/${trip.id}`);
      Alert.alert(
        'Manual Trip Created',
        'Tap on "Add State" to enter your mileage by state.',
        [{ text: 'Got it' }]
      );

      // Refresh the list
      await loadRecentTrips();
    } catch (error) {
      console.error('Failed to create manual trip:', error);
      Alert.alert('Error', 'Failed to create trip. Please try again.');
    } finally {
      setIsCreatingManual(false);
    }
  };

  const handleStartTrip = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in to start a trip');
      return;
    }

    // Check subscription limits
    const tier = (profile?.subscription_tier || 'free') as SubscriptionTier;
    const tierDetails = getTierDetails(tier);
    const tripLimit = tierDetails.limits.tripsPerMonth;

    if (tripLimit !== -1) {
      try {
        const tripCount = await getMonthlyTripCount(user.id);
        if (tripCount >= tripLimit) {
          Alert.alert(
            'Trip Limit Reached',
            `Your ${tier} plan allows ${tripLimit} trips per month. Upgrade to Pro for unlimited trips.`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Upgrade',
                onPress: () => router.push('/(tabs)/subscription'),
              },
            ]
          );
          return;
        }
      } catch (error) {
        console.error('Failed to check trip count:', error);
      }
    }

    setIsStarting(true);

    try {
      // Request location permissions
      const permissions = await requestLocationPermissions();

      if (!permissions.foreground) {
        Alert.alert(
          'Location Permission Required',
          'RoadLedger needs location access to track your trips and calculate mileage by state. Please enable location access in your device settings.',
          [{ text: 'OK' }]
        );
        setIsStarting(false);
        return;
      }

      if (!permissions.background) {
        Alert.alert(
          'Background Location Recommended',
          'For accurate tracking, please enable "Always" location access. Without it, tracking may stop when the app is in the background.',
          [{ text: 'Continue Anyway' }]
        );
      }

      // Reset jurisdiction cache for new trip
      resetJurisdictionCache();
      lastLocationRef.current = null;

      // Create trip in database
      await startTrip(user.id, loaded);

      // Start location tracking
      const trackingStarted = await startLocationTracking(
        trackingMode,
        handleLocationUpdate
      );

      if (!trackingStarted) {
        Alert.alert(
          'Tracking Issue',
          'Trip created but GPS tracking could not start. Your mileage may not be recorded.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Trip Started', 'Your trip is now being tracked.');
      }
    } catch (error) {
      console.error('Failed to start trip:', error);
      Alert.alert('Error', 'Failed to start trip. Please try again.');
    } finally {
      setIsStarting(false);
    }
  };

  const handleEndTrip = async () => {
    Alert.alert(
      'End Trip',
      'Are you sure you want to end this trip?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Trip',
          style: 'destructive',
          onPress: async () => {
            if (!activeTrip) return;
            setIsEnding(true);

            try {
              // Stop location tracking
              await stopLocationTracking();

              // End trip in database
              await endTrip();

              // Call trip-finalize edge function to calculate final mileage
              try {
                const { data: session } = await supabase.auth.getSession();
                if (session?.session?.access_token) {
                  const response = await fetch(
                    `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/trip-finalize`,
                    {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${session.session.access_token}`,
                      },
                      body: JSON.stringify({ trip_id: activeTrip.id }),
                    }
                  );

                  if (!response.ok) {
                    console.warn('Trip finalization returned non-OK status');
                  }
                }
              } catch (finalizeError) {
                // Don't block trip ending if finalization fails
                console.error('Trip finalization error:', finalizeError);
              }

              Alert.alert('Trip Ended', 'Your trip has been saved and mileage calculated.');
              loadRecentTrips();
            } catch (error) {
              console.error('Failed to end trip:', error);
              Alert.alert('Error', 'Failed to end trip. Please try again.');
            } finally {
              setIsEnding(false);
            }
          },
        },
      ]
    );
  };

  const handlePauseTrip = async () => {
    try {
      // Stop location tracking when paused
      await stopLocationTracking();
      await pauseTrip();
      Alert.alert('Trip Paused', 'GPS tracking has been paused.');
    } catch (error) {
      Alert.alert('Error', 'Failed to pause trip.');
    }
  };

  const handleResumeTrip = async () => {
    try {
      await resumeTrip();
      // Resume location tracking
      const trackingStarted = await startLocationTracking(
        trackingMode,
        handleLocationUpdate
      );
      if (trackingStarted) {
        Alert.alert('Trip Resumed', 'GPS tracking has resumed.');
      } else {
        Alert.alert('Warning', 'Trip resumed but GPS tracking could not restart.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to resume trip.');
    }
  };

  const toggleTrackingMode = async () => {
    const newMode: TrackingMode =
      trackingMode === 'precision' ? 'battery_saver' : 'precision';
    setTrackingMode(newMode);

    // If actively tracking, update the GPS service with new mode
    if (isTracking && activeTrip) {
      await updateTrackingMode(newMode, handleLocationUpdate);
    }
  };

  const totalMiles = activeTripJurisdictionMiles.reduce(
    (sum, jm) => sum + jm.miles,
    0
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#4f46e5"
        />
      }
    >
      {/* Active Trip Section */}
      {activeTrip ? (
        <View style={styles.activeTripSection}>
          <View style={styles.tripStatus}>
            <View style={[styles.statusIndicator, isTracking && styles.tracking]} />
            <Text style={styles.statusText}>
              {isTracking ? 'Tracking' : 'Paused'}
            </Text>
          </View>

          <View style={styles.tripStats}>
            <View style={styles.statBlock}>
              <Text style={styles.statNumber}>{totalMiles.toFixed(1)}</Text>
              <Text style={styles.statLabel}>Miles</Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={styles.statNumber}>{activeTripPoints.length}</Text>
              <Text style={styles.statLabel}>Points</Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={styles.statNumber}>
                {currentJurisdiction
                  ? getJurisdictionName(currentJurisdiction)
                  : '--'}
              </Text>
              <Text style={styles.statLabel}>Current State</Text>
            </View>
          </View>

          <Text style={styles.tripStarted}>
            Started: {format(new Date(activeTrip.started_at), 'MMM d, h:mm a')}
          </Text>

          {/* Jurisdiction Breakdown */}
          {activeTripJurisdictionMiles.length > 0 && (
            <View style={styles.jurisdictionSection}>
              <Text style={styles.jurisdictionTitle}>Miles by State</Text>
              {activeTripJurisdictionMiles.map((jm) => (
                <View key={jm.jurisdiction} style={styles.jurisdictionRow}>
                  <Text style={styles.jurisdictionName}>
                    {getJurisdictionName(jm.jurisdiction)}
                  </Text>
                  <Text style={styles.jurisdictionMiles}>
                    {jm.miles.toFixed(1)} mi
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Trip Controls */}
          <View style={styles.controls}>
            {isTracking ? (
              <>
                <TouchableOpacity
                  style={styles.pauseButton}
                  onPress={handlePauseTrip}
                >
                  <Text style={styles.pauseButtonText}>Pause</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.endButton}
                  onPress={handleEndTrip}
                >
                  <Text style={styles.endButtonText}>End Trip</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.resumeButton}
                  onPress={handleResumeTrip}
                >
                  <Text style={styles.resumeButtonText}>Resume</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.endButton}
                  onPress={handleEndTrip}
                >
                  <Text style={styles.endButtonText}>End Trip</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Abandon Trip Option (for orphaned trips) */}
          {!isTracking && (
            <TouchableOpacity
              style={styles.abandonButton}
              onPress={() => {
                Alert.alert(
                  'Abandon Trip?',
                  'This will delete this trip without saving. Are you sure?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Abandon',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await stopLocationTracking();
                          clearActiveTrip();
                          Alert.alert('Trip Abandoned', 'You can now start a new trip.');
                        } catch (error) {
                          Alert.alert('Error', 'Failed to abandon trip.');
                        }
                      },
                    },
                  ]
                );
              }}
            >
              <Text style={styles.abandonButtonText}>Abandon & Start Fresh</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        /* Start New Trip */
        <View style={styles.startTripSection}>
          <Text style={styles.sectionTitle}>Start a New Trip</Text>

          {/* Tracking Mode Toggle */}
          <View style={styles.modeToggle}>
            <View style={styles.modeInfo}>
              <Text style={styles.modeLabel}>
                {TRACKING_MODES[trackingMode].label}
              </Text>
              <Text style={styles.modeDescription}>
                {TRACKING_MODES[trackingMode].description}
              </Text>
            </View>
            <Switch
              value={trackingMode === 'precision'}
              onValueChange={toggleTrackingMode}
              trackColor={{ false: '#3d3d5c', true: '#4f46e5' }}
              thumbColor="#fff"
            />
          </View>

          {/* Loaded Toggle */}
          <View style={styles.loadedToggle}>
            <Text style={styles.loadedLabel}>Loaded (with freight)</Text>
            <Switch
              value={loaded}
              onValueChange={setLoaded}
              trackColor={{ false: '#3d3d5c', true: '#4f46e5' }}
              thumbColor="#fff"
            />
          </View>

          <TouchableOpacity
            style={[styles.startButton, isStarting && styles.buttonDisabled]}
            onPress={handleStartTrip}
            disabled={isStarting}
          >
            {isStarting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.startButtonText}>Start Trip</Text>
            )}
          </TouchableOpacity>

          {/* Manual Trip Entry */}
          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.divider} />
          </View>

          <TouchableOpacity
            style={[styles.manualButton, isCreatingManual && styles.buttonDisabled]}
            onPress={handleCreateManualTrip}
            disabled={isCreatingManual}
            accessibilityLabel="Log manual trip"
            accessibilityRole="button"
          >
            {isCreatingManual ? (
              <ActivityIndicator color="#4f46e5" />
            ) : (
              <>
                <Text style={styles.manualButtonText}>Log Manual Trip</Text>
                <Text style={styles.manualButtonHint}>Enter miles without GPS tracking</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Recent Trips */}
      <View style={styles.recentSection}>
        <Text style={styles.sectionTitle}>Recent Trips</Text>
        {recentTrips.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No completed trips yet</Text>
          </View>
        ) : (
          recentTrips.map((trip) => (
            <TouchableOpacity
              key={trip.id}
              style={styles.tripCard}
              onPress={() => router.push(`/(tabs)/trip/${trip.id}`)}
            >
              <View style={styles.tripCardContent}>
                <Text style={styles.tripDate}>
                  {format(new Date(trip.started_at), 'MMM d, yyyy')}
                </Text>
                <Text style={styles.tripMiles}>
                  {trip.auto_miles_total?.toFixed(1) || '0'} miles
                </Text>
              </View>
              <View style={styles.tripCardBadge}>
                <Text style={styles.tripCardBadgeText}>
                  {trip.loaded ? 'Loaded' : 'Empty'}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  activeTripSection: {
    backgroundColor: '#2d2d44',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  tripStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fbbf24',
    marginRight: 8,
  },
  tracking: {
    backgroundColor: '#22c55e',
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  tripStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statBlock: {
    alignItems: 'center',
  },
  statNumber: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  tripStarted: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
  },
  jurisdictionSection: {
    borderTopWidth: 1,
    borderTopColor: '#3d3d5c',
    paddingTop: 16,
    marginBottom: 16,
  },
  jurisdictionTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  jurisdictionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  jurisdictionName: {
    color: '#ccc',
    fontSize: 14,
  },
  jurisdictionMiles: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  controls: {
    flexDirection: 'row',
    gap: 12,
  },
  pauseButton: {
    flex: 1,
    backgroundColor: '#3d3d5c',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  pauseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resumeButton: {
    flex: 1,
    backgroundColor: '#4f46e5',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  resumeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  endButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  endButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  abandonButton: {
    marginTop: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3d3d5c',
    borderRadius: 8,
  },
  abandonButtonText: {
    color: '#888',
    fontSize: 14,
  },
  startTripSection: {
    backgroundColor: '#2d2d44',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  modeToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#3d3d5c',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  modeInfo: {
    flex: 1,
  },
  modeLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  modeDescription: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  loadedToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#3d3d5c',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  loadedLabel: {
    color: '#fff',
    fontSize: 16,
  },
  startButton: {
    backgroundColor: '#4f46e5',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  recentSection: {
    marginTop: 8,
  },
  emptyState: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: '#888',
    fontSize: 14,
  },
  tripCard: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tripCardContent: {
    flex: 1,
  },
  tripDate: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  tripMiles: {
    color: '#888',
    fontSize: 14,
    marginTop: 2,
  },
  tripCardBadge: {
    backgroundColor: '#3d3d5c',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tripCardBadgeText: {
    color: '#888',
    fontSize: 12,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#3d3d5c',
  },
  dividerText: {
    color: '#666',
    fontSize: 12,
    marginHorizontal: 12,
  },
  manualButton: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4f46e5',
    minHeight: 60,
    justifyContent: 'center',
  },
  manualButtonText: {
    color: '#4f46e5',
    fontSize: 16,
    fontWeight: '600',
  },
  manualButtonHint: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
});
