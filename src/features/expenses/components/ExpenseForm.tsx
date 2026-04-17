import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui';
import type { TripMember } from '@/types';
import { CategoryTabs } from '@/features/expenses/components/CategoryTabs';
import { SplitSelector } from '@/features/expenses/components/SplitSelector';
import { SplitBreakdown } from '@/features/expenses/components/SplitBreakdown';
import { EXPENSE_CATEGORIES } from '@/features/expenses/services/categories';
import type {
  ExpenseCategoryKey,
  ExpenseInput,
  ExpenseSplit,
  ExpenseSplitType,
} from '@/features/expenses/types';

interface ExpenseFormProps {
  isOpen: boolean;
  members: TripMember[];
  defaultPaidBy: string;
  onClose: () => void;
  onSubmit: (input: ExpenseInput) => Promise<boolean>;
  submitError?: string | null;
}

function normalizeCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function distributeEqual(amount: number, memberIds: string[]): ExpenseSplit[] {
  if (memberIds.length === 0 || amount <= 0) {
    return [];
  }

  const totalCents = Math.round(amount * 100);
  const base = Math.floor(totalCents / memberIds.length);
  const remainder = totalCents - base * memberIds.length;

  return memberIds.map((userId, index) => ({
    userId,
    amount: (base + (index < remainder ? 1 : 0)) / 100,
    percentage: normalizeCurrency(100 / memberIds.length),
  }));
}

function sumAmount(splits: ExpenseSplit[]): number {
  return normalizeCurrency(splits.reduce((sum, split) => sum + split.amount, 0));
}

