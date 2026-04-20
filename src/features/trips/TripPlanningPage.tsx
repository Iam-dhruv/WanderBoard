import { useEffect, useMemo, useState } from 'react';
import { useTripStore } from './useTripStore';
import { subscribeTimeline } from '@/features/timeline/timelineService';
import type { TimelineEvent } from '@/types';
import { DayCard } from './components/DayCard';
import { SlotRow, EmptySlotRow } from './components/SlotRow';

function getDatesInRange(startDate: string, endDate: string): string[] {
  const startMatch = startDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const endMatch = endDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!startMatch || !endMatch) return [];

  const dates: string[] = [];
  const current = new Date(Number(startMatch[1]), Number(startMatch[2]) - 1, Number(startMatch[3]));
  const end = new Date(Number(endMatch[1]), Number(endMatch[2]) - 1, Number(endMatch[3]));
  if (isNaN(current.getTime()) || isNaN(end.getTime()) || current > end) return [];

  while (current <= end) {
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    const d = String(current.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function formatDayTitle(dateStr: string): string {
  const parsed = Date.parse(`${dateStr}T12:00:00`);
  if (Number.isNaN(parsed)) return dateStr;
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(parsed));
}

function formatDurationTotal(totalMinutes: number): string {
  if (totalMinutes <= 0) return '0 min';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

function formatActivityCount(count: number): string {
  return `${count} ${count === 1 ? 'activity' : 'activities'}`;
}

export function TripPlanningPage() {
  const { activeTrip } = useTripStore();
  const [events, setEvents] = useState<TimelineEvent[]>([]);

  useEffect(() => {
    if (!activeTrip) return;
    const unsub = subscribeTimeline(activeTrip.id, setEvents, () => {});
    return unsub;
  }, [activeTrip]);

  if (!activeTrip) return null;

  const tripDays = getDatesInRange(activeTrip.startDate, activeTrip.endDate);
  const tripDaySet = useMemo(() => new Set(tripDays), [tripDays]);
  const plannedEvents = useMemo(
    () => events.filter((event) => tripDaySet.has(event.date)),
    [events, tripDaySet],
  );
  const daysWithPlans = useMemo(
    () => new Set(plannedEvents.map((event) => event.date)).size,
    [plannedEvents],
  );
  const totalPlannedMinutes = useMemo(
    () => plannedEvents.reduce((sum, event) => sum + (event.durationMinutes || 0), 0),
    [plannedEvents],
  );

  return (
    <div className="h-full overflow-y-auto p-4">
      {tripDays.length === 0 ? (
        <div
          className="rounded-[16px] p-8 text-center border-[1.5px] border-dashed"
          style={{ borderColor: 'var(--wb-line)', background: '#fff' }}
        >
          <p className="text-sm font-medium mb-3" style={{ color: 'var(--wb-ink-soft)' }}>
            Set trip dates to see your day-by-day plan.
          </p>
        </div>
      ) : (
        <>
          <div
            className="rounded-[16px] border p-4 mb-3.5"
            style={{ background: '#fff', borderColor: 'var(--wb-line)', boxShadow: 'var(--wb-shadow-sm)' }}
          >
            <p
              className="text-[11px] font-bold uppercase tracking-[0.16em] mb-2"
              style={{ color: 'var(--wb-ocean)' }}
            >
              Planning summary
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <SummaryPill label="Trip days" value={String(tripDays.length)} />
              <SummaryPill label="Planned activities" value={String(plannedEvents.length)} />
              <SummaryPill label="Planned time" value={formatDurationTotal(totalPlannedMinutes)} />
            </div>
            <p className="text-xs mt-2" style={{ color: 'var(--wb-ink-soft)' }}>
              {daysWithPlans} of {tripDays.length} days have planned activities.
            </p>
          </div>

          {tripDays.map((dateStr, idx) => {
            const dayEvents = events
              .filter((e) => e.date === dateStr)
              .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));

            return (
              <DayCard
                key={dateStr}
                dateStr={dateStr}
                dayIndex={idx}
                title={formatDayTitle(dateStr)}
                subtitle={`Day ${idx + 1} of ${tripDays.length}`}
                weatherLabel={formatActivityCount(dayEvents.length)}
              >
                {dayEvents.length > 0 ? (
                  dayEvents.map((ev) => <SlotRow key={ev.id} event={ev} />)
                ) : (
                  <EmptySlotRow label="+ Add activities from Timeline or Discovery" />
                )}
              </DayCard>
            );
          })}
        </>
      )}
    </div>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border px-3 py-2" style={{ borderColor: 'var(--wb-line)', background: 'var(--wb-paper-2)' }}>
      <p className="text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--wb-ink-soft)' }}>{label}</p>
      <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--wb-ink)' }}>{value}</p>
    </div>
  );
}
