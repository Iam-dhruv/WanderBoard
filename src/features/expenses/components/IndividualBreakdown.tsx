import type { Expense } from '@/features/expenses/types';
import type { TripMember } from '@/types';
import { EXPENSE_CATEGORIES } from '@/features/expenses/services/categories';

interface IndividualBreakdownProps {
  expenses: Expense[];
  members: TripMember[];
}

export function IndividualBreakdown({ expenses, members }: IndividualBreakdownProps) {
  const breakdownExpenses = expenses.filter((expense) => expense.entryType !== 'settlement');

  // Calculate owed share by member and category
  const memberCategoryTotals = members.map(member => {
    const categoryTotals: Record<string, number> = {};
    let totalSpent = 0;
    let expenseCount = 0;

    breakdownExpenses.forEach(expense => {
      const split = expense.splits.find((item) => item.userId === member.userId);
      if (!split) {
        return;
      }

      const category = EXPENSE_CATEGORIES[expense.category].label;
      categoryTotals[category] = (categoryTotals[category] || 0) + split.amount;
      totalSpent += split.amount;
      expenseCount += 1;
    });

    return {
      member,
      categoryTotals,
      totalSpent,
      expenseCount,
    };
  }).filter(item => item.totalSpent > 0);

  if (memberCategoryTotals.length === 0) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-6">
        <h3 className="text-lg font-semibold text-gray-900">Individual Breakdown</h3>
        <div className="mt-4 flex h-32 items-center justify-center">
          <div className="text-center">
            <div className="text-3xl">👥</div>
            <p className="mt-2 text-sm text-gray-500">No individual expenses yet</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6">
      <h3 className="text-lg font-semibold text-gray-900">Individual Breakdown</h3>
      <div className="mt-6 space-y-6">
        {memberCategoryTotals.map(({ member, categoryTotals, totalSpent, expenseCount }) => (
          <div key={member.userId} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900">
                  {member.displayName || member.email || 'Unknown Member'}
                </h4>
                <p className="text-sm text-gray-500">
                  {expenseCount} expense{expenseCount !== 1 ? 's' : ''} • ${totalSpent.toFixed(2)} total
                </p>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold text-gray-900">
                  ${totalSpent.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Object.entries(categoryTotals).map(([category, amount]) => {
                const categoryKey = Object.keys(EXPENSE_CATEGORIES).find(
                  key => EXPENSE_CATEGORIES[key as keyof typeof EXPENSE_CATEGORIES].label === category
                );
                const categoryData = categoryKey ? EXPENSE_CATEGORIES[categoryKey as keyof typeof EXPENSE_CATEGORIES] : null;

                return (
                  <div
                    key={category}
                    className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{categoryData?.icon || '📦'}</span>
                      <span className="text-gray-600">{category}</span>
                    </div>
                    <span className="font-medium text-gray-900">${amount.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}