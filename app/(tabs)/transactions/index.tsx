import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { format } from 'date-fns';
import { useUser } from '@/stores/authStore';
import { getUserTransactions, createTransaction } from '@/lib/database';
import { getCategoryLabel, EXPENSE_CATEGORIES } from '@/constants/categories';
import type { Transaction, TxnType, TxnCategory } from '@/types/database.types';

export default function TransactionsScreen() {
  const user = useUser();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filterType, setFilterType] = useState<TxnType | 'all'>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // Add transaction form state
  const [newType, setNewType] = useState<TxnType>('expense');
  const [newCategory, setNewCategory] = useState<TxnCategory>('fuel');
  const [newAmount, setNewAmount] = useState('');
  const [newVendor, setNewVendor] = useState('');

  const loadTransactions = async () => {
    if (!user?.id) return;

    try {
      const txns = await getUserTransactions(user.id, {
        type: filterType === 'all' ? undefined : filterType,
        limit: 100,
      });
      setTransactions(txns);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [user?.id, filterType]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTransactions();
    setRefreshing(false);
  };

  const handleAddTransaction = async () => {
    if (!newAmount || isNaN(parseFloat(newAmount))) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    try {
      await createTransaction(user!.id, {
        type: newType,
        category: newCategory,
        amount: parseFloat(newAmount),
        date: new Date().toISOString().split('T')[0],
        vendor: newVendor || null,
        source: 'manual',
      });

      // Reset form
      setNewAmount('');
      setNewVendor('');
      setShowAddModal(false);

      // Reload transactions
      loadTransactions();

      Alert.alert('Success', 'Transaction added');
    } catch (error) {
      Alert.alert('Error', 'Failed to add transaction');
    }
  };

  // Calculate totals
  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <View style={styles.container}>
      {/* Summary */}
      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Income</Text>
          <Text style={[styles.summaryValue, styles.incomeText]}>
            +${totalIncome.toFixed(2)}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Expenses</Text>
          <Text style={[styles.summaryValue, styles.expenseText]}>
            -${totalExpenses.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {(['all', 'income', 'expense'] as const).map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.filterTab, filterType === type && styles.filterTabActive]}
            onPress={() => setFilterType(type)}
          >
            <Text
              style={[
                styles.filterTabText,
                filterType === type && styles.filterTabTextActive,
              ]}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Transaction List */}
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
        {transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💰</Text>
            <Text style={styles.emptyTitle}>No transactions yet</Text>
            <Text style={styles.emptyText}>
              Add transactions manually or scan receipts
            </Text>
          </View>
        ) : (
          transactions.map((txn) => (
            <TouchableOpacity
              key={txn.id}
              style={styles.transactionCard}
              onPress={() => router.push(`/(tabs)/transactions/${txn.id}`)}
            >
              <View style={styles.transactionIcon}>
                <Text style={styles.iconText}>
                  {txn.type === 'income' ? '💵' : '💸'}
                </Text>
              </View>
              <View style={styles.transactionInfo}>
                <Text style={styles.transactionVendor}>
                  {txn.vendor || getCategoryLabel(txn.category)}
                </Text>
                <Text style={styles.transactionMeta}>
                  {format(new Date(txn.date), 'MMM d')} • {getCategoryLabel(txn.category)}
                </Text>
              </View>
              <Text
                style={[
                  styles.transactionAmount,
                  txn.type === 'income' ? styles.incomeText : styles.expenseText,
                ]}
              >
                {txn.type === 'income' ? '+' : '-'}${txn.amount.toFixed(2)}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Add Transaction Modal */}
      {showAddModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Transaction</Text>

            {/* Type Toggle */}
            <View style={styles.typeToggle}>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  newType === 'expense' && styles.typeButtonActive,
                ]}
                onPress={() => setNewType('expense')}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    newType === 'expense' && styles.typeButtonTextActive,
                  ]}
                >
                  Expense
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  newType === 'income' && styles.typeButtonActive,
                ]}
                onPress={() => setNewType('income')}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    newType === 'income' && styles.typeButtonTextActive,
                  ]}
                >
                  Income
                </Text>
              </TouchableOpacity>
            </View>

            {/* Amount Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Amount</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor="#666"
                keyboardType="decimal-pad"
                value={newAmount}
                onChangeText={setNewAmount}
              />
            </View>

            {/* Vendor Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Vendor (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Pilot, Love's"
                placeholderTextColor="#666"
                value={newVendor}
                onChangeText={setNewVendor}
              />
            </View>

            {/* Category Selection */}
            {newType === 'expense' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Category</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.categoryScroll}
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat.value}
                      style={[
                        styles.categoryChip,
                        newCategory === cat.value && styles.categoryChipActive,
                      ]}
                      onPress={() => setNewCategory(cat.value)}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          newCategory === cat.value && styles.categoryChipTextActive,
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleAddTransaction}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Add Button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setShowAddModal(true)}
      >
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
  summary: {
    flexDirection: 'row',
    backgroundColor: '#2d2d44',
    margin: 16,
    borderRadius: 12,
    padding: 16,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#3d3d5c',
  },
  summaryLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  incomeText: {
    color: '#22c55e',
  },
  expenseText: {
    color: '#ef4444',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#2d2d44',
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
  },
  transactionCard: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  transactionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3d3d5c',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 20,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionVendor: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  transactionMeta: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
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
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#2d2d44',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  typeToggle: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  typeButtonActive: {
    backgroundColor: '#4f46e5',
  },
  typeButtonText: {
    color: '#888',
    fontWeight: '500',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#888',
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 14,
    color: '#fff',
    fontSize: 16,
  },
  categoryScroll: {
    marginTop: 4,
  },
  categoryChip: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: '#4f46e5',
  },
  categoryChipText: {
    color: '#888',
    fontSize: 14,
  },
  categoryChipTextActive: {
    color: '#fff',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#3d3d5c',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#4f46e5',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
