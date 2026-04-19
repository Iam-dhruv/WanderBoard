// ─── TimelineGrid.tsx ─────────────────────────────────────────────────────────
// The main calendar grid:
//  - One column per trip day, time rows from START_HOUR to END_HOUR
//  - Owner can drag bucket-list cards or existing events onto any time slot
//  - Ghost preview during drag shows snapped position + conflict state
//  - On drop: IntervalTree detects conflicts → CspScheduler reflows → OTEngine
//    produces a safe operation → Firestore write
//  - Members see a live read-only view via onSnapshot

import { useCallback, useMemo, useRef, useState } from 'react';
import type { TimelineEvent, Trip } from '@/types';
import {
  IntervalTree,
  CspScheduler,
  OTEngine,
  checkConflict,
  type Interval,
  type ScheduledEvent,
  type OTOperation,
} from '@/lib/timelineAlgorithms';
import {
  createTimelineEvent,
  updateTimelineEvent,
  deleteTimelineEvent,
  pickEventColor,
} from '../timelineService';
import { EventCard } from './EventCard';
import type { BucketItem } from './BucketListSidebar';

// ─── Grid constants ───────────────────────────────────────────────────────────

const START_HOUR     = 6;   // 06:00
const END_HOUR       = 23;  // 23:00
const TOTAL_HOURS    = END_HOUR - START_HOUR;
const SLOT_HEIGHT_PX = 72; // height of each 1-hour slot
const PX_PER_MINUTE  = SLOT_HEIGHT_PX / 60;
const SNAP_TOLERANCE = 15; // minutes — smart edge-snap magnetic radius

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const cur = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate   + 'T00:00:00');
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function formatDayHeader(dateStr: string): { weekday: string; date: string } {
  const d = new Date(dateStr + 'T12:00:00');
  return {
    weekday: d.toLocaleDateString('en-IN', { weekday: 'short' }),
    date:    d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
  };
}

function eventsToIntervals(evs: TimelineEvent[]): Interval[] {
  return evs.map((ev) => ({
    id:              ev.id,
    start:           timeToMinutes(ev.startTime),
    end:             timeToMinutes(ev.startTime) + ev.durationMinutes,
    durationMinutes: ev.durationMinutes,
  }));
}

/** Magnetic edge-snap: if near an existing event boundary, snap to it. */
function applyEdgeSnap(
  snappedMinute: number,
  duration: number,
  dayEvents: TimelineEvent[],
  excludeId?: string,
): number {
  for (const ev of dayEvents) {
    if (excludeId && ev.id === excludeId) continue;
    const evStart = timeToMinutes(ev.startTime);
    const evEnd   = evStart + ev.durationMinutes;

    // Snap start → end of preceding event
    if (Math.abs(snappedMinute - evEnd) <= SNAP_TOLERANCE) {
      const candidate = evEnd;
      const others = eventsToIntervals(dayEvents.filter(
        (e2) => e2.id !== ev.id && (!excludeId || e2.id !== excludeId),
      ));
      if (!checkConflict(others, candidate, candidate + duration)) return candidate;
    }

    // Snap end → start of following event
    if (Math.abs((snappedMinute + duration) - evStart) <= SNAP_TOLERANCE) {
      const candidate = evStart - duration;
      if (candidate >= START_HOUR * 60) {
        const others = eventsToIntervals(dayEvents.filter(
          (e2) => e2.id !== ev.id && (!excludeId || e2.id !== excludeId),
        ));
        if (!checkConflict(others, candidate, candidate + duration)) return candidate;
      }
    }
  }
  return snappedMinute;
}

// ─── IntervalTree per day ─────────────────────────────────────────────────────

function buildDayTrees(events: TimelineEvent[]): Map<string, IntervalTree> {
  const map = new Map<string, IntervalTree>();
  for (const ev of events) {
    if (!map.has(ev.date)) map.set(ev.date, new IntervalTree());
    const tree  = map.get(ev.date)!;
    const start = timeToMinutes(ev.startTime);
    tree.insert({ id: ev.id, start, end: start + ev.durationMinutes, durationMinutes: ev.durationMinutes });
  }
  return map;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface TimelineGridProps {
  trip: Trip;
  events: TimelineEvent[];
  isOwner: boolean;
  currentUserId: string;
  draggingBucketItem: BucketItem | null;
  draggingExistingEvent: TimelineEvent | null;
  onDragEnd: () => void;
  onToast: (msg: string, type: 'success' | 'error' | 'warn') => void;
  onOpenCreateModal: (date: string, startTime: string) => void;
  filterDay?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TimelineGrid({
  trip,
  events,
  isOwner,
  currentUserId,
  draggingBucketItem,
  draggingExistingEvent,
  onDragEnd,
  onToast,
  onOpenCreateModal,
  filterDay,
}: TimelineGridProps) {
  const days = useMemo(() => {
    const all = dateRange(trip.startDate, trip.endDate);
    return filterDay ? all.filter((d) => d === filterDay) : all;
  }, [trip.startDate, trip.endDate, filterDay]);

  const dayTrees = useMemo(() => buildDayTrees(events), [events]);

  const otEngine    = useRef(new OTEngine());
  const pendingOps  = useRef<OTOperation[]>([]);

  const scheduler = useMemo(
    () => new CspScheduler([{ type: 'travel-buffer', bufferMinutes: 15 }]),
    [],
  );

  // Duration + excludeId for ghost preview in each DayColumn
  const draggingDuration = draggingBucketItem
    ? (draggingBucketItem.durationMinutes ?? 60)
    : (draggingExistingEvent?.durationMinutes ?? null);
  const draggingExcludeId = draggingExistingEvent?.id ?? null;

  // ── Drop handler ─────────────────────────────────────────────────────────────

  const handleDrop = useCallback(
    async (
      e: React.DragEvent<HTMLDivElement>,
      date: string,
      slotMinute: number,
    ) => {
      e.preventDefault();
      if (!isOwner) return;

      const sourceType    = e.dataTransfer.getData('sourceType');
      const snappedMinute = Math.round(slotMinute / 15) * 15;

      // ── A: Drop from bucket list ────────────────────────────────────────────
      if (sourceType === 'bucket') {
        const bucketItemId   = e.dataTransfer.getData('bucketItemId');
        const bucketItemName = e.dataTransfer.getData('bucketItemName');
        const bucketItemAddr = e.dataTransfer.getData('bucketItemAddress');

        // Read duration from drag data; default to 60 if absent / not quantised
        const rawDuration = parseInt(e.dataTransfer.getData('bucketItemDuration'), 10);
        const durationMinutes =
          Number.isFinite(rawDuration) && rawDuration > 0
            ? rawDuration % 15 === 0
              ? rawDuration
              : (() => {
                  console.warn(
                    '[TimelineGrid] Non-quantised duration from drag:', rawDuration, '— defaulting to 60',
                  );
                  return 60;
                })()
            : 60;

        const dayEvents  = events.filter((ev) => ev.date === date);
        const finalStart = applyEdgeSnap(snappedMinute, durationMinutes, dayEvents);
        const startMin   = finalStart;
        const endMin     = startMin + durationMinutes;

        const tree      = dayTrees.get(date) ?? new IntervalTree();
        const conflicts = tree.queryOverlap(startMin, endMin);

        const existingOnDay = dayEvents.map(
          (ev): ScheduledEvent => ({
            id:              ev.id,
            start:           timeToMinutes(ev.startTime),
            end:             timeToMinutes(ev.startTime) + ev.durationMinutes,
            durationMinutes: ev.durationMinutes,
            tags:            ev.tags ?? [],
          }),
        );

        const newScheduled: ScheduledEvent = {
          id:              `pending-${Date.now()}`,
          start:           startMin,
          end:             endMin,
          durationMinutes,
          tags:            [],
        };

        let resolvedStartMin = startMin;

        if (conflicts.length > 0) {
          const cspResult = scheduler.schedule(existingOnDay, newScheduled);
          if (!cspResult.ok) {
            onToast(cspResult.reason ?? 'No room on this day.', 'error');
            onDragEnd();
            return;
          }
          const placed = cspResult.events.find((ev) => ev.id === newScheduled.id);
          if (placed) resolvedStartMin = placed.start;
          if (cspResult.reason) onToast(`Scheduled with warning: ${cspResult.reason}`, 'warn');
        }

        const startTime = minutesToTime(resolvedStartMin);

        const op: OTOperation = {
          type:            'insert',
          eventId:         `bucket-${bucketItemId}-${Date.now()}`,
          timestamp:       Date.now(),
          day:             date,
          startTime,
          durationMinutes,
        };
        const transformed = otEngine.current.apply(op, pendingOps.current);
        pendingOps.current.push(transformed);

        const result = await createTimelineEvent({
          tripId:          trip.id,
          title:           bucketItemName,
          description:     '',
          location:        bucketItemAddr,
          date,
          startTime:       transformed.startTime ?? startTime,
          durationMinutes,
          color:           pickEventColor(events.length),
          tags:            [],
          sourceType:      'bucket',
          bucketItemId,
          createdBy:       currentUserId,
        });

        if (!result.ok) onToast(result.error, 'error');
        else onToast(`"${bucketItemName}" added to timeline!`, 'success');
      }

      // ── B: Move existing event ──────────────────────────────────────────────
      if (sourceType === 'existing') {
        const eventId = e.dataTransfer.getData('eventId');
        const target  = events.find((ev) => ev.id === eventId);
        if (!target) { onDragEnd(); return; }

        const durationMinutes = target.durationMinutes;
        const dayEvents       = events.filter((ev) => ev.date === date);
        const finalStart      = applyEdgeSnap(snappedMinute, durationMinutes, dayEvents, eventId);
        const startMin        = finalStart;
        const endMin          = startMin + durationMinutes;

        const tree     = dayTrees.get(date) ?? new IntervalTree();
        const tempTree = IntervalTree.fromArray(
          tree.toArray().filter((iv) => iv.id !== eventId),
        );
        const conflicts = tempTree.queryOverlap(startMin, endMin);

        if (conflicts.length > 0) {
          const existingOnDay = events
            .filter((ev) => ev.date === date && ev.id !== eventId)
            .map(
              (ev): ScheduledEvent => ({
                id:              ev.id,
                start:           timeToMinutes(ev.startTime),
                end:             timeToMinutes(ev.startTime) + ev.durationMinutes,
                durationMinutes: ev.durationMinutes,
                tags:            ev.tags ?? [],
              }),
            );
          const movedScheduled: ScheduledEvent = {
            id:              eventId,
            start:           startMin,
            end:             endMin,
            durationMinutes,
            tags:            target.tags ?? [],
          };
          const cspResult = scheduler.schedule(existingOnDay, movedScheduled);
          if (!cspResult.ok) {
            onToast(cspResult.reason ?? 'No room to move event here.', 'error');
            onDragEnd();
            return;
          }
        }

        const op: OTOperation = {
          type:      'move',
          eventId,
          timestamp: Date.now(),
          day:       date,
          startTime: minutesToTime(startMin),
        };
        const transformed = otEngine.current.apply(op, pendingOps.current);
        pendingOps.current.push(transformed);

        const result = await updateTimelineEvent({
          tripId:    trip.id,
          eventId:   transformed.eventId,
          date:      transformed.day ?? date,
          startTime: transformed.startTime ?? minutesToTime(startMin),
        });

        if (!result.ok) onToast(result.error, 'error');
      }

      onDragEnd();
    },
    [isOwner, events, dayTrees, scheduler, trip.id, currentUserId, onToast, onDragEnd],
  );

  // ── Delete handler ────────────────────────────────────────────────────────

  const handleDelete = useCallback(
    async (eventId: string) => {
      const op: OTOperation = { type: 'delete', eventId, timestamp: Date.now() };
      const transformed = otEngine.current.apply(op, pendingOps.current);
      pendingOps.current.push(transformed);
      const result = await deleteTimelineEvent(trip.id, eventId);
      if (!result.ok) onToast(result.error, 'error');
    },
    [trip.id, onToast],
  );

  // ── Resize handler ────────────────────────────────────────────────────────

  const handleResizeEnd = useCallback(
    async (eventId: string, newDurationMinutes: number) => {
      const target = events.find((ev) => ev.id === eventId);
      if (!target) return;

      const snapped  = Math.max(15, Math.round(newDurationMinutes / 15) * 15);
      const startMin = timeToMinutes(target.startTime);
      const endMin   = startMin + snapped;

      const dayIntervals = eventsToIntervals(
        events.filter((ev) => ev.date === target.date && ev.id !== eventId),
      );
      const conflict = checkConflict(dayIntervals, startMin, endMin);

      if (conflict) {
        const conflictTitle = events.find((ev) => ev.id === conflict.id)?.title ?? 'another event';
        onToast(
          `Overlaps "${conflictTitle}" — move that event or return it to the bucket list.`,
          'error',
        );
        return;
      }

      const result = await updateTimelineEvent({ tripId: trip.id, eventId, durationMinutes: snapped });
      if (!result.ok) onToast(result.error, 'error');
    },
    [events, trip.id, onToast],
  );

  // ── Render ───────────────────────────────────────────────────────────────

  const hourLabels = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => START_HOUR + i);

  return (
    <div className="flex overflow-x-auto" style={{ background: 'var(--wb-paper)' }}>
      {/* Time gutter */}
      <div className="flex-shrink-0 w-14 pt-10">
        {hourLabels.map((h) => (
          <div
            key={h}
            style={{ height: `${SLOT_HEIGHT_PX}px` }}
            className="flex items-start justify-end pr-2"
          >
            <span style={{ fontSize: 10, color: 'var(--wb-ink-soft)', opacity: 0.55, lineHeight: 1 }}>
              {h.toString().padStart(2, '0')}:00
            </span>
          </div>
        ))}
      </div>

      {/* Day columns */}
      {days.map((day) => {
        const dayEvents = events
          .filter((ev) => ev.date === day)
          .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

        return (
          <DayColumn
            key={day}
            day={day}
            dayEvents={dayEvents}
            isOwner={isOwner}
            hourLabels={hourLabels}
            draggingDuration={draggingDuration}
            draggingExcludeId={draggingExcludeId}
            onDrop={handleDrop}
            onDelete={handleDelete}
            onResizeEnd={handleResizeEnd}
            onDragEndEvent={onDragEnd}
            onClickSlot={
              isOwner
                ? (date, startTime) => onOpenCreateModal(date, startTime)
                : undefined
            }
          />
        );
      })}
    </div>
  );
}

// ─── DayColumn ────────────────────────────────────────────────────────────────

interface DayColumnProps {
  day: string;
  dayEvents: TimelineEvent[];
  isOwner: boolean;
  hourLabels: number[];
  draggingDuration: number | null;
  draggingExcludeId: string | null;
  onDrop: (e: React.DragEvent<HTMLDivElement>, date: string, slotMinute: number) => void;
  onDelete: (eventId: string) => void;
  onResizeEnd: (eventId: string, newDurationMinutes: number) => void;
  onDragEndEvent: () => void;
  onClickSlot?: (date: string, startTime: string) => void;
}

function DayColumn({
  day,
  dayEvents,
  isOwner,
  hourLabels,
  draggingDuration,
  draggingExcludeId,
  onDrop,
  onDelete,
  onResizeEnd,
  onDragEndEvent,
  onClickSlot,
}: DayColumnProps) {
  const [dragOver, setDragOver] = useState(false);
  const [ghost, setGhost] = useState<{ minute: number; conflicting: boolean } | null>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  const { weekday, date } = formatDayHeader(day);

  function getSlotMinute(clientY: number): number {
    if (!columnRef.current) return START_HOUR * 60;
    const rect = columnRef.current.getBoundingClientRect();
    const relY  = clientY - rect.top;
    const minutesFromStart = Math.max(0, (relY / SLOT_HEIGHT_PX) * 60);
    return Math.floor(START_HOUR * 60 + minutesFromStart);
  }

  return (
    <div
      className="flex-shrink-0 w-44 first:border-l-0"
      style={{ borderLeft: '1px solid var(--wb-line)' }}
    >
      {/* Day header */}
      <div
        className="h-10 flex flex-col items-center justify-center sticky top-0 z-10"
        style={{ borderBottom: '1px solid var(--wb-line)', background: 'var(--wb-paper)' }}
      >
        <span style={{ fontSize: 10, color: 'var(--wb-ink-soft)', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.7 }}>{weekday}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--wb-ink)' }}>{date}</span>
      </div>

      {/* Grid body */}
      <div
        ref={columnRef}
        className="relative"
        style={{
          height: `${TOTAL_HOURS * SLOT_HEIGHT_PX}px`,
          background: dragOver && isOwner ? 'rgba(14,107,168,0.05)' : 'white',
          transition: 'background 100ms',
        }}
        onDragOver={(e) => {
          if (!isOwner) return;
          e.preventDefault();
          // Bucket items use effectAllowed='copy'; existing events use 'move'.
          // dropEffect must match effectAllowed or the browser cancels the drop.
          e.dataTransfer.dropEffect = e.dataTransfer.types.includes('text/timeline-event')
            ? 'move'
            : 'copy';
          setDragOver(true);

          if (draggingDuration !== null) {
            const minute  = getSlotMinute(e.clientY);
            const snapped = Math.round(minute / 15) * 15;
            const endMin  = snapped + draggingDuration;

            const intervals = eventsToIntervals(dayEvents);
            const conflicting =
              checkConflict(intervals, snapped, endMin, draggingExcludeId ?? undefined) !== null;
            setGhost({ minute: snapped, conflicting });
          }
        }}
        onDragLeave={() => { setDragOver(false); setGhost(null); }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          setGhost(null);
          onDrop(e, day, getSlotMinute(e.clientY));
        }}
      >
        {/* Hour grid lines */}
        {hourLabels.map((h) => (
          <div
            key={h}
            style={{ top: `${(h - START_HOUR) * SLOT_HEIGHT_PX}px`, borderColor: 'var(--wb-line)' }}
            className="absolute left-0 right-0 border-t"
          />
        ))}

        {/* 15-min sub-lines */}
        {hourLabels.flatMap((h) =>
          [1, 2, 3].map((q) => (
            <div
              key={`${h}-${q}`}
              style={{ top: `${(h - START_HOUR) * SLOT_HEIGHT_PX + q * (SLOT_HEIGHT_PX / 4)}px`, borderColor: 'var(--wb-paper-3)' }}
              className="absolute left-0 right-0 border-t"
            />
          )),
        )}

        {/* Click-to-create overlay for owner */}
        {isOwner && onClickSlot && (
          <div
            className="absolute inset-0 z-0"
            onClick={(e) => {
              const minute = getSlotMinute(e.clientY);
              onClickSlot(day, minutesToTime(minute));
            }}
          />
        )}

        {/* Ghost preview block */}
        {ghost && draggingDuration !== null && (() => {
          const topPx    = (ghost.minute - START_HOUR * 60) * PX_PER_MINUTE;
          const heightPx = Math.max(draggingDuration * PX_PER_MINUTE, 20);
          const endMin   = ghost.minute + draggingDuration;
          const endH     = Math.floor(endMin / 60) % 24;
          const endM     = endMin % 60;
          return (
            <div
              style={{
                position: 'absolute', top: `${topPx}px`, left: 4, right: 4,
                height: `${heightPx}px`, borderRadius: 6,
                pointerEvents: 'none', zIndex: 4,
                background: ghost.conflicting
                  ? 'rgba(232,93,47,0.18)'
                  : 'rgba(14,107,168,0.15)',
                border: ghost.conflicting
                  ? '1.5px dashed var(--wb-sunset)'
                  : '1.5px dashed var(--wb-ocean)',
              }}
            >
              <span style={{
                fontSize: 10, fontWeight: 600, padding: '2px 6px', display: 'block',
                color: ghost.conflicting ? 'var(--wb-sunset)' : 'var(--wb-ocean)',
              }}>
                {String(Math.floor(ghost.minute / 60)).padStart(2, '0')}
                :{String(ghost.minute % 60).padStart(2, '0')}
                {' – '}
                {String(endH).padStart(2, '0')}:{String(endM).padStart(2, '0')}
              </span>
            </div>
          );
        })()}

        {/* Event cards — absolutely positioned by time */}
        {dayEvents.map((ev) => {
          const topOffset = (timeToMinutes(ev.startTime) - START_HOUR * 60) * PX_PER_MINUTE;
          return (
            <div
              key={ev.id}
              style={{
                position: 'absolute',
                top:      `${topOffset}px`,
                left:     '4px',
                right:    '4px',
                zIndex:   5,
                overflow: 'visible',
              }}
            >
              <EventCard
                event={ev}
                isOwner={isOwner}
                onDelete={onDelete}
                onDragStart={onDragEndEvent}
                onResizeEnd={onResizeEnd}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
