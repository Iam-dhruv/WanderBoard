// ─── TimelineGrid.tsx ─────────────────────────────────────────────────────────
// The main calendar grid:
//  - One column per trip day, time rows from START_HOUR to END_HOUR
//  - Owner can drag bucket-list cards or existing events onto any time slot
//  - On drop: IntervalTree detects conflicts → CspScheduler reflowes → OTEngine
//    produces a safe operation → Firestore write
//  - Members see a live read-only view via onSnapshot

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TimelineEvent, Trip } from '@/types';
import {
  IntervalTree,
  CspScheduler,
  OTEngine,
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

const START_HOUR = 6;   // 06:00
const END_HOUR   = 23;  // 23:00
const TOTAL_HOURS = END_HOUR - START_HOUR;
const SLOT_HEIGHT_PX = 72; // height of each 1-hour slot
const PX_PER_MINUTE  = SLOT_HEIGHT_PX / 60;

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

// ─── IntervalTree per day ─────────────────────────────────────────────────────

function buildDayTrees(
  events: TimelineEvent[],
): Map<string, IntervalTree> {
  const map = new Map<string, IntervalTree>();
  for (const ev of events) {
    if (!map.has(ev.date)) map.set(ev.date, new IntervalTree());
    const tree = map.get(ev.date)!;
    const start = timeToMinutes(ev.startTime);
    tree.insert({
      id: ev.id,
      start,
      end: start + ev.durationMinutes,
      durationMinutes: ev.durationMinutes,
    });
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
}: TimelineGridProps) {
  const days = useMemo(
    () => dateRange(trip.startDate, trip.endDate),
    [trip.startDate, trip.endDate],
  );

  // Per-day interval trees, rebuilt whenever events change
  const dayTrees = useMemo(() => buildDayTrees(events), [events]);

  // OT engine — single instance for this session
  const otEngine = useRef(new OTEngine());
  const pendingOps = useRef<OTOperation[]>([]);

  // CSP scheduler (no golden-hour constraints by default;
  // owners can add via settings in a future iteration)
  const scheduler = useMemo(
    () => new CspScheduler([{ type: 'travel-buffer', bufferMinutes: 15 }]),
    [],
  );

  // ── Drop handler ─────────────────────────────────────────────────────────────

  const handleDrop = useCallback(
    async (
      e: React.DragEvent<HTMLDivElement>,
      date: string,
      slotMinute: number, // minute of the slot top edge (relative to midnight)
    ) => {
      e.preventDefault();
      if (!isOwner) return;

      const sourceType = e.dataTransfer.getData('sourceType');
      const snappedMinute = Math.round(slotMinute / 15) * 15; // snap to 15-min grid

      // ── A: Drop from bucket list ────────────────────────────────────────────
      if (sourceType === 'bucket') {
        const bucketItemId   = e.dataTransfer.getData('bucketItemId');
        const bucketItemName = e.dataTransfer.getData('bucketItemName');
        const bucketItemAddr = e.dataTransfer.getData('bucketItemAddress');

        const durationMinutes = 60; // default 1 hour for bucket items
        const startMin        = snappedMinute;
        const endMin          = startMin + durationMinutes;

        // 1. Interval tree conflict detection — O(log n)
        const tree    = dayTrees.get(date) ?? new IntervalTree();
        const conflicts = tree.queryOverlap(startMin, endMin);

        // 2. CSP reflow if conflicts exist
        const existingOnDay = events
          .filter((ev) => ev.date === date)
          .map(
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
          // Find where our new event landed after reflow
          const placed = cspResult.events.find(
            (ev) => ev.id === newScheduled.id,
          );
          if (placed) resolvedStartMin = placed.start;
          if (cspResult.reason) {
            onToast(`Scheduled with warning: ${cspResult.reason}`, 'warn');
          }
        }

        const startTime = minutesToTime(resolvedStartMin);

        // 3. OT operation
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

        // 4. Firestore write
        const colorIndex = events.length;
        const result = await createTimelineEvent({
          tripId:          trip.id,
          title:           bucketItemName,
          description:     '',
          location:        bucketItemAddr,
          date,
          startTime:       transformed.startTime ?? startTime,
          durationMinutes,
          color:           pickEventColor(colorIndex),
          tags:            [],
          sourceType:      'bucket',
          bucketItemId,
          createdBy:       currentUserId,
        });

        if (!result.ok) {
          onToast(result.error, 'error');
        } else {
          onToast(`"${bucketItemName}" added to timeline!`, 'success');
        }
      }

      // ── B: Move existing event ──────────────────────────────────────────────
      if (sourceType === 'existing') {
        const eventId = e.dataTransfer.getData('eventId');
        const target  = events.find((ev) => ev.id === eventId);
        if (!target) { onDragEnd(); return; }

        const durationMinutes = target.durationMinutes;
        const startMin        = snappedMinute;
        const endMin          = startMin + durationMinutes;

        // Conflict check excluding the event being moved
        const tree     = dayTrees.get(date) ?? new IntervalTree();
        const tempTree = IntervalTree.fromArray(
          tree.toArray().filter((iv) => iv.id !== eventId),
        );
        const conflicts = tempTree.queryOverlap(startMin, endMin);

        if (conflicts.length > 0) {
          // CSP reflow without the moved event
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

        // OT operation for move
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
    [
      isOwner,
      events,
      dayTrees,
      scheduler,
      trip.id,
      currentUserId,
      onToast,
      onDragEnd,
    ],
  );

  // ── Delete handler ────────────────────────────────────────────────────────

  const handleDelete = useCallback(
    async (eventId: string) => {
      const op: OTOperation = {
        type:      'delete',
        eventId,
        timestamp: Date.now(),
      };
      const transformed = otEngine.current.apply(op, pendingOps.current);
      pendingOps.current.push(transformed);

      const result = await deleteTimelineEvent(trip.id, eventId);
      if (!result.ok) onToast(result.error, 'error');
    },
    [trip.id, onToast],
  );

  // ── Render ───────────────────────────────────────────────────────────────

  const hourLabels = Array.from(
    { length: TOTAL_HOURS + 1 },
    (_, i) => START_HOUR + i,
  );

  return (
    <div className="flex overflow-x-auto">
      {/* Time gutter */}
      <div className="flex-shrink-0 w-14 pt-10">
        {hourLabels.map((h) => (
          <div
            key={h}
            style={{ height: `${SLOT_HEIGHT_PX}px` }}
            className="flex items-start justify-end pr-2"
          >
            <span className="text-[10px] text-gray-400 leading-none">
              {h.toString().padStart(2, '0')}:00
            </span>
          </div>
        ))}
      </div>

      {/* Day columns */}
      {days.map((day) => {
        const dayEvents = events
          .filter((ev) => ev.date === day)
          .sort(
            (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime),
          );

        return (
          <DayColumn
            key={day}
            day={day}
            dayEvents={dayEvents}
            isOwner={isOwner}
            hourLabels={hourLabels}
            onDrop={handleDrop}
            onDelete={handleDelete}
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
  onDrop: (
    e: React.DragEvent<HTMLDivElement>,
    date: string,
    slotMinute: number,
  ) => void;
  onDelete: (eventId: string) => void;
  onDragEndEvent: () => void;
  onClickSlot?: (date: string, startTime: string) => void;
}

function DayColumn({
  day,
  dayEvents,
  isOwner,
  hourLabels,
  onDrop,
  onDelete,
  onDragEndEvent,
  onClickSlot,
}: DayColumnProps) {
  const [dragOver, setDragOver] = useState(false);
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
    <div className="flex-shrink-0 w-40 border-l border-gray-100 first:border-l-0">
      {/* Day header */}
      <div className="h-10 flex flex-col items-center justify-center border-b border-gray-100 bg-white sticky top-0 z-10">
        <span className="text-[10px] text-gray-400 uppercase tracking-wide">{weekday}</span>
        <span className="text-xs font-semibold text-gray-700">{date}</span>
      </div>

      {/* Grid body */}
      <div
        ref={columnRef}
        className={[
          'relative',
          dragOver && isOwner ? 'bg-indigo-50/60' : 'bg-white',
        ].join(' ')}
        style={{ height: `${TOTAL_HOURS * SLOT_HEIGHT_PX}px` }}
        onDragOver={(e) => {
          if (!isOwner) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          setDragOver(false);
          onDrop(e, day, getSlotMinute(e.clientY));
        }}
      >
        {/* Hour grid lines */}
        {hourLabels.map((h) => (
          <div
            key={h}
            style={{ top: `${(h - START_HOUR) * SLOT_HEIGHT_PX}px` }}
            className="absolute left-0 right-0 border-t border-gray-100"
          />
        ))}

        {/* 15-min sub-lines */}
        {hourLabels.flatMap((h) =>
          [1, 2, 3].map((q) => (
            <div
              key={`${h}-${q}`}
              style={{
                top: `${(h - START_HOUR) * SLOT_HEIGHT_PX + q * (SLOT_HEIGHT_PX / 4)}px`,
              }}
              className="absolute left-0 right-0 border-t border-gray-50"
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

        {/* Event cards — absolutely positioned by time */}
        {dayEvents.map((ev) => {
          const topOffset =
            (timeToMinutes(ev.startTime) - START_HOUR * 60) * PX_PER_MINUTE;
          return (
            <div
              key={ev.id}
              style={{
                position: 'absolute',
                top:    `${topOffset}px`,
                left:   '4px',
                right:  '4px',
                zIndex: 5,
              }}
            >
              <EventCard
                event={ev}
                isOwner={isOwner}
                onDelete={onDelete}
                onDragStart={onDragEndEvent}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
