import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { format } from 'date-fns';
import { getTripById, getTripPoints, getJurisdictionMiles } from '@/lib/database';
import { getJurisdictionName } from '@/constants/jurisdictions';
import type { Trip, TripPoint, JurisdictionMiles } from '@/types/database.types';

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [points, setPoints] = useState<TripPoint[]>([]);
  const [jurisdictionMiles, setJurisdictionMiles] = useState<JurisdictionMiles[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTrip() {
      if (!id) return;

      try {
        const tripData = await getTripById(id);
        const pointsData = await getTripPoints(id);
        const milesData = await getJurisdictionMiles(id);

        setTrip(tripData);
        setPoints(pointsData);
        setJurisdictionMiles(milesData);
      } catch (error) {
        console.error('Failed to load trip:', error);
      } finally {
        setLoading(false);
      }
    }

    loadTrip();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Trip not found</Text>
      </View>
    );
  }

  const totalMiles = jurisdictionMiles.reduce((sum, jm) => sum + jm.miles, 0);
  const duration = trip.ended_at
    ? new Date(trip.ended_at).getTime() - new Date(trip.started_at).getTime()
    : 0;
  const hours = Math.floor(duration / (1000 * 60 * 60));
  const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Trip Header */}
      <View style={styles.header}>
        <Text style={styles.date}>
          {format(new Date(trip.started_at), 'EEEE, MMMM d, yyyy')}
        </Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{trip.status}</Text>
        </View>
      </View>

      {/* Summary Stats */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{totalMiles.toFixed(1)}</Text>
          <Text style={styles.statLabel}>Total Miles</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {hours}h {minutes}m
          </Text>
          <Text style={styles.statLabel}>Duration</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{points.length}</Text>
          <Text style={styles.statLabel}>GPS Points</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{trip.loaded ? 'Yes' : 'No'}</Text>
          <Text style={styles.statLabel}>Loaded</Text>
        </View>
      </View>

      {/* Trip Times */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trip Times</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Started</Text>
          <Text style={styles.infoValue}>
            {format(new Date(trip.started_at), 'h:mm a')}
          </Text>
        </View>
        {trip.ended_at && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Ended</Text>
            <Text style={styles.infoValue}>
              {format(new Date(trip.ended_at), 'h:mm a')}
            </Text>
          </View>
        )}
      </View>

      {/* Jurisdiction Miles (IFTA) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Miles by State (IFTA)</Text>
        {jurisdictionMiles.length === 0 ? (
          <Text style={styles.emptyText}>No jurisdiction data recorded</Text>
        ) : (
          jurisdictionMiles
            .sort((a, b) => b.miles - a.miles)
            .map((jm) => (
              <View key={jm.jurisdiction} style={styles.jurisdictionRow}>
                <View style={styles.jurisdictionInfo}>
                  <Text style={styles.jurisdictionCode}>{jm.jurisdiction}</Text>
                  <Text style={styles.jurisdictionName}>
                    {getJurisdictionName(jm.jurisdiction)}
                  </Text>
                </View>
                <View style={styles.jurisdictionMilesContainer}>
                  <Text style={styles.jurisdictionMiles}>
                    {jm.miles.toFixed(1)} mi
                  </Text>
                  {jm.confidence !== null && (
                    <Text style={styles.jurisdictionConfidence}>
                      {Math.round(jm.confidence * 100)}% conf
                    </Text>
                  )}
                </View>
              </View>
            ))
        )}
      </View>

      {/* Notes */}
      {trip.notes && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.notes}>{trip.notes}</Text>
        </View>
      )}

      {/* Trip Metadata */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Details</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Source</Text>
          <Text style={styles.infoValue}>{trip.source.toUpperCase()}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Trip ID</Text>
          <Text style={styles.infoValueSmall}>{trip.id}</Text>
        </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  errorText: {
    color: '#888',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  date: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: '#4f46e5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  section: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#3d3d5c',
  },
  infoLabel: {
    color: '#888',
    fontSize: 14,
  },
  infoValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  infoValueSmall: {
    color: '#888',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  jurisdictionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#3d3d5c',
  },
  jurisdictionInfo: {
    flex: 1,
  },
  jurisdictionCode: {
    color: '#4f46e5',
    fontSize: 14,
    fontWeight: '600',
  },
  jurisdictionName: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  jurisdictionMilesContainer: {
    alignItems: 'flex-end',
  },
  jurisdictionMiles: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  jurisdictionConfidence: {
    color: '#888',
    fontSize: 10,
    marginTop: 2,
  },
  emptyText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 8,
  },
  notes: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
  },
});