export function ExpenseForm({ isOpen, members, defaultPaidBy, onClose, onSubmit, submitError }: ExpenseFormProps) {
  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paidBy, setPaidBy] = useState(defaultPaidBy);
  const [category, setCategory] = useState<ExpenseCategoryKey>('food');
  const [subcategory, setSubcategory] = useState(EXPENSE_CATEGORIES.food.subcategories[0]);
  const [splitType, setSplitType] = useState<ExpenseSplitType>('equal');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(members.map((member) => member.userId));
  const [percentageByUser, setPercentageByUser] = useState<Record<string, number>>({});
  const [fixedByUser, setFixedByUser] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setPaidBy(defaultPaidBy);
    setSelectedMemberIds(members.map((member) => member.userId));
  }, [defaultPaidBy, isOpen, members]);

  useEffect(() => {
    if (splitType !== 'percentage' || selectedMemberIds.length === 0) {
      return;
    }

    const even = normalizeCurrency(100 / selectedMemberIds.length);
    const next: Record<string, number> = {};
    selectedMemberIds.forEach((userId) => {
      next[userId] = percentageByUser[userId] ?? even;
    });
    setPercentageByUser(next);
  }, [selectedMemberIds, splitType]);

  useEffect(() => {
    if (splitType !== 'fixed' || selectedMemberIds.length === 0) {
      return;
    }

    const even = amount > 0 ? normalizeCurrency(amount / selectedMemberIds.length) : 0;
    const next: Record<string, number> = {};
    selectedMemberIds.forEach((userId) => {
      next[userId] = fixedByUser[userId] ?? even;
    });
    setFixedByUser(next);
  }, [amount, selectedMemberIds, splitType]);

  const selectedMembers = useMemo(
    () => members.filter((member) => selectedMemberIds.includes(member.userId)),
    [members, selectedMemberIds],
  );

  const splits = useMemo(() => {
    if (amount <= 0) {
      return [] as ExpenseSplit[];
    }

    if (splitType === 'equal') {
      return distributeEqual(amount, selectedMemberIds);
    }

    if (splitType === 'percentage') {
      const percentages = selectedMemberIds.map((userId) => ({
        userId,
        percentage: normalizeCurrency(percentageByUser[userId] ?? 0),
      }));
      const next = percentages.map((entry) => ({
        userId: entry.userId,
        percentage: entry.percentage,
        amount: normalizeCurrency((entry.percentage / 100) * amount),
      }));

      const total = sumAmount(next);
      const delta = normalizeCurrency(amount - total);
      if (next.length > 0 && Math.abs(delta) >= 0.01) {
        next[next.length - 1].amount = normalizeCurrency(next[next.length - 1].amount + delta);
      }
      return next;
    }

    return selectedMemberIds.map((userId) => ({
      userId,
      amount: normalizeCurrency(fixedByUser[userId] ?? 0),
    }));
  }, [amount, fixedByUser, percentageByUser, selectedMemberIds, splitType]);

  const splitTotal = useMemo(() => sumAmount(splits), [splits]);

  const percentageTotal = useMemo(
    () => normalizeCurrency(selectedMemberIds.reduce((sum, userId) => sum + (percentageByUser[userId] ?? 0), 0)),
    [percentageByUser, selectedMemberIds],
  );

  const resetForm = () => {
    setAmount(0);
    setDescription('');
    setDate(new Date().toISOString().slice(0, 10));
    setCategory('food');
    setSubcategory(EXPENSE_CATEGORIES.food.subcategories[0]);
    setSplitType('equal');
    setSelectedMemberIds(members.map((member) => member.userId));
    setPercentageByUser({});
    setFixedByUser({});
    setValidationError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (amount <= 0) {
      setValidationError('Enter a valid amount.');
      return;
    }

    if (selectedMemberIds.length === 0) {
      setValidationError('Select at least one traveler for split.');
      return;
    }

    if (splitType === 'percentage' && Math.abs(percentageTotal - 100) > 0.01) {
      setValidationError('Percentages must add up to 100.');
      return;
    }

    if (Math.abs(splitTotal - amount) > 0.01) {
      setValidationError('Split total must match the expense amount.');
      return;
    }

    setSubmitting(true);
    setValidationError(null);

    const success = await onSubmit({
      paidBy,
      amount: normalizeCurrency(amount),
      category,
      subcategory,
      description: description.trim(),
      date: new Date(`${date}T00:00:00`).getTime(),
      splitType,
      splits,
    });

    setSubmitting(false);

    if (success) {
      resetForm();
      onClose();
    } else {
      setValidationError('Unable to save expense. Please check the top banner for details.');
    }
  };

  return (
    <Modal title="Add expense" isOpen={isOpen} onClose={onClose}>
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="expense-amount" className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Amount
            </label>
            <input
              id="expense-amount"
              type="number"
              min={0}
              step={0.01}
              value={Number.isNaN(amount) ? '' : amount}
              onChange={(event) => setAmount(Number(event.target.value))}
              className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="0.00"
              required
            />
          </div>

          <div>
            <label htmlFor="expense-date" className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Date
            </label>
            <input
              id="expense-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="expense-description" className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Description
          </label>
          <input
            id="expense-description"
            type="text"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Dinner at local market"
            className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <CategoryTabs
          category={category}
          subcategory={subcategory}
          onCategoryChange={setCategory}
          onSubcategoryChange={setSubcategory}
        />

        <SplitSelector
          members={members}
          paidBy={paidBy}
          selectedMemberIds={selectedMemberIds}
          splitType={splitType}
          onPaidByChange={setPaidBy}
          onMemberToggle={(userId) => {
            setSelectedMemberIds((current) =>
              current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
            );
          }}
          onSelectAll={() => setSelectedMemberIds(members.map((member) => member.userId))}
          onClearSelection={() => setSelectedMemberIds([])}
          onSplitTypeChange={setSplitType}
        />

        <SplitBreakdown
          members={selectedMembers}
          splits={splits}
          splitTypeLabel={splitType}
          amount={amount}
          onAmountChange={
            splitType === 'fixed'
              ? (userId, value) => {
                  setFixedByUser((current) => ({ ...current, [userId]: normalizeCurrency(Math.max(0, value)) }));
                }
              : undefined
          }
          onPercentageChange={
            splitType === 'percentage'
              ? (userId, value) => {
                  setPercentageByUser((current) => ({ ...current, [userId]: normalizeCurrency(Math.max(0, value)) }));
                }
              : undefined
          }
        />

        {(validationError || submitError) && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {validationError || submitError}
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Saving...' : 'Save expense'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
