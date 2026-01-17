import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { useUser } from '@/stores/authStore';
import { createTransaction } from '@/lib/database';
import { getCategoryLabel, EXPENSE_CATEGORIES } from '@/constants/categories';
import type { TxnType, TxnCategory } from '@/types/database.types';

// Simple income categories for the add screen
const INCOME_CATEGORIES = [
  { value: 'settlement' as TxnCategory, label: 'Settlement' },
  { value: 'detention' as TxnCategory, label: 'Detention Pay' },
  { value: 'lumper' as TxnCategory, label: 'Lumper Reimbursement' },
  { value: 'other' as TxnCategory, label: 'Other Income' },
];

const CATEGORY_ICONS: Record<string, string> = {
  fuel: '⛽',
  food: '🍔',
  tolls: '🛣️',
  parking: '🅿️',
  scale: '⚖️',
  maintenance: '🔧',
  insurance: '🛡️',
  truck_payment: '🚛',
  permits: '📋',
  other: '📦',
  settlement: '💰',
  lumper: '📦',
  detention: '⏱️',
};

export default function AddTransactionScreen() {
  const user = useUser();
  const params = useLocalSearchParams<{ category?: string }>();

  const [type, setType] = useState<TxnType>('expense');
  const [category, setCategory] = useState<TxnCategory>((params.category as TxnCategory) || 'fuel');
  const [amount, setAmount] = useState('');
  const [vendor, setVendor] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // Set category from URL params
  useEffect(() => {
    if (params.category) {
      setCategory(params.category as TxnCategory);
    }
  }, [params.category]);

  const handleSave = async () => {
    if (!amount || isNaN(parseFloat(amount))) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Amount must be greater than zero');
      return;
    }

    setSaving(true);
    try {
      await createTransaction(user!.id, {
        type,
        category,
        amount: parseFloat(amount),
        date: new Date().toISOString().split('T')[0],
        vendor: vendor || undefined,
        description: description || undefined,
        source: 'manual',
      });

      Alert.alert('Success', `${getCategoryLabel(category)} expense added`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Failed to save transaction:', error);
      Alert.alert('Error', 'Failed to save transaction');
    } finally {
      setSaving(false);
    }
  };

  const categories: Array<{ value: TxnCategory; label: string }> = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  return (
    <>
      <Stack.Screen
        options={{
          title: `Add ${getCategoryLabel(category)}`,
          headerStyle: { backgroundColor: '#1a1a2e' },
          headerTintColor: '#fff',
        }}
      />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* Category Icon */}
          <View style={styles.iconContainer}>
            <Text style={styles.categoryIcon}>{CATEGORY_ICONS[category] || '📦'}</Text>
            <Text style={styles.categoryLabel}>{getCategoryLabel(category)}</Text>
          </View>

          {/* Amount Input - Large and prominent */}
          <View style={styles.amountContainer}>
            <Text style={styles.dollarSign}>$</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor="#666"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
              autoFocus
            />
          </View>

          {/* Type Toggle */}
          <View style={styles.typeToggle}>
            <TouchableOpacity
              style={[styles.typeButton, type === 'expense' && styles.typeButtonActive]}
              onPress={() => setType('expense')}
            >
              <Text style={[styles.typeButtonText, type === 'expense' && styles.typeButtonTextActive]}>
                Expense
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, type === 'income' && styles.typeButtonActiveIncome]}
              onPress={() => setType('income')}
            >
              <Text style={[styles.typeButtonText, type === 'income' && styles.typeButtonTextActive]}>
                Income
              </Text>
            </TouchableOpacity>
          </View>

          {/* Category Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.categoryRow}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.value}
                    style={[styles.categoryChip, category === cat.value && styles.categoryChipActive]}
                    onPress={() => setCategory(cat.value)}
                  >
                    <Text style={styles.categoryChipIcon}>{CATEGORY_ICONS[cat.value] || '📦'}</Text>
                    <Text
                      style={[
                        styles.categoryChipText,
                        category === cat.value && styles.categoryChipTextActive,
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Vendor Input */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Vendor (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Pilot, Love's, Petro"
              placeholderTextColor="#666"
              value={vendor}
              onChangeText={setVendor}
            />
          </View>

          {/* Description Input */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Notes (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Add any notes..."
              placeholderTextColor="#666"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />
          </View>
        </ScrollView>

        {/* Save Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>
              {saving ? 'Saving...' : `Save ${type === 'expense' ? 'Expense' : 'Income'}`}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  categoryIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  categoryLabel: {
    color: '#888',
    fontSize: 16,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  dollarSign: {
    fontSize: 36,
    color: '#fff',
    fontWeight: '300',
    marginRight: 4,
  },
  amountInput: {
    fontSize: 48,
    color: '#fff',
    fontWeight: '600',
    minWidth: 150,
    textAlign: 'center',
  },
  typeToggle: {
    flexDirection: 'row',
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  typeButtonActive: {
    backgroundColor: '#ef4444',
  },
  typeButtonActiveIncome: {
    backgroundColor: '#22c55e',
  },
  typeButtonText: {
    color: '#888',
    fontWeight: '600',
    fontSize: 16,
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    color: '#888',
    fontSize: 14,
    marginBottom: 10,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  categoryChip: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryChipActive: {
    backgroundColor: '#4f46e5',
  },
  categoryChipIcon: {
    fontSize: 18,
  },
  categoryChipText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: '#fff',
  },
  input: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  footer: {
    padding: 20,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderTopColor: '#2d2d44',
  },
  saveButton: {
    backgroundColor: '#4f46e5',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
