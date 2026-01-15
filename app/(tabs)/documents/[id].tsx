import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { format } from 'date-fns';
import * as FileSystem from 'expo-file-system';
import { getDocumentById, updateDocument, deleteDocument } from '@/lib/database';
import { supabase } from '@/lib/supabase/client';
import { useProfile } from '@/stores/authStore';
import { canAccessFeature, type SubscriptionTier } from '@/constants/pricing';
import type { Document } from '@/types/database.types';

const DOC_TYPE_LABELS: Record<string, string> = {
  receipt: 'Receipt',
  settlement: 'Settlement',
  ratecon: 'Rate Con',
  maintenance: 'Maintenance',
  other: 'Other',
};

export default function DocumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const profile = useProfile();
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function loadDocument() {
      if (!id) return;

      try {
        const doc = await getDocumentById(id);
        setDocument(doc);
      } catch (error) {
        console.error('Failed to load document:', error);
      } finally {
        setLoading(false);
      }
    }

    loadDocument();
  }, [id]);

  const handleUpload = async () => {
    if (!document || !id) return;

    // Check subscription tier for AI features
    const tier = (profile?.subscription_tier || 'free') as SubscriptionTier;
    if (!canAccessFeature(tier, 'pro')) {
      Alert.alert(
        'Pro Feature',
        'AI document extraction requires a Pro subscription. Upgrade to unlock automatic receipt scanning.',
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

    Alert.alert(
      'Upload Document',
      'This will upload the document for AI extraction. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Upload',
          onPress: async () => {
            setUploading(true);

            try {
              // Get auth session
              const { data: sessionData } = await supabase.auth.getSession();
              const session = sessionData?.session;

              if (!session?.access_token) {
                Alert.alert('Error', 'You must be logged in to upload documents.');
                return;
              }

              // Read the file as base64
              const fileUri = document.storage_path;
              if (!fileUri) {
                Alert.alert('Error', 'No image file found for this document.');
                return;
              }

              // Get file info
              const fileInfo = await FileSystem.getInfoAsync(fileUri);
              if (!fileInfo.exists) {
                Alert.alert('Error', 'Image file not found.');
                return;
              }

              // Read as base64
              const base64 = await FileSystem.readAsStringAsync(fileUri, {
                encoding: 'base64',
              });

              // Upload to Supabase Storage
              const fileName = `${session.user.id}/${id}.jpg`;
              const { error: uploadError } = await supabase.storage
                .from('documents')
                .upload(fileName, Buffer.from(base64, 'base64'), {
                  contentType: 'image/jpeg',
                  upsert: true,
                });

              if (uploadError) {
                console.error('Storage upload error:', uploadError);
                Alert.alert('Error', 'Failed to upload document to storage.');
                return;
              }

              // Get public URL
              const { data: urlData } = supabase.storage
                .from('documents')
                .getPublicUrl(fileName);

              // Update local document with storage URL
              await updateDocument(id, {
                storage_path: urlData.publicUrl,
              });

              // Call doc-ingest edge function
              const response = await fetch(
                `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/doc-ingest`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                  },
                  body: JSON.stringify({
                    document_id: id,
                    storage_path: urlData.publicUrl,
                    document_type: document.type,
                  }),
                }
              );

              if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('Doc-ingest error:', errorData);
                Alert.alert(
                  'Processing Error',
                  'Document uploaded but AI extraction failed. You can retry later.'
                );
                return;
              }

              const result = await response.json();

              // Update local document with extracted data
              await updateDocument(id, {
                parsed_status: 'parsed',
                vendor: result.vendor,
                document_date: result.date,
                total_amount: result.amount,
                extraction_json: result.extraction,
              });

              // Reload document
              const updatedDoc = await getDocumentById(id);
              setDocument(updatedDoc);

              Alert.alert('Success', 'Document processed successfully!');
            } catch (error) {
              console.error('Upload error:', error);
              Alert.alert('Error', 'Failed to process document. Please try again.');
            } finally {
              setUploading(false);
            }
          },
        },
      ]
    );
  };

  const handleDelete = async () => {
    if (!document || !id) return;

    Alert.alert('Delete Document', 'Are you sure you want to delete this document?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);

          try {
            // Delete from storage if uploaded
            if (document.storage_path?.includes('supabase')) {
              const { data: sessionData } = await supabase.auth.getSession();
              if (sessionData?.session) {
                const fileName = `${sessionData.session.user.id}/${id}.jpg`;
                await supabase.storage.from('documents').remove([fileName]);
              }
            }

            // Delete from local database
            await deleteDocument(id);

            Alert.alert('Deleted', 'Document has been deleted.');
            router.back();
          } catch (error) {
            console.error('Delete error:', error);
            Alert.alert('Error', 'Failed to delete document.');
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  if (!document) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Document not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Document Preview */}
      <View style={styles.previewContainer}>
        {document.storage_path ? (
          <Image
            source={{ uri: document.storage_path }}
            style={styles.previewImage}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.previewPlaceholder}>
            <Text style={styles.previewPlaceholderText}>No preview available</Text>
          </View>
        )}
      </View>

      {/* Document Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Document Information</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Type</Text>
          <Text style={styles.infoValue}>
            {DOC_TYPE_LABELS[document.type] || document.type}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Status</Text>
          <View
            style={[
              styles.statusBadge,
              document.parsed_status === 'parsed' && styles.statusParsed,
              document.parsed_status === 'failed' && styles.statusFailed,
            ]}
          >
            <Text style={styles.statusText}>{document.parsed_status}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Uploaded</Text>
          <Text style={styles.infoValue}>
            {format(new Date(document.uploaded_at), 'MMM d, yyyy h:mm a')}
          </Text>
        </View>
      </View>

      {/* Extracted Data */}
      {document.parsed_status === 'parsed' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Extracted Data</Text>

          {document.vendor && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Vendor</Text>
              <Text style={styles.infoValue}>{document.vendor}</Text>
            </View>
          )}

          {document.document_date && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Date</Text>
              <Text style={styles.infoValue}>
                {format(new Date(document.document_date), 'MMM d, yyyy')}
              </Text>
            </View>
          )}

          {document.total_amount !== null && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Amount</Text>
              <Text style={styles.infoValueLarge}>
                ${document.total_amount.toFixed(2)} {document.currency}
              </Text>
            </View>
          )}

          {document.extraction_json && (
            <View style={styles.extractionContainer}>
              <Text style={styles.extractionTitle}>Raw Extraction</Text>
              <Text style={styles.extractionJson}>
                {JSON.stringify(document.extraction_json, null, 2)}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        {document.parsed_status === 'pending' && (
          <TouchableOpacity
            style={[styles.uploadButton, uploading && styles.buttonDisabled]}
            onPress={handleUpload}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.uploadButtonText}>Upload for Extraction</Text>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.deleteButton, deleting && styles.buttonDisabled]}
          onPress={handleDelete}
          disabled={deleting}
        >
          {deleting ? (
            <ActivityIndicator color="#ef4444" />
          ) : (
            <Text style={styles.deleteButtonText}>Delete Document</Text>
          )}
        </TouchableOpacity>
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
  previewContainer: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    aspectRatio: 3 / 4,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewPlaceholderText: {
    color: '#888',
    fontSize: 14,
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
    alignItems: 'center',
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
  infoValueLarge: {
    color: '#4f46e5',
    fontSize: 18,
    fontWeight: '600',
  },
  statusBadge: {
    backgroundColor: '#fbbf24',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusParsed: {
    backgroundColor: '#22c55e',
  },
  statusFailed: {
    backgroundColor: '#ef4444',
  },
  statusText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  extractionContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
  },
  extractionTitle: {
    color: '#888',
    fontSize: 12,
    marginBottom: 8,
  },
  extractionJson: {
    color: '#ccc',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  actions: {
    gap: 12,
  },
  uploadButton: {
    backgroundColor: '#4f46e5',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
