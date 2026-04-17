import type { TripMember } from '@/types';
import type { ExpenseSplit } from '@/features/expenses/types';

interface SplitBreakdownProps {
  members: TripMember[];
  splits: ExpenseSplit[];
  splitTypeLabel: string;
  amount: number;
  onAmountChange?: (userId: string, value: number) => void;
  onPercentageChange?: (userId: string, value: number) => void;
}

export function SplitBreakdown({
  members,
  splits,
  splitTypeLabel,
  amount,
  onAmountChange,
  onPercentageChange,
}: SplitBreakdownProps) {
  const splitMap = splits.reduce<Record<string, ExpenseSplit>>((acc, split) => {
    acc[split.userId] = split;
    return acc;
  }, {});

  const splitTotal = splits.reduce((sum, split) => sum + split.amount, 0);

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-800">Split breakdown ({splitTypeLabel})</p>
        <p className="text-xs font-medium text-gray-500">
          Total {splitTotal.toFixed(2)} / {amount.toFixed(2)}
        </p>
      </div>

      <div className="space-y-2">
        {members.map((member) => {
          const split = splitMap[member.userId];
          if (!split) return null;

          return (
            <div key={member.userId} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg bg-white px-3 py-2">
              <div>
                <p className="text-sm font-medium text-gray-800">{member.displayName}</p>
                {typeof split.percentage === 'number' && (
                  <p className="text-xs text-gray-500">{split.percentage.toFixed(2)}%</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {onPercentageChange && (
                  <input
                    type="number"
                    value={split.percentage ?? 0}
                    min={0}
                    max={100}
                    step={0.01}
                    onChange={(event) => onPercentageChange(member.userId, Number(event.target.value))}
                    className="w-24 rounded-lg border border-gray-200 px-2 py-1 text-right text-sm text-gray-700"
                  />
                )}
                <input
                  type="number"
                  value={split.amount}
                  min={0}
                  step={0.01}
                  onChange={(event) => onAmountChange?.(member.userId, Number(event.target.value))}
                  readOnly={!onAmountChange}
                  className={[
                    'w-24 rounded-lg border px-2 py-1 text-right text-sm',
                    onAmountChange ? 'border-gray-200 text-gray-700' : 'border-gray-100 bg-gray-100 text-gray-500',
                  ].join(' ')}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
