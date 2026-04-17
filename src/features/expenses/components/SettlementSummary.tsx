import type { TripMember } from '@/types';
import type { Settlement } from '@/features/expenses/types';

interface SettlementSummaryProps {
  settlements: Settlement[];
  members: TripMember[];
}

function nameById(userId: string, members: TripMember[]): string {
  return members.find((member) => member.userId === userId)?.displayName ?? 'Traveler';
}

export function SettlementSummary({ settlements, members }: SettlementSummaryProps) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">Suggested settlements</h3>
        <span className="text-xs text-gray-500">Splitwise style</span>
      </div>

      {settlements.length === 0 ? (
        <p className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Everyone is settled up.
        </p>
      ) : (
        <div className="space-y-2">
          {settlements.map((settlement, index) => (
            <div key={`${settlement.fromUser}-${settlement.toUser}-${index}`} className="rounded-lg border border-gray-100 px-3 py-2">
              <p className="text-sm text-gray-700">
                <span className="font-semibold text-rose-600">{nameById(settlement.fromUser, members)}</span>
                {' pays '}
                <span className="font-semibold text-emerald-600">{nameById(settlement.toUser, members)}</span>
              </p>
              <p className="mt-1 text-xs font-medium text-gray-500">Amount {settlement.amount.toFixed(2)}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
