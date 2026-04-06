import { useTripStore } from './useTripStore';

export function TripPlanningPage() {
  const { activeTrip } = useTripStore();

  if (!activeTrip) {
    return null;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white border border-gray-100 p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Planning</p>
        <h2 className="mt-2 text-2xl font-semibold text-gray-900">Plan your trip together</h2>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          This is the starting point for trip coordination. The bucket list, discovery, expenses,
          and contingency features live in the other tabs once they are built.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <InfoCard label="Destination" value={activeTrip.destination} />
        <InfoCard label="Travel dates" value={`${activeTrip.startDate} → ${activeTrip.endDate}`} />
        <InfoCard label="Invite code" value={activeTrip.inviteCode} mono />
        <InfoCard label="Status" value="Workspace ready" />
      </section>
    </div>
  );
}

function InfoCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`mt-2 text-sm font-medium text-gray-900 ${mono ? 'font-mono tracking-widest' : ''}`}>
        {value}
      </p>
    </div>
  );
}