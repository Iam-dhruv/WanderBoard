import type { TripMember } from '@/types';

interface BalanceLedgerProps {
  balances: Record<string, number>;
  members: TripMember[];
}

function resolveName(userId: string, members: TripMember[]): string {
  return members.find((member) => member.userId === userId)?.displayName ?? 'Unknown traveler';
}

export function BalanceLedger({ balances, members }: BalanceLedgerProps) {
  const entries = Object.entries(balances)
    .map(([userId, amount]) => ({
      userId,
      name: resolveName(userId, members),
      amount,
    }))
    .sort((a, b) => b.amount - a.amount);

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">Balance ledger</h3>
        <span className="text-xs text-gray-500">Net position</span>
      </div>

      <div className="space-y-2">
        {entries.map((entry) => (
          <div key={entry.userId} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
            <p className="text-sm font-medium text-gray-700">{entry.name}</p>
            <p
              className={[
                'text-sm font-semibold',
                entry.amount > 0.01
                  ? 'text-emerald-600'
                  : entry.amount < -0.01
                    ? 'text-rose-600'
                    : 'text-gray-500',
              ].join(' ')}
            >
              {entry.amount > 0 ? '+' : ''}
              {entry.amount.toFixed(2)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
