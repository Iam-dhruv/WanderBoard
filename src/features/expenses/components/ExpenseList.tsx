import type { TripMember } from '@/types';
import type { Expense } from '@/features/expenses/types';

interface ExpenseListProps {
  expenses: Expense[];
  members: TripMember[];
  onDelete: (expenseId: string) => void;
}

function nameById(userId: string, members: TripMember[]): string {
  return members.find((member) => member.userId === userId)?.displayName ?? 'Traveler';
}

export function ExpenseList({ expenses, members, onDelete }: ExpenseListProps) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">Expense history</h3>
        <span className="text-xs text-gray-500">{expenses.length} entries</span>
      </div>

      {expenses.length === 0 ? (
        <p className="text-sm text-gray-500">No expenses logged yet.</p>
      ) : (
        <div className="space-y-3">
          {expenses.map((expense) => (
            <article key={expense.id} className="rounded-xl border border-gray-100 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{expense.description || expense.subcategory}</p>
                  <p className="text-xs text-gray-500">
                    {expense.category} / {expense.subcategory} | Paid by {nameById(expense.paidBy, members)}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">{new Date(expense.date).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">{expense.amount.toFixed(2)}</p>
                  <button
                    type="button"
                    onClick={() => onDelete(expense.id)}
                    className="mt-2 rounded-md border border-rose-200 px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {expense.splits.map((split) => (
                  <div key={`${expense.id}-${split.userId}`} className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                    <span className="font-medium text-gray-800">{nameById(split.userId, members)}</span>
                    {' owes '}
                    <span className="font-semibold">{split.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
