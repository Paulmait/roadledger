import type { TxnCategory, TxnType } from '@/types/database.types';

export interface CategoryInfo {
  label: string;
  icon: string;
  type: TxnType;
  iftaRelevant: boolean;
}

export const TRANSACTION_CATEGORIES: Record<TxnCategory, CategoryInfo> = {
  fuel: {
    label: 'Fuel',
    icon: 'gas-pump',
    type: 'expense',
    iftaRelevant: true,
  },
  maintenance: {
    label: 'Maintenance',
    icon: 'wrench',
    type: 'expense',
    iftaRelevant: false,
  },
  tolls: {
    label: 'Tolls',
    icon: 'road',
    type: 'expense',
    iftaRelevant: false,
  },
  scales: {
    label: 'Scales',
    icon: 'weight',
    type: 'expense',
    iftaRelevant: false,
  },
  insurance: {
    label: 'Insurance',
    icon: 'shield',
    type: 'expense',
    iftaRelevant: false,
  },
  parking: {
    label: 'Parking',
    icon: 'parking',
    type: 'expense',
    iftaRelevant: false,
  },
  food: {
    label: 'Food',
    icon: 'utensils',
    type: 'expense',
    iftaRelevant: false,
  },
  other: {
    label: 'Other',
    icon: 'ellipsis-h',
    type: 'expense',
    iftaRelevant: false,
  },
  settlement_deductions: {
    label: 'Settlement Deductions',
    icon: 'file-invoice-dollar',
    type: 'expense',
    iftaRelevant: false,
  },
};

export const EXPENSE_CATEGORIES = Object.entries(TRANSACTION_CATEGORIES)
  .filter(([_, info]) => info.type === 'expense')
  .map(([key, info]) => ({ value: key as TxnCategory, ...info }));

export const IFTA_CATEGORIES = Object.entries(TRANSACTION_CATEGORIES)
  .filter(([_, info]) => info.iftaRelevant)
  .map(([key, info]) => ({ value: key as TxnCategory, ...info }));

export function getCategoryLabel(category: TxnCategory): string {
  return TRANSACTION_CATEGORIES[category]?.label ?? category;
}

export function getCategoryIcon(category: TxnCategory): string {
  return TRANSACTION_CATEGORIES[category]?.icon ?? 'question';
}
