import { create } from 'zustand';
import type { TripMember } from '@/types';
import type { Expense, ExpenseInput, SettlementResult } from '@/features/expenses/types';
import {
  createExpense,
  getExpenses,
  listenToExpenses,
  removeExpense,
  updateExpense,
} from '@/features/expenses/services/expenseService';
import { calculateSettlements } from '@/features/expenses/services/settlementEngine';

interface ExpenseState {
  expenses: Expense[];
  balances: Record<string, number>;
  settlements: SettlementResult['settlements'];
  loading: boolean;
  error: string | null;
  unsubscribe: (() => void) | null;
  members: TripMember[];

  hydrate: (tripId: string, members: TripMember[]) => Promise<void>;
  addExpense: (tripId: string, input: ExpenseInput, members: TripMember[]) => Promise<boolean>;
  editExpense: (tripId: string, expenseId: string, updates: Partial<ExpenseInput>, members: TripMember[]) => Promise<boolean>;
  deleteExpense: (tripId: string, expenseId: string, members: TripMember[]) => Promise<boolean>;
  recalculate: (members: TripMember[]) => void;
  reset: () => void;
}

function normalizeCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function emptyBalances(members: TripMember[]): Record<string, number> {
  return members.reduce<Record<string, number>>((acc, member) => {
    acc[member.userId] = 0;
    return acc;
  }, {});
}

function calculateBalances(expenses: Expense[], members: TripMember[]): SettlementResult {
  const balances = emptyBalances(members);

  expenses.forEach((expense) => {
    if (typeof balances[expense.paidBy] !== 'number') {
      balances[expense.paidBy] = 0;
    }

    balances[expense.paidBy] = normalizeCurrency(balances[expense.paidBy] + expense.amount);

    expense.splits.forEach((split) => {
      if (typeof balances[split.userId] !== 'number') {
        balances[split.userId] = 0;
      }
      balances[split.userId] = normalizeCurrency(balances[split.userId] - split.amount);
    });
  });

  const settlements = calculateSettlements(balances, members.length);

  return {
    balances,
    settlements,
  };
}

const initialState = {
  expenses: [] as Expense[],
  balances: {} as Record<string, number>,
  settlements: [] as SettlementResult['settlements'],
  loading: false,
  error: null as string | null,
  unsubscribe: null as (() => void) | null,
  members: [] as TripMember[],
};

export const useExpenseStore = create<ExpenseState>((set, get) => ({
  ...initialState,

  hydrate: async (tripId, members) => {
    set({ loading: true, error: null, members });

    // Clean up any existing listener
    get().unsubscribe?.();

    const result = await getExpenses(tripId);

    if (!result.ok) {
      set({ loading: false, error: result.error });
      return;
    }

    const ledger = calculateBalances(result.data, members);

    // Set up the listener
    const unsubscribe = listenToExpenses(
      tripId,
      (expenses) => {
        const currentMembers = get().members;
        const ledger = calculateBalances(expenses, currentMembers);
        set({ expenses, balances: ledger.balances, settlements: ledger.settlements, error: null });
      },
      (message) => {
        set({ error: message });
      },
    );

    set({
      loading: false,
      expenses: result.data,
      balances: ledger.balances,
      settlements: ledger.settlements,
      unsubscribe,
      error: null,
    });
  },


  addExpense: async (tripId, input, members) => {
    const result = await createExpense(tripId, input);
    if (!result.ok) {
      set({ error: result.error });
      return false;
    }

    const nextExpenses = [result.data, ...get().expenses];
    const ledger = calculateBalances(nextExpenses, members);
    set({ expenses: nextExpenses, balances: ledger.balances, settlements: ledger.settlements, error: null });
    return true;
  },

  editExpense: async (tripId, expenseId, updates, members) => {
    const result = await updateExpense(tripId, expenseId, updates);
    if (!result.ok) {
      set({ error: result.error });
      return false;
    }

    const nextExpenses = get().expenses.map((expense) =>
      expense.id === expenseId ? { ...expense, ...updates, updatedAt: Date.now() } : expense,
    );
    const ledger = calculateBalances(nextExpenses, members);
    set({ expenses: nextExpenses, balances: ledger.balances, settlements: ledger.settlements, error: null });
    return true;
  },

  deleteExpense: async (tripId, expenseId, members) => {
    const result = await removeExpense(tripId, expenseId);
    if (!result.ok) {
      set({ error: result.error });
      return false;
    }

    const nextExpenses = get().expenses.filter((expense) => expense.id !== expenseId);
    const ledger = calculateBalances(nextExpenses, members);
    set({ expenses: nextExpenses, balances: ledger.balances, settlements: ledger.settlements, error: null });
    return true;
  },

  recalculate: (members) => {
    set({ members });
    const { expenses } = get();
    const ledger = calculateBalances(expenses, members);
    set({ balances: ledger.balances, settlements: ledger.settlements });
  },

  reset: () => {
    get().unsubscribe?.();
    set(initialState);
  },
}));
