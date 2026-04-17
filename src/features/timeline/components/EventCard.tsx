// ─── EventCard.tsx ────────────────────────────────────────────────────────────
// A single timeline event block rendered inside a time-slot cell.
// Owner: draggable (via HTML5 drag API), shows delete button on hover.
// Member: read-only display.

import { useState } from 'react';
import type { TimelineEvent } from '@/types';

interface EventCardProps {
  event: TimelineEvent;
  isOwner: boolean;
  onDelete?: (eventId: string) => void;
  onDragStart?: (event: TimelineEvent) => void;
}

// Height per minute of duration at our grid scale (1px per minute)
const PX_PER_MINUTE = 1.2;

export function EventCard({ event, isOwner, onDelete, onDragStart }: EventCardProps) {
  const [hovered, setHovered] = useState(false);
  const heightPx = Math.max(event.durationMinutes * PX_PER_MINUTE, 36);

  const endMinutes =
    parseInt(event.startTime.split(':')[0]) * 60 +
    parseInt(event.startTime.split(':')[1]) +
    event.durationMinutes;
  const endHH = Math.floor(endMinutes / 60).toString().padStart(2, '0');
  const endMM = (endMinutes % 60).toString().padStart(2, '0');
  const endTime = `${endHH}:${endMM}`;

  return (
    <div
      draggable={isOwner}
      onDragStart={
        isOwner && onDragStart
          ? (e) => {
              e.dataTransfer.setData('eventId', event.id);
              e.dataTransfer.setData('sourceType', 'existing');
              e.dataTransfer.effectAllowed = 'move';
              onDragStart(event);
            }
          : undefined
      }
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: event.color,
        height: `${heightPx}px`,
        cursor: isOwner ? 'grab' : 'default',
      }}
      className="relative w-full rounded-md px-2 py-1 overflow-hidden select-none group"
      title={event.title}
    >
      {/* Event content */}
      <p className="text-white text-xs font-semibold leading-tight truncate">
        {event.title}
      </p>
      {heightPx > 44 && (
        <p className="text-white/80 text-[10px] leading-tight mt-0.5">
          {event.startTime} – {endTime}
        </p>
      )}
      {heightPx > 60 && event.location && (
        <p className="text-white/70 text-[10px] leading-tight mt-0.5 truncate">
          📍 {event.location}
        </p>
      )}

      {/* Delete button — owner only, shown on hover */}
      {isOwner && hovered && onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(event.id);
          }}
          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-white/25 hover:bg-white/50 flex items-center justify-center transition-colors"
          title="Remove from timeline"
        >
          <span className="text-white text-xs leading-none">×</span>
        </button>
      )}

      {/* Source badge */}
      {heightPx > 52 && (
        <span className="absolute bottom-1 right-1 text-[9px] text-white/60 uppercase tracking-wide">
          {event.sourceType === 'bucket' ? 'bucket' : 'custom'}
        </span>
      )}
    </div>
  );
}
