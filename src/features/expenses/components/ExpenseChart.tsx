import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import type { Expense } from '@/features/expenses/types';
import type { TripMember } from '@/types';
import { EXPENSE_CATEGORIES } from '@/features/expenses/services/categories';

interface ExpenseChartProps {
  expenses: Expense[];
  members: TripMember[];
}

const COLORS = [
  '#f97316', // orange
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#10b981', // green
  '#ec4899', // pink
  '#6366f1', // indigo
  '#eab308', // yellow
  '#ef4444', // red
  '#6b7280', // gray
];

export function ExpenseChart({ expenses, members }: ExpenseChartProps) {
  const chartExpenses = expenses.filter((expense) => expense.entryType !== 'settlement');

  // Calculate expenses by category
  const categoryData = Object.keys(EXPENSE_CATEGORIES).map((categoryKey, index) => {
    const category = EXPENSE_CATEGORIES[categoryKey as keyof typeof EXPENSE_CATEGORIES];
    const total = chartExpenses
      .filter(expense => expense.category === categoryKey)
      .reduce((sum, expense) => sum + expense.amount, 0);

    return {
      name: category.label,
      value: total,
      color: COLORS[index % COLORS.length],
      icon: category.icon,
    };
  }).filter(item => item.value > 0);

  // Calculate owed share by member from split amounts.
  const memberData = members.map(member => {
    const total = chartExpenses.reduce((sum, expense) => {
      const split = expense.splits.find((item) => item.userId === member.userId);
      return sum + (split?.amount ?? 0);
    }, 0);

    return {
      name: member.displayName || member.email || 'Unknown',
      total,
    };
  }).filter(item => item.total > 0);

  // Calculate owed share by member and category from splits.
  const memberCategoryData = members.map(member => {
    const data: Record<string, number> = {};

    chartExpenses.forEach(expense => {
      const split = expense.splits.find((item) => item.userId === member.userId);
      if (!split) {
        return;
      }

      const category = EXPENSE_CATEGORIES[expense.category].label;
      data[category] = (data[category] || 0) + split.amount;
    });

    return {
      name: member.displayName || member.email || 'Unknown',
      ...data,
    };
  }).filter(item => Object.keys(item).length > 1); // Has expenses

  if (chartExpenses.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-gray-100 bg-gray-50">
        <div className="text-center">
          <div className="text-4xl">📊</div>
          <p className="mt-2 text-sm text-gray-500">No expenses to visualize yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Category Breakdown */}
      <div className="rounded-xl border border-gray-100 bg-white p-6">
        <h3 className="text-lg font-semibold text-gray-900">Expenses by Category</h3>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                labelStyle={{ color: '#374151' }}
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {categoryData.map((item) => (
            <div key={item.name} className="flex items-center gap-2 text-sm">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-gray-600">{item.name}</span>
              <span className="font-medium text-gray-900">${item.value.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Member Spending */}
      {memberData.length > 0 && (
        <div className="rounded-xl border border-gray-100 bg-white p-6">
          <h3 className="text-lg font-semibold text-gray-900">Spending by Member</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={memberData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip
                  labelStyle={{ color: '#374151' }}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Member Category Breakdown */}
      {memberCategoryData.length > 0 && (
        <div className="rounded-xl border border-gray-100 bg-white p-6">
          <h3 className="text-lg font-semibold text-gray-900">Category Breakdown by Member</h3>
          <div className="mt-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={memberCategoryData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip
                  labelStyle={{ color: '#374151' }}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                {Object.keys(EXPENSE_CATEGORIES).map((categoryKey, index) => {
                  const category = EXPENSE_CATEGORIES[categoryKey as keyof typeof EXPENSE_CATEGORIES];
                  return (
                    <Bar
                      key={categoryKey}
                      dataKey={category.label}
                      stackId="a"
                      fill={COLORS[index % COLORS.length]}
                      radius={index === Object.keys(EXPENSE_CATEGORIES).length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                    />
                  );
                })}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}