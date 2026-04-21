import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useTripStore } from './useTripStore';
import { subscribeTimeline } from '@/features/timeline/timelineService';
import type { TimelineEvent } from '@/types';
import { useTripMap } from './TripMapContext';
import { useWorkspacePanelStore } from './useWorkspacePanelStore';
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

interface BucketItemLoc {
  id: string;
  location?: { lat: number; lng: number };
  name?: string;
  address?: string;
  userData?: {
    proposedDate?: string;
    proposedTime?: string;
    activityType?: string;
  };
}

function normalizeLocation(raw: any): { lat: number; lng: number } | undefined {
  if (!raw || typeof raw !== 'object') return undefined;

  const latRaw = typeof raw.lat === 'function' ? raw.lat() : (raw.lat ?? raw.latitude);
  const lngRaw = typeof raw.lng === 'function' ? raw.lng() : (raw.lng ?? raw.longitude);
  const lat = Number(latRaw);
  const lng = Number(lngRaw);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  return { lat, lng };
}

function formatDurationTotal(totalMinutes: number): string {
  if (totalMinutes <= 0) return '0 min';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
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

function formatActivityCount(count: number): string {
  return `${count} ${count === 1 ? 'activity' : 'activities'}`;
}

function getEventDisplayLocation(
  event: TimelineEvent,
  bucketMetaById: Map<string, BucketItemLoc>,
): string {
  if (event.location?.trim()) return event.location;
  if (!event.bucketItemId) return '';
  return bucketMetaById.get(event.bucketItemId)?.address ?? '';
}

export function TripPlanningPage() {
  const { activeTrip } = useTripStore();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [bucketItems, setBucketItems] = useState<BucketItemLoc[]>([]);
  const { setMapMarkers } = useTripMap();
  const openPanels = useWorkspacePanelStore((s) => s.openPanels);
  const hasDiscoveryPanel = useMemo(
    () => openPanels.some((panel) => panel.key === 'discovery'),
    [openPanels],
  );
  const hasBucketPanel = useMemo(
    () => openPanels.some((panel) => panel.key === 'bucket-list'),
    [openPanels],
  );

  useEffect(() => {
    if (!activeTrip) return;
    const unsub = subscribeTimeline(activeTrip.id, setEvents, () => {});
    return unsub;
  }, [activeTrip]);

  useEffect(() => {
    if (!activeTrip) return;
    const q = query(collection(db, 'trips', activeTrip.id, 'bucketList'));
    return onSnapshot(q, (snap) => {
      setBucketItems(
        snap.docs.map((d) => {
          const data = d.data();
          const userData = data.userData ?? {};
          return {
            id: d.id,
            location: normalizeLocation(data.location),
            name: data.name ?? undefined,
            address: data.address ?? undefined,
            userData: {
              proposedDate: typeof userData.proposedDate === 'string' ? userData.proposedDate : undefined,
              proposedTime: typeof userData.proposedTime === 'string' ? userData.proposedTime : undefined,
              activityType: typeof userData.activityType === 'string' ? userData.activityType : undefined,
            },
          };
        }),
      );
    });
  }, [activeTrip]);

  useEffect(() => {
    // Priority order for map content: discovery > bucket-list > planning.
    // If higher-priority panels are open, planning does not override markers.
    if (hasDiscoveryPanel || hasBucketPanel) return;

    const locationMap = new Map<string, { lat: number; lng: number }>();
    for (const item of bucketItems) {
      if (item.location) locationMap.set(item.id, item.location);
    }

    const relevantEvents = expandedDay
      ? events.filter((ev) => ev.date === expandedDay)
      : events;

    const markers = relevantEvents
      .filter((ev) => ev.bucketItemId && locationMap.has(ev.bucketItemId))
      .map((ev) => ({
        id: ev.id,
        position: locationMap.get(ev.bucketItemId!)!,
        title: ev.title,
        color: ev.color,
      }));

    setMapMarkers(markers);
  }, [events, bucketItems, expandedDay, setMapMarkers, hasDiscoveryPanel, hasBucketPanel]);

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
  const bucketMetaById = useMemo(
    () => new Map(bucketItems.map((item) => [item.id, item])),
    [bucketItems],
  );

  function handleToggleDay(day: string) {
    setExpandedDay((prev) => (prev === day ? null : day));
  }

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

            <div className="mt-2 text-xs" style={{ color: 'var(--wb-ink-soft)' }}>
              {expandedDay
                ? 'Map filtered to selected day. Click the day again to show all scheduled events.'
                : 'Map currently shows all scheduled events across the trip.'}
            </div>
          </div>

          <div
            className="rounded-[16px] border overflow-hidden"
            style={{ background: '#fff', borderColor: 'var(--wb-line)', boxShadow: 'var(--wb-shadow-sm)' }}
          >
            <div className="p-3">
              {tripDays.map((dateStr, idx) => {
                const dayEvents = events
                  .filter((e) => e.date === dateStr)
                  .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));

                const isExpanded = expandedDay === dateStr;
                const previewEvents = dayEvents.slice(0, 2);

                return (
                  <DayCard
                    key={dateStr}
                    dateStr={dateStr}
                    dayIndex={idx}
                    title={formatDayTitle(dateStr)}
                    subtitle={`Day ${idx + 1} of ${tripDays.length}`}
                    weatherLabel={formatActivityCount(dayEvents.length)}
                  >
                    <div
                      className="mb-2.5 flex items-center justify-between rounded-xl border px-3 py-2"
                      style={{ borderColor: 'var(--wb-line)', background: 'var(--wb-paper-2)' }}
                    >
                      <p className="text-xs font-semibold" style={{ color: 'var(--wb-ink-soft)' }}>
                        {isExpanded ? 'Day expanded' : 'Day collapsed'}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleToggleDay(dateStr)}
                        className="wb-btn wb-btn-ghost wb-btn-sm"
                      >
                        {isExpanded ? 'Collapse day' : 'Expand day'}
                      </button>
                    </div>

                    {isExpanded ? (
                      dayEvents.length > 0 ? (
                        dayEvents.map((ev) => (
                          <SlotRow
                            key={ev.id}
                            event={{
                              ...ev,
                              location: getEventDisplayLocation(ev, bucketMetaById),
                            }}
                          />
                        ))
                      ) : (
                        <EmptySlotRow label="No activities scheduled for this day yet." />
                      )
                    ) : (
                      dayEvents.length > 0 ? (
                        <div className="space-y-2">
                          {previewEvents.map((ev) => {
                            const place = getEventDisplayLocation(ev, bucketMetaById) || 'Location not set';
                            return (
                              <div
                                key={ev.id}
                                className="rounded-xl border px-3 py-2"
                                style={{ borderColor: 'var(--wb-line)', background: '#fff' }}
                              >
                                <p className="text-sm font-semibold truncate" style={{ color: 'var(--wb-ink)' }}>
                                  {ev.startTime} · {ev.title}
                                </p>
                                <p className="text-xs truncate" style={{ color: 'var(--wb-ink-soft)' }}>
                                  📍 {place}
                                </p>
                              </div>
                            );
                          })}
                          {dayEvents.length > 2 && (
                            <p className="text-xs" style={{ color: 'var(--wb-ink-soft)' }}>
                              +{dayEvents.length - 2} more activities. Expand day to view all.
                            </p>
                          )}
                        </div>
                      ) : (
                        <EmptySlotRow label="Expand day to add activities and filter map markers." />
                      )
                    )}
                  </DayCard>
                );
              })}
            </div>
          </div>
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
