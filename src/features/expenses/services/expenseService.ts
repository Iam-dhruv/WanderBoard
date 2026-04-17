import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { err, ok, type Result } from '@/types';
import type { Expense, ExpenseInput } from '@/features/expenses/types';

const expensesCol = (tripId: string) => collection(db, 'trips', tripId, 'expenses');
const expenseDoc = (tripId: string, expenseId: string) => doc(db, 'trips', tripId, 'expenses', expenseId);

function toExpense(id: string, data: Record<string, unknown>): Expense {
  const now = Date.now();
  return {
    id,
    tripId: String(data.tripId ?? ''),
    paidBy: String(data.paidBy ?? ''),
    amount: Number(data.amount ?? 0),
    category: data.category as Expense['category'],
    subcategory: String(data.subcategory ?? 'Other'),
    description: String(data.description ?? ''),
    date: Number(data.date ?? now),
    splitType: data.splitType as Expense['splitType'],
    splits: Array.isArray(data.splits)
      ? data.splits.map((split) => ({
          userId: String((split as Record<string, unknown>).userId ?? ''),
          amount: Number((split as Record<string, unknown>).amount ?? 0),
          percentage:
            typeof (split as Record<string, unknown>).percentage === 'number'
              ? Number((split as Record<string, unknown>).percentage)
              : undefined,
        }))
      : [],
    settled: Boolean(data.settled ?? false),
    createdAt: Number(data.createdAt ?? now),
    updatedAt: Number(data.updatedAt ?? now),
  };
}

export async function createExpense(tripId: string, input: ExpenseInput): Promise<Result<Expense>> {
  try {
    const now = Date.now();
    const payload = {
      ...input,
      tripId,
      settled: false,
      createdAt: now,
      updatedAt: now,
    };

    const ref = await addDoc(expensesCol(tripId), payload);
    return ok(toExpense(ref.id, payload));
  } catch (e: any) {
    console.error('[createExpense]', e);
    return err('Failed to create expense. Please retry.');
  }
}

export async function updateExpense(
  tripId: string,
  expenseId: string,
  updates: Partial<ExpenseInput>,
): Promise<Result<void>> {
  try {
    await updateDoc(expenseDoc(tripId, expenseId), {
      ...updates,
      updatedAt: Date.now(),
    });
    return ok(undefined);
  } catch (e: any) {
    console.error('[updateExpense]', e);
    return err('Failed to update expense.');
  }
}

export async function removeExpense(tripId: string, expenseId: string): Promise<Result<void>> {
  try {
    await deleteDoc(expenseDoc(tripId, expenseId));
    return ok(undefined);
  } catch (e: any) {
    console.error('[removeExpense]', e);
    return err('Failed to delete expense.');
  }
}

export async function getExpenses(tripId: string): Promise<Result<Expense[]>> {
  try {
    const expenseQuery = query(expensesCol(tripId), orderBy('createdAt', 'desc'));
    const snap = await getDocs(expenseQuery);
    return ok(snap.docs.map((item) => toExpense(item.id, item.data())));
  } catch (e: any) {
    console.error('[getExpenses]', e);
    const message = e?.message ? `Failed to fetch expenses: ${e.message}` : 'Failed to fetch expenses.';
    return err(message);
  }
}

export function listenToExpenses(
  tripId: string,
  onUpdate: (expenses: Expense[]) => void,
  onError?: (message: string) => void,
): () => void {
  console.log('[listenToExpenses] Setting up listener for trip:', tripId);
  const expenseQuery = query(expensesCol(tripId), orderBy('createdAt', 'desc'));

  return onSnapshot(
    expenseQuery,
    (snap) => {
      console.log('[listenToExpenses] Received update with', snap.docs.length, 'expenses');
      onUpdate(snap.docs.map((docSnap) => toExpense(docSnap.id, docSnap.data())));
    },
    (error) => {
      console.error('[listenToExpenses] Listener error:', error);
      const message = error?.message ? `Unable to watch expense updates: ${error.message}` : 'Unable to watch expense updates.';
      onError?.(message);
    },
  );
}
