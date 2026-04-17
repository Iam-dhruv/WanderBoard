import type { TripMember } from '@/types';
import type { ExpenseSplitType } from '@/features/expenses/types';

interface SplitSelectorProps {
  members: TripMember[];
  paidBy: string;
  selectedMemberIds: string[];
  splitType: ExpenseSplitType;
  onPaidByChange: (userId: string) => void;
  onMemberToggle: (userId: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onSplitTypeChange: (type: ExpenseSplitType) => void;
}

export function SplitSelector({
  members,
  paidBy,
  selectedMemberIds,
  splitType,
  onPaidByChange,
  onMemberToggle,
  onSelectAll,
  onClearSelection,
  onSplitTypeChange,
}: SplitSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="expense-paid-by" className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Paid by
          </label>
          <select
            id="expense-paid-by"
            value={paidBy}
            onChange={(event) => onPaidByChange(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700"
          >
            {members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.displayName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="expense-split-type" className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Split type
          </label>
          <select
            id="expense-split-type"
            value={splitType}
            onChange={(event) => onSplitTypeChange(event.target.value as ExpenseSplitType)}
            className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700"
          >
            <option value="equal">Equal</option>
            <option value="percentage">Percentage</option>
            <option value="fixed">Fixed amount</option>
          </select>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Split with</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSelectAll}
              className="rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              All
            </button>
            <button
              type="button"
              onClick={onClearSelection}
              className="rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {members.map((member) => {
            const checked = selectedMemberIds.includes(member.userId);
            return (
              <label
                key={member.userId}
                className={[
                  'flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors',
                  checked ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-700',
                ].join(' ')}
              >
                <span>{member.displayName}</span>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onMemberToggle(member.userId)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                />
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
