import { useEffect, useState } from 'react';
import { useTripStore } from './useTripStore';
import { subscribeTimeline } from '@/features/timeline/timelineService';
import type { TimelineEvent } from '@/types';
import { DayCard } from './components/DayCard';
import { SlotRow, EmptySlotRow } from './components/SlotRow';

function getDatesInRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(current.getTime()) || isNaN(end.getTime()) || current > end) return [];
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return dates;
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

  return (
    <div className="p-4">
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
          {tripDays.map((dateStr, idx) => {
            const dayEvents = events
              .filter((e) => e.date === dateStr)
              .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));

            return (
              <DayCard key={dateStr} dateStr={dateStr} dayIndex={idx}>
                {dayEvents.length > 0 ? (
                  dayEvents.map((ev) => <SlotRow key={ev.id} event={ev} />)
                ) : (
                  <EmptySlotRow label="+ Add activities via Timeline or Discovery" />
                )}
              </DayCard>
            );
          })}
        </>
      )}
    </div>
  );
}
