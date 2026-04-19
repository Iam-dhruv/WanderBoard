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
import type { ExpenseInput, Settlement } from '@/features/expenses/types';

const BAR_COLORS = [
  'var(--wb-sunset)',
  'var(--wb-sun)',
  'var(--wb-ocean)',
  'var(--wb-moss)',
  'var(--wb-plum)',
];

export function ExpensesPage() {
  const { user } = useAuth();
  const { activeTrip, members } = useTripStore();
  const { expenses, balances, settlements, loading, error, hydrate, addExpense, deleteExpense, settleExpenses, settleOneSuggestion, recalculate, reset } = useExpenseStore();

  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(() => {
    if (!activeTrip || members.length === 0) return;
    hydrate(activeTrip.id, members);
    return () => { reset(); };
  }, [activeTrip, members]);

  useEffect(() => {
    if (members.length > 0) recalculate(members);
  }, [members]);

  const totalExpense = useMemo(
    () => expenses.filter((e) => e.entryType !== 'settlement').reduce((sum, e) => sum + e.amount, 0),
    [expenses],
  );

  const perPerson = members.length > 0 ? totalExpense / members.length : 0;

  const youAreOwed = user?.uid ? (balances[user.uid] ?? 0) : 0;

  if (!activeTrip) return null;

  const defaultPaidBy = user?.uid ?? members[0]?.userId ?? '';

  async function handleAddExpense(input: ExpenseInput): Promise<boolean> {
    return addExpense(activeTrip!.id, input, members);
  }
  async function handleDeleteExpense(expenseId: string) {
    await deleteExpense(activeTrip!.id, expenseId, members);
  }
  async function handleSettleExpenses() {
    await settleExpenses(activeTrip!.id, members);
  }
  async function handleSettleOneSuggestion(settlement: Settlement) {
    await settleOneSuggestion(activeTrip!.id, settlement, members);
  }

  return (
    <div className="space-y-4 p-4">

      {/* ── WB Ledger strip ── */}
      <div
        className="rounded-[16px] border p-4"
        style={{ background: '#fff', borderColor: 'var(--wb-line)', boxShadow: 'var(--wb-shadow-sm)' }}
      >
        <div className="flex items-center justify-between">
          <div>
            <div
              className="text-[11px] font-bold uppercase tracking-[0.12em] mb-1"
              style={{ color: 'var(--wb-ink-soft)' }}
            >
              Group ledger
            </div>
            <div
              className="font-fraunces font-bold text-[28px] leading-none tracking-tight"
              style={{ color: 'var(--wb-ink)' }}
            >
              {activeTrip.currency} {totalExpense.toFixed(2)}
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--wb-ink-soft)' }}>
              spent so far · {activeTrip.currency} {perPerson.toFixed(2)} pp
            </div>
          </div>
          <div className="text-right">
            <div
              className="text-[11px] font-bold uppercase tracking-[0.1em] mb-1"
              style={{ color: 'var(--wb-ink-soft)' }}
            >
              {youAreOwed >= 0 ? "You're owed" : "You owe"}
            </div>
            <div
              className="font-fraunces font-bold text-[24px] leading-none tracking-tight"
              style={{ color: youAreOwed >= 0 ? 'var(--wb-moss)' : 'var(--wb-sunset)' }}
            >
              {youAreOwed >= 0 ? '+' : ''}{activeTrip.currency} {Math.abs(youAreOwed).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Stacked bar */}
        <div className="wb-balance-bar mt-3">
          {BAR_COLORS.map((color, i) => {
            const pct = Math.floor(100 / BAR_COLORS.length);
            return (
              <div
                key={i}
                style={{ width: `${i === BAR_COLORS.length - 1 ? 100 - pct * (BAR_COLORS.length - 1) : pct}%`, background: color }}
              />
            );
          })}
        </div>

        <div className="flex justify-between text-[11px] mt-1.5" style={{ color: 'var(--wb-ink-soft)' }}>
          <span>Stay</span><span>Food</span><span>Fuel</span><span>Activities</span><span>Other</span>
        </div>
      </div>

      {/* ── Add expense header ── */}
      <div
        className="rounded-[16px] border p-5"
        style={{ background: '#fff', borderColor: 'var(--wb-line)', boxShadow: 'var(--wb-shadow-sm)' }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--wb-ocean)' }}>Expenses</p>
            <h2 className="mt-1.5 font-fraunces text-[22px] font-bold tracking-tight" style={{ color: 'var(--wb-ink)' }}>
              Track and split group spend
            </h2>
            <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--wb-ink-soft)' }}>
              Add expenses by category, split with members, and settle balances automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsFormOpen(true)}
            className="wb-btn wb-btn-accent wb-btn-sm"
          >
            + Add expense
          </button>
        </div>

        {/* Stats */}
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <StatCard label="Total expenses" value={`${activeTrip.currency} ${totalExpense.toFixed(2)}`} />
          <StatCard label="Logged entries"      value={String(expenses.length)} />
          <StatCard label="Active settlements"  value={String(settlements.length)} />
        </div>

        {error && (
          <div
            className="mt-4 rounded-[10px] border px-3 py-2 text-sm"
            style={{ background: 'rgba(232,93,47,0.08)', borderColor: 'rgba(232,93,47,0.2)', color: 'var(--wb-sunset)' }}
          >
            {error}
          </div>
        )}
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div
          className="rounded-[16px] border p-6 text-sm"
          style={{ background: '#fff', borderColor: 'var(--wb-line)', color: 'var(--wb-ink-soft)' }}
        >
          Loading expenses…
        </div>
      ) : (
        <>
          <ExpenseChart expenses={expenses} members={members} />
          <IndividualBreakdown expenses={expenses} members={members} />
          <div className="grid gap-4 lg:grid-cols-2">
            <SettlementSummary settlements={settlements} members={members} onSettleOutstanding={handleSettleExpenses} onSettleOne={handleSettleOneSuggestion} />
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
    <div className="rounded-xl px-4 py-3" style={{ background: 'var(--wb-paper-2)', border: '1px solid var(--wb-line)' }}>
      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--wb-ink-soft)' }}>{label}</p>
      <p className="mt-1.5 text-lg font-bold font-fraunces tracking-tight" style={{ color: 'var(--wb-ink)' }}>{value}</p>
    </div>
  );
}
