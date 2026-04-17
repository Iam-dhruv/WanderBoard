import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTripStore } from '@/features/trips/useTripStore';
import { ExpenseForm } from '@/features/expenses/components/ExpenseForm';
import { SettlementSummary } from '@/features/expenses/components/SettlementSummary';
import { BalanceLedger } from '@/features/expenses/components/BalanceLedger';
import { ExpenseList } from '@/features/expenses/components/ExpenseList';
import { ExpenseChart } from '@/features/expenses/components/ExpenseChart';
import { IndividualBreakdown } from '@/features/expenses/components/IndividualBreakdown';
import { useExpenseStore } from '@/features/expenses/useExpenseStore';
import type { ExpenseInput } from '@/features/expenses/types';

export function ExpensesPage() {
  const { user } = useAuth();
  const { activeTrip, members } = useTripStore();
  const {
    expenses,
    balances,
    settlements,
    loading,
    error,
    hydrate,
    addExpense,
    deleteExpense,
    recalculate,
    reset,
  } = useExpenseStore();

  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(() => {
    if (!activeTrip || members.length === 0) {
      return;
    }

    hydrate(activeTrip.id, members);

    return () => {
      reset();
    };
  }, [activeTrip, members]);

  useEffect(() => {
    if (members.length > 0) {
      recalculate(members);
    }
  }, [members]);

  const totalExpense = useMemo(
    () => expenses.reduce((sum, expense) => sum + expense.amount, 0),
    [expenses],
  );

  if (!activeTrip) {
    return null;
  }

  const defaultPaidBy = user?.uid ?? members[0]?.userId ?? '';

  const handleAddExpense = async (input: ExpenseInput): Promise<boolean> => {
    return addExpense(activeTrip.id, input, members);
  };

  const handleDeleteExpense = async (expenseId: string) => {
    await deleteExpense(activeTrip.id, expenseId, members);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Expenses</p>
            <h2 className="mt-2 text-2xl font-semibold text-gray-900">Track and split group spend</h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              Add expenses quickly by category and subcategory, split with selected members, and settle balances automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsFormOpen(true)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Add expense
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <StatCard label="Total expenses" value={totalExpense.toFixed(2)} />
          <StatCard label="Logged entries" value={String(expenses.length)} />
          <StatCard label="Active settlements" value={String(settlements.length)} />
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}
      </section>

      {loading ? (
        <section className="rounded-2xl border border-gray-100 bg-white p-6 text-sm text-gray-500 shadow-sm">Loading expenses...</section>
      ) : (
        <>
          <ExpenseChart expenses={expenses} members={members} />

          <IndividualBreakdown expenses={expenses} members={members} />

          <div className="grid gap-6 lg:grid-cols-2">
            <SettlementSummary settlements={settlements} members={members} />
            <BalanceLedger balances={balances} members={members} />
          </div>

          <ExpenseList expenses={expenses} members={members} onDelete={handleDeleteExpense} />
        </>
      )}

      <ExpenseForm
        isOpen={isFormOpen}
        members={members}
        defaultPaidBy={defaultPaidBy}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleAddExpense}
        submitError={error}
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-gray-900">{value}</p>
    </div>
  );
}
