import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { format } from 'date-fns';
import { getTransactionById, deleteTransaction } from '@/lib/database';
import { getCategoryLabel } from '@/constants/categories';
import { getJurisdictionName } from '@/constants/jurisdictions';
import type { Transaction } from '@/types/database.types';

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTransaction() {
      if (!id) return;

      try {
        const txn = await getTransactionById(id);
        setTransaction(txn);
      } catch (error) {
        console.error('Failed to load transaction:', error);
      } finally {
        setLoading(false);
      }
    }

    loadTransaction();
  }, [id]);

  const handleDelete = () => {
    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to delete this transaction?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTransaction(id!);
              router.back();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete transaction');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  if (!transaction) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Transaction not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Amount Header */}
      <View style={styles.amountHeader}>
        <Text
          style={[
            styles.amount,
            transaction.type === 'income' ? styles.incomeText : styles.expenseText,
          ]}
        >
          {transaction.type === 'income' ? '+' : '-'}${transaction.amount.toFixed(2)}
        </Text>
        <View
          style={[
            styles.typeBadge,
            transaction.type === 'income' ? styles.incomeBadge : styles.expenseBadge,
          ]}
        >
          <Text style={styles.typeBadgeText}>{transaction.type}</Text>
        </View>
      </View>

      {/* Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Details</Text>

        {transaction.vendor && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Vendor</Text>
            <Text style={styles.infoValue}>{transaction.vendor}</Text>
          </View>
        )}

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Category</Text>
          <Text style={styles.infoValue}>
            {getCategoryLabel(transaction.category)}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Date</Text>
          <Text style={styles.infoValue}>
            {format(new Date(transaction.date), 'MMMM d, yyyy')}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Source</Text>
          <Text style={styles.infoValue}>{transaction.source}</Text>
        </View>

        {transaction.jurisdiction && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>State</Text>
            <Text style={styles.infoValue}>
              {getJurisdictionName(transaction.jurisdiction)}
            </Text>
          </View>
        )}

        {transaction.gallons !== null && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Gallons</Text>
            <Text style={styles.infoValue}>{transaction.gallons.toFixed(3)}</Text>
          </View>
        )}

        {transaction.description && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Notes</Text>
            <Text style={styles.infoValue}>{transaction.description}</Text>
          </View>
        )}
      </View>

      {/* Linked Items */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Linked Items</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Document</Text>
          <Text style={styles.infoValue}>
            {transaction.document_id ? 'Linked' : 'None'}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Trip</Text>
          <Text style={styles.infoValue}>
            {transaction.trip_id ? 'Linked' : 'None'}
          </Text>
        </View>
      </View>

      {/* Metadata */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Metadata</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Created</Text>
          <Text style={styles.infoValueSmall}>
            {format(new Date(transaction.created_at), 'MMM d, yyyy h:mm a')}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>ID</Text>
          <Text style={styles.infoValueSmall}>{transaction.id}</Text>
        </View>
      </View>

      {/* Actions */}
      <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
        <Text style={styles.deleteButtonText}>Delete Transaction</Text>
      </TouchableOpacity>
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
  amountHeader: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  amount: {
    fontSize: 40,
    fontWeight: 'bold',
  },
  incomeText: {
    color: '#22c55e',
  },
  expenseText: {
    color: '#ef4444',
  },
  typeBadge: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginTop: 8,
  },
  incomeBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  expenseBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  typeBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'capitalize',
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
    fontSize: 12,
  },
  deleteButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  deleteButtonText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
});
