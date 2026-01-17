import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { format } from 'date-fns';
import * as FileSystem from 'expo-file-system';
import { getDocumentById, updateDocument, deleteDocument, createTransaction } from '@/lib/database';
import { supabase } from '@/lib/supabase/client';
import { useProfile, useUser } from '@/stores/authStore';
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
  const user = useUser();
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editField, setEditField] = useState<'vendor' | 'date' | 'amount' | null>(null);
  const [editValue, setEditValue] = useState('');

  const loadDocument = useCallback(async () => {
    if (!id) return;

    try {
      const doc = await getDocumentById(id);
      setDocument(doc);
    } catch (error) {
      console.error('Failed to load document:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDocument();
  }, [loadDocument]);

  const handleEditField = (field: 'vendor' | 'date' | 'amount') => {
    if (!document) return;

    setEditField(field);
    if (field === 'vendor') {
      setEditValue(document.vendor || '');
    } else if (field === 'date') {
      setEditValue(document.document_date || '');
    } else if (field === 'amount') {
      setEditValue(document.total_amount?.toString() || '');
    }
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!document || !id || !editField) return;

    setSaving(true);
    try {
      const updates: Partial<Document> = {};

      if (editField === 'vendor') {
        updates.vendor = editValue.trim() || null;
      } else if (editField === 'date') {
        // Validate date format
        if (editValue && !/^\d{4}-\d{2}-\d{2}$/.test(editValue)) {
          Alert.alert('Invalid Date', 'Please use format YYYY-MM-DD (e.g., 2026-01-17)');
          setSaving(false);
          return;
        }
        updates.document_date = editValue || null;
      } else if (editField === 'amount') {
        const amount = parseFloat(editValue);
        if (editValue && (isNaN(amount) || amount < 0)) {
          Alert.alert('Invalid Amount', 'Please enter a valid positive number');
          setSaving(false);
          return;
        }
        updates.total_amount = editValue ? amount : null;
      }

      await updateDocument(id, updates);
      await loadDocument();
      setEditModalVisible(false);
      Alert.alert('Saved', 'Document updated successfully.');
    } catch (error) {
      console.error('Failed to save edit:', error);
      Alert.alert('Error', 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTransaction = async () => {
    if (!document || !id || !user?.id) return;

    if (!document.total_amount) {
      Alert.alert('Missing Amount', 'Please add an amount before creating a transaction.');
      return;
    }

    Alert.alert(
      'Create Transaction',
      `Create an expense transaction for $${document.total_amount.toFixed(2)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create',
          onPress: async () => {
            try {
              await createTransaction(user.id, {
                type: 'expense',
                category: 'other',
                amount: document.total_amount!,
                date: document.document_date || new Date().toISOString().split('T')[0],
                vendor: document.vendor || undefined,
                description: `From ${DOC_TYPE_LABELS[document.type] || document.type}`,
                source: 'document_ai',
                document_id: id,
              });
              Alert.alert('Created', 'Transaction created successfully!');
            } catch (error) {
              console.error('Failed to create transaction:', error);
              Alert.alert('Error', 'Failed to create transaction.');
            }
          },
        },
      ]
    );
  };

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

      {/* Failed Extraction Error */}
      {document.parsed_status === 'failed' && (
        <View style={styles.errorSection}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Extraction Failed</Text>
          <Text style={styles.errorMessage}>
            We couldn't automatically extract data from this document. You can try again or enter the details manually below.
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, uploading && styles.buttonDisabled]}
            onPress={handleUpload}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.retryButtonText}>Retry Extraction</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Extracted Data (Editable) */}
      {(document.parsed_status === 'parsed' || document.parsed_status === 'failed') && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {document.parsed_status === 'parsed' ? 'Extracted Data' : 'Manual Entry'}
            </Text>
            <Text style={styles.editHint}>Tap to edit</Text>
          </View>

          <TouchableOpacity
            style={styles.editableRow}
            onPress={() => handleEditField('vendor')}
            accessibilityLabel="Edit vendor"
            accessibilityRole="button"
          >
            <Text style={styles.infoLabel}>Vendor</Text>
            <View style={styles.editableValue}>
              <Text style={document.vendor ? styles.infoValue : styles.placeholderValue}>
                {document.vendor || 'Tap to add'}
              </Text>
              <Text style={styles.editIcon}>✏️</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.editableRow}
            onPress={() => handleEditField('date')}
            accessibilityLabel="Edit date"
            accessibilityRole="button"
          >
            <Text style={styles.infoLabel}>Date</Text>
            <View style={styles.editableValue}>
              <Text style={document.document_date ? styles.infoValue : styles.placeholderValue}>
                {document.document_date
                  ? format(new Date(document.document_date), 'MMM d, yyyy')
                  : 'Tap to add'}
              </Text>
              <Text style={styles.editIcon}>✏️</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.editableRow}
            onPress={() => handleEditField('amount')}
            accessibilityLabel="Edit amount"
            accessibilityRole="button"
          >
            <Text style={styles.infoLabel}>Amount</Text>
            <View style={styles.editableValue}>
              <Text style={document.total_amount !== null ? styles.infoValueLarge : styles.placeholderValue}>
                {document.total_amount !== null
                  ? `$${document.total_amount.toFixed(2)} ${document.currency || 'USD'}`
                  : 'Tap to add'}
              </Text>
              <Text style={styles.editIcon}>✏️</Text>
            </View>
          </TouchableOpacity>

          {/* Create Transaction Button */}
          {document.total_amount !== null && (
            <TouchableOpacity
              style={styles.createTransactionButton}
              onPress={handleCreateTransaction}
              accessibilityLabel="Create transaction from this document"
              accessibilityRole="button"
            >
              <Text style={styles.createTransactionText}>+ Create Transaction</Text>
            </TouchableOpacity>
          )}

          {document.extraction_json && (
            <View style={styles.extractionContainer}>
              <Text style={styles.extractionTitle}>AI Extraction Details</Text>
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

      {/* Edit Modal */}
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
            <Text style={styles.modalTitle}>
              Edit {editField === 'vendor' ? 'Vendor' : editField === 'date' ? 'Date' : 'Amount'}
            </Text>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={editValue}
                onChangeText={setEditValue}
                placeholder={
                  editField === 'vendor'
                    ? 'Enter vendor name'
                    : editField === 'date'
                    ? 'YYYY-MM-DD'
                    : 'Enter amount'
                }
                placeholderTextColor="#666"
                keyboardType={editField === 'amount' ? 'decimal-pad' : 'default'}
                autoFocus
              />
              {editField === 'amount' && <Text style={styles.inputPrefix}>$</Text>}
            </View>

            {editField === 'date' && (
              <Text style={styles.inputHint}>Format: YYYY-MM-DD (e.g., 2026-01-17)</Text>
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
                onPress={handleSaveEdit}
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
  // Error section styles
  errorSection: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  errorIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  errorTitle: {
    color: '#ef4444',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorMessage: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: '#4f46e5',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Editable row styles
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  editHint: {
    color: '#666',
    fontSize: 12,
  },
  editableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#3d3d5c',
    minHeight: 48,
  },
  editableValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  placeholderValue: {
    color: '#666',
    fontSize: 14,
    fontStyle: 'italic',
  },
  editIcon: {
    fontSize: 14,
  },
  createTransactionButton: {
    backgroundColor: '#22c55e',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  createTransactionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Modal styles
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
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3d3d5c',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    paddingVertical: 16,
    minHeight: 56,
  },
  inputPrefix: {
    color: '#888',
    fontSize: 18,
    marginRight: 8,
    position: 'absolute',
    left: 16,
  },
  inputHint: {
    color: '#666',
    fontSize: 12,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
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
});
