import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { format } from 'date-fns';
import { useUser } from '@/stores/authStore';
import {
  useTripStore,
  useActiveTrip,
  useIsTracking,
  useTrackingMode,
  useCurrentJurisdiction,
} from '@/stores/tripStore';
import { getUserTrips } from '@/lib/database';
import { TRACKING_MODES, type TrackingMode } from '@/constants';
import { getJurisdictionName } from '@/constants/jurisdictions';
import type { Trip } from '@/types/database.types';

export default function TripScreen() {
  const user = useUser();
  const activeTrip = useActiveTrip();
  const isTracking = useIsTracking();
  const trackingMode = useTrackingMode();
  const currentJurisdiction = useCurrentJurisdiction();

  const startTrip = useTripStore((state) => state.startTrip);
  const endTrip = useTripStore((state) => state.endTrip);
  const pauseTrip = useTripStore((state) => state.pauseTrip);
  const resumeTrip = useTripStore((state) => state.resumeTrip);
  const setTrackingMode = useTripStore((state) => state.setTrackingMode);
  const activeTripPoints = useTripStore((state) => state.activeTripPoints);
  const activeTripJurisdictionMiles = useTripStore(
    (state) => state.activeTripJurisdictionMiles
  );

  const [loaded, setLoaded] = useState(false);
  const [recentTrips, setRecentTrips] = useState<Trip[]>([]);
  const [refreshing, setRefreshing] = useState(false);

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

  const handleStartTrip = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in to start a trip');
      return;
    }

    try {
      await startTrip(user.id, loaded);
      // Note: Location tracking would be started here via the location service
      Alert.alert('Trip Started', 'Your trip is now being tracked.');
    } catch (error) {
      Alert.alert('Error', 'Failed to start trip. Please try again.');
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
            try {
              await endTrip();
              Alert.alert('Trip Ended', 'Your trip has been saved.');
              loadRecentTrips();
            } catch (error) {
              Alert.alert('Error', 'Failed to end trip. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handlePauseTrip = async () => {
    try {
      await pauseTrip();
    } catch (error) {
      Alert.alert('Error', 'Failed to pause trip.');
    }
  };

  const handleResumeTrip = async () => {
    try {
      await resumeTrip();
    } catch (error) {
      Alert.alert('Error', 'Failed to resume trip.');
    }
  };

  const toggleTrackingMode = () => {
    const newMode: TrackingMode =
      trackingMode === 'precision' ? 'battery_saver' : 'precision';
    setTrackingMode(newMode);
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
            style={styles.startButton}
            onPress={handleStartTrip}
          >
            <Text style={styles.startButtonText}>Start Trip</Text>
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
});
