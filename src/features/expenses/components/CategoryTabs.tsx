import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_KEYS } from '@/features/expenses/services/categories';
import type { ExpenseCategoryKey } from '@/features/expenses/types';

interface CategoryTabsProps {
  category: ExpenseCategoryKey;
  subcategory: string;
  onCategoryChange: (category: ExpenseCategoryKey) => void;
  onSubcategoryChange: (subcategory: string) => void;
}

export function CategoryTabs({
  category,
  subcategory,
  onCategoryChange,
  onSubcategoryChange,
}: CategoryTabsProps) {
  const subcategories = EXPENSE_CATEGORIES[category].subcategories;

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Category
        </label>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {EXPENSE_CATEGORY_KEYS.map((key) => {
            const cat = EXPENSE_CATEGORIES[key];
            const isSelected = key === category;

            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  onCategoryChange(key);
                  onSubcategoryChange(EXPENSE_CATEGORIES[key].subcategories[0]);
                }}
                className={[
                  'flex flex-col items-center gap-2 rounded-xl border p-3 text-xs font-medium transition-all hover:scale-105',
                  isSelected
                    ? `${cat.color} border-current shadow-sm`
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
                ].join(' ')}
              >
                <span className="text-lg">{cat.icon}</span>
                <span className="text-center leading-tight">{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label htmlFor="expense-subcategory" className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Subcategory
        </label>
        <select
          id="expense-subcategory"
          className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          value={subcategory}
          onChange={(event) => onSubcategoryChange(event.target.value)}
        >
          {subcategories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
