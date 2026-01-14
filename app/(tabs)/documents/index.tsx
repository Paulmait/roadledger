import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { format } from 'date-fns';
import { useUser } from '@/stores/authStore';
import { getUserDocuments, createDocument } from '@/lib/database';
import type { Document, DocType } from '@/types/database.types';

const DOC_TYPE_LABELS: Record<DocType, string> = {
  receipt: 'Receipt',
  settlement: 'Settlement',
  ratecon: 'Rate Con',
  maintenance: 'Maintenance',
  other: 'Other',
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#fbbf24',
  parsed: '#22c55e',
  failed: '#ef4444',
};

export default function DocumentsScreen() {
  const user = useUser();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedType, setSelectedType] = useState<DocType | 'all'>('all');

  const loadDocuments = async () => {
    if (!user?.id) return;

    try {
      const docs = await getUserDocuments(user.id, {
        type: selectedType === 'all' ? undefined : selectedType,
        limit: 50,
      });
      setDocuments(docs);
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [user?.id, selectedType]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDocuments();
    setRefreshing(false);
  };

  const handleCapture = async (type: DocType) => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Camera permission is needed to capture documents.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        // Create local document record
        const doc = await createDocument(user!.id, {
          type,
          storage_path: result.assets[0].uri,
          parsed_status: 'pending',
        });

        // Reload documents
        loadDocuments();

        // Navigate to document detail for confirmation
        router.push(`/(tabs)/documents/${doc.id}`);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to capture document. Please try again.');
    }
  };

  const handlePickFromGallery = async (type: DocType) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Photo library permission is needed to select documents.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const doc = await createDocument(user!.id, {
          type,
          storage_path: result.assets[0].uri,
          parsed_status: 'pending',
        });

        loadDocuments();
        router.push(`/(tabs)/documents/${doc.id}`);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select document. Please try again.');
    }
  };

  const showCaptureOptions = () => {
    Alert.alert('Add Document', 'Choose document type', [
      {
        text: 'Receipt',
        onPress: () => showSourceOptions('receipt'),
      },
      {
        text: 'Settlement',
        onPress: () => showSourceOptions('settlement'),
      },
      {
        text: 'Other',
        onPress: () => showSourceOptions('other'),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const showSourceOptions = (type: DocType) => {
    Alert.alert('Choose Source', '', [
      {
        text: 'Take Photo',
        onPress: () => handleCapture(type),
      },
      {
        text: 'Choose from Library',
        onPress: () => handlePickFromGallery(type),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        <TouchableOpacity
          style={[styles.filterTab, selectedType === 'all' && styles.filterTabActive]}
          onPress={() => setSelectedType('all')}
        >
          <Text
            style={[
              styles.filterTabText,
              selectedType === 'all' && styles.filterTabTextActive,
            ]}
          >
            All
          </Text>
        </TouchableOpacity>
        {(Object.keys(DOC_TYPE_LABELS) as DocType[]).map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.filterTab,
              selectedType === type && styles.filterTabActive,
            ]}
            onPress={() => setSelectedType(type)}
          >
            <Text
              style={[
                styles.filterTabText,
                selectedType === type && styles.filterTabTextActive,
              ]}
            >
              {DOC_TYPE_LABELS[type]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Document List */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#4f46e5"
          />
        }
      >
        {documents.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📄</Text>
            <Text style={styles.emptyTitle}>No documents yet</Text>
            <Text style={styles.emptyText}>
              Capture receipts and settlements to track your expenses
            </Text>
          </View>
        ) : (
          documents.map((doc) => (
            <TouchableOpacity
              key={doc.id}
              style={styles.documentCard}
              onPress={() => router.push(`/(tabs)/documents/${doc.id}`)}
            >
              <View style={styles.documentThumbnail}>
                {doc.storage_path ? (
                  <Image
                    source={{ uri: doc.storage_path }}
                    style={styles.thumbnailImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={styles.thumbnailPlaceholder}>📄</Text>
                )}
              </View>
              <View style={styles.documentInfo}>
                <Text style={styles.documentType}>
                  {DOC_TYPE_LABELS[doc.type]}
                </Text>
                <Text style={styles.documentDate}>
                  {format(new Date(doc.uploaded_at), 'MMM d, yyyy h:mm a')}
                </Text>
                {doc.vendor && (
                  <Text style={styles.documentVendor}>{doc.vendor}</Text>
                )}
                {doc.total_amount !== null && (
                  <Text style={styles.documentAmount}>
                    ${doc.total_amount.toFixed(2)}
                  </Text>
                )}
              </View>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: STATUS_COLORS[doc.parsed_status] || '#888' },
                ]}
              >
                <Text style={styles.statusText}>{doc.parsed_status}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Add Button */}
      <TouchableOpacity style={styles.addButton} onPress={showCaptureOptions}>
        <Text style={styles.addButtonText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  filterContainer: {
    maxHeight: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#2d2d44',
    marginRight: 8,
  },
  filterTabActive: {
    backgroundColor: '#4f46e5',
  },
  filterTabText: {
    color: '#888',
    fontSize: 14,
  },
  filterTabTextActive: {
    color: '#fff',
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  documentCard: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  documentThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#3d3d5c',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    fontSize: 24,
  },
  documentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  documentType: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  documentDate: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  documentVendor: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 4,
  },
  documentAmount: {
    color: '#4f46e5',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  statusBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  addButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '300',
    marginTop: -2,
  },
});
