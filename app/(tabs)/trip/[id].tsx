import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import { format } from 'date-fns';
import { getTripById, getTripPoints, getJurisdictionMiles, upsertJurisdictionMiles, updateTrip } from '@/lib/database';
import { getJurisdictionName, US_STATES, CA_PROVINCES } from '@/constants/jurisdictions';
import type { Trip, TripPoint, JurisdictionMiles } from '@/types/database.types';

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [points, setPoints] = useState<TripPoint[]>([]);
  const [jurisdictionMiles, setJurisdictionMiles] = useState<JurisdictionMiles[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [addStateModalVisible, setAddStateModalVisible] = useState(false);
  const [editingJurisdiction, setEditingJurisdiction] = useState<JurisdictionMiles | null>(null);
  const [editMiles, setEditMiles] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [newStateMiles, setNewStateMiles] = useState('');
  const [saving, setSaving] = useState(false);

  const loadTrip = useCallback(async () => {
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
  }, [id]);

  useEffect(() => {
    loadTrip();
  }, [loadTrip]);

  const handleEditMiles = (jm: JurisdictionMiles) => {
    setEditingJurisdiction(jm);
    setEditMiles(jm.miles.toFixed(1));
    setEditModalVisible(true);
  };

  const handleSaveMiles = async () => {
    if (!editingJurisdiction || !id) return;

    const milesValue = parseFloat(editMiles);
    if (isNaN(milesValue) || milesValue < 0) {
      Alert.alert('Invalid Input', 'Please enter a valid mileage value.');
      return;
    }

    setSaving(true);
    try {
      await upsertJurisdictionMiles(
        id,
        editingJurisdiction.jurisdiction,
        milesValue,
        1.0, // Manual entries have 100% confidence
        'manual_adjust'
      );

      // Update manual_miles_total on the trip
      const newTotal = jurisdictionMiles.reduce((sum, jm) => {
        if (jm.jurisdiction === editingJurisdiction.jurisdiction) {
          return sum + milesValue;
        }
        return sum + jm.miles;
      }, 0);

      await updateTrip(id, { manual_miles_total: newTotal });

      // Reload data
      await loadTrip();
      setEditModalVisible(false);
      Alert.alert('Saved', 'Mileage updated successfully.');
    } catch (error) {
      console.error('Failed to save mileage:', error);
      Alert.alert('Error', 'Failed to save mileage. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddState = async () => {
    if (!id || !selectedState) {
      Alert.alert('Select State', 'Please select a state to add.');
      return;
    }

    const milesValue = parseFloat(newStateMiles);
    if (isNaN(milesValue) || milesValue < 0) {
      Alert.alert('Invalid Input', 'Please enter a valid mileage value.');
      return;
    }

    // Check if state already exists
    if (jurisdictionMiles.some((jm) => jm.jurisdiction === selectedState)) {
      Alert.alert('State Exists', 'This state already exists. Edit it from the list instead.');
      return;
    }

    setSaving(true);
    try {
      await upsertJurisdictionMiles(
        id,
        selectedState,
        milesValue,
        1.0,
        'manual_adjust'
      );

      // Update manual_miles_total
      const newTotal = jurisdictionMiles.reduce((sum, jm) => sum + jm.miles, 0) + milesValue;
      await updateTrip(id, { manual_miles_total: newTotal });

      // Reload data
      await loadTrip();
      setAddStateModalVisible(false);
      setSelectedState('');
      setNewStateMiles('');
      Alert.alert('Added', `${getJurisdictionName(selectedState)} added successfully.`);
    } catch (error) {
      console.error('Failed to add state:', error);
      Alert.alert('Error', 'Failed to add state. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Get available states (not already in the trip)
  const availableStates = [...US_STATES, ...CA_PROVINCES].filter(
    (state) => !jurisdictionMiles.some((jm) => jm.jurisdiction === state.code)
  );

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
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Miles by State (IFTA)</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setAddStateModalVisible(true)}
            accessibilityLabel="Add state mileage"
            accessibilityRole="button"
          >
            <Text style={styles.addButtonText}>+ Add State</Text>
          </TouchableOpacity>
        </View>
        {jurisdictionMiles.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <Text style={styles.emptyText}>No mileage data recorded</Text>
            <Text style={styles.emptyHint}>
              Tap "Add State" to manually enter miles
            </Text>
          </View>
        ) : (
          jurisdictionMiles
            .sort((a, b) => b.miles - a.miles)
            .map((jm) => (
              <TouchableOpacity
                key={jm.jurisdiction}
                style={styles.jurisdictionRow}
                onPress={() => handleEditMiles(jm)}
                accessibilityLabel={`Edit ${getJurisdictionName(jm.jurisdiction)} mileage: ${jm.miles.toFixed(1)} miles`}
                accessibilityRole="button"
              >
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
                  <View style={styles.editHintContainer}>
                    {jm.method === 'manual_adjust' && (
                      <Text style={styles.manualBadge}>Manual</Text>
                    )}
                    <Text style={styles.editHint}>Tap to edit</Text>
                  </View>
                </View>
              </TouchableOpacity>
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

      {/* Edit Miles Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Mileage</Text>
            {editingJurisdiction && (
              <>
                <Text style={styles.modalSubtitle}>
                  {getJurisdictionName(editingJurisdiction.jurisdiction)}
                </Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    value={editMiles}
                    onChangeText={setEditMiles}
                    keyboardType="decimal-pad"
                    placeholder="Enter miles"
                    placeholderTextColor="#666"
                    autoFocus
                    accessibilityLabel="Miles input"
                  />
                  <Text style={styles.inputSuffix}>miles</Text>
                </View>
              </>
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, saving && styles.buttonDisabled]}
                onPress={handleSaveMiles}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add State Modal */}
      <Modal
        visible={addStateModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddStateModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add State Mileage</Text>
            <Text style={styles.modalSubtitle}>
              Manually add mileage for a state
            </Text>

            <View style={styles.pickerContainer}>
              <Text style={styles.pickerLabel}>State/Province</Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={selectedState}
                  onValueChange={(value) => setSelectedState(value)}
                  style={styles.picker}
                  dropdownIconColor="#fff"
                  itemStyle={styles.pickerItem}
                >
                  <Picker.Item label="Select a state..." value="" />
                  {availableStates.map((state) => (
                    <Picker.Item
                      key={state.code}
                      label={`${state.code} - ${state.name}`}
                      value={state.code}
                    />
                  ))}
                </Picker>
              </View>
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={newStateMiles}
                onChangeText={setNewStateMiles}
                keyboardType="decimal-pad"
                placeholder="Enter miles"
                placeholderTextColor="#666"
                accessibilityLabel="Miles input"
              />
              <Text style={styles.inputSuffix}>miles</Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setAddStateModalVisible(false);
                  setSelectedState('');
                  setNewStateMiles('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, saving && styles.buttonDisabled]}
                onPress={handleAddState}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>Add</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  emptyStateContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  emptyHint: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
  notes: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addButton: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minHeight: 44,
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  editHintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 8,
  },
  editHint: {
    color: '#666',
    fontSize: 10,
  },
  manualBadge: {
    color: '#4f46e5',
    fontSize: 10,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#2d2d44',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  modalSubtitle: {
    color: '#888',
    fontSize: 14,
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3d3d5c',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
    paddingVertical: 16,
    minHeight: 56,
  },
  inputSuffix: {
    color: '#888',
    fontSize: 16,
    marginLeft: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#3d3d5c',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#4f46e5',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  pickerContainer: {
    marginBottom: 16,
  },
  pickerLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 8,
  },
  pickerWrapper: {
    backgroundColor: '#3d3d5c',
    borderRadius: 12,
    overflow: 'hidden',
  },
  picker: {
    color: '#fff',
    height: 50,
  },
  pickerItem: {
    color: '#fff',
    fontSize: 16,
  },
});
