export type ExpenseSplitType = 'equal' | 'percentage' | 'fixed';

export type ExpenseCategoryKey =
  | 'food'
  | 'adventure'
  | 'accommodation'
  | 'transport'
  | 'shopping'
  | 'entertainment'
  | 'utilities'
  | 'medical'
  | 'other';

export interface ExpenseCategory {
  label: string;
  icon: string;
  color: string;
  subcategories: string[];
}

export type ExpenseCategoryMap = Record<ExpenseCategoryKey, ExpenseCategory>;

export interface ExpenseSplit {
  userId: string;
  amount: number;
  percentage?: number;
}

export interface Expense {
  id: string;
  tripId: string;
  paidBy: string;
  amount: number;
  category: ExpenseCategoryKey;
  subcategory: string;
  description: string;
  date: number;
  splitType: ExpenseSplitType;
  splits: ExpenseSplit[];
  settled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Settlement {
  fromUser: string;
  toUser: string;
  amount: number;
}

export interface SettlementResult {
  balances: Record<string, number>;
  settlements: Settlement[];
}

export interface ExpenseInput {
  paidBy: string;
  amount: number;
  category: ExpenseCategoryKey;
  subcategory: string;
  description: string;
  date: number;
  splitType: ExpenseSplitType;
  splits: ExpenseSplit[];
}
