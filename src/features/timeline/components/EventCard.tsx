// ─── EventCard.tsx ────────────────────────────────────────────────────────────
// A single timeline event block rendered inside a time-slot cell.
// Owner: draggable (via HTML5 drag API), shows delete button on hover,
//        resize handle at bottom edge for duration adjustment.
// Member: read-only display.

import { useState } from 'react';
import type { TimelineEvent } from '@/types';

interface EventCardProps {
  event: TimelineEvent;
  isOwner: boolean;
  onDelete?: (eventId: string) => void;
  onDragStart?: (event: TimelineEvent) => void;
  onDragEnd?: () => void;
  onResizeEnd?: (eventId: string, newDurationMinutes: number) => void;
  onResizePreviewStart?: (eventId: string, newDurationMinutes: number) => void;
  onResizePreviewChange?: (eventId: string, newDurationMinutes: number) => void;
  onResizePreviewEnd?: (eventId: string) => void;
}

const PX_PER_MINUTE = 1.2; // must match TimelineGrid
const SNAP_MINUTES  = 15;

export function EventCard({
  event,
  isOwner,
  onDelete,
  onDragStart,
  onDragEnd,
  onResizeEnd,
  onResizePreviewStart,
  onResizePreviewChange,
  onResizePreviewEnd,
}: EventCardProps) {
  const [hovered, setHovered] = useState(false);
  const [resizingDuration, setResizingDuration] = useState<number | null>(null);

  const activeDuration = resizingDuration ?? event.durationMinutes;
  const heightPx = Math.max(activeDuration * PX_PER_MINUTE, 36);

  const [startH, startM] = event.startTime.split(':').map(Number);
  const endMinutes = startH * 60 + startM + activeDuration;
  const endH = Math.floor(endMinutes / 60) % 24;
  const endM = endMinutes % 60;
  const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

  function formatTime12(hh: number, mm: number): string {
    const ampm = hh >= 12 ? 'PM' : 'AM';
    return `${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${ampm}`;
  }

  function handleResizeStart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startDuration = event.durationMinutes;
    setResizingDuration(startDuration);
    onResizePreviewStart?.(event.id, startDuration);

    const onMouseMove = (ev: MouseEvent) => {
      const deltaY = ev.clientY - startY;
      const deltaDuration = Math.round(deltaY / PX_PER_MINUTE / SNAP_MINUTES) * SNAP_MINUTES;
      const nextDuration = Math.max(SNAP_MINUTES, startDuration + deltaDuration);
      setResizingDuration(nextDuration);
      onResizePreviewChange?.(event.id, nextDuration);
    };

    const onMouseUp = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      const deltaY = ev.clientY - startY;
      const deltaDuration = Math.round(deltaY / PX_PER_MINUTE / SNAP_MINUTES) * SNAP_MINUTES;
      const finalDuration = Math.max(SNAP_MINUTES, startDuration + deltaDuration);
      setResizingDuration(null);
      onResizePreviewEnd?.(event.id);
      onResizeEnd?.(event.id, finalDuration);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  return (
    <>
      <div
        draggable={isOwner && resizingDuration === null}
        onDragStart={
          isOwner && onDragStart && resizingDuration === null
            ? (e) => {
                e.dataTransfer.setData('eventId', event.id);
                e.dataTransfer.setData('sourceType', 'existing');
                e.dataTransfer.setData('text/timeline-event', event.id);
                e.dataTransfer.effectAllowed = 'move';
                onDragStart(event);
              }
            : undefined
        }
        onDragEnd={isOwner ? onDragEnd : undefined}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          backgroundColor: event.color,
          height: `${heightPx}px`,
          cursor: isOwner ? (resizingDuration !== null ? 'row-resize' : 'grab') : 'default',
          userSelect: 'none',
        }}
        className="relative w-full rounded-md px-2 py-1 overflow-hidden group"
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
        {isOwner && hovered && onDelete && resizingDuration === null && (
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

        {/* Resize handle — owner only, visible on hover / while resizing */}
        {isOwner && onResizeEnd && (
          <div
            onMouseDown={handleResizeStart}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              height: 20, cursor: 'row-resize', borderRadius: '0 0 6px 6px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
              opacity: hovered || resizingDuration !== null ? 0.9 : 0,
              transition: 'opacity 150ms',
              background: 'rgba(0,0,0,0.15)',
            }}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 14, height: 2,
                  background: 'rgba(255,255,255,0.75)',
                  borderRadius: 1,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating end-time label — rendered outside the card so it's not clipped */}
      {resizingDuration !== null && (
        <div
          style={{
            position: 'absolute', bottom: -28, left: '50%',
            transform: 'translateX(-50%)', zIndex: 30,
            background: '#0F1C2E', color: '#FAF6EF',
            padding: '3px 8px', borderRadius: 6, fontSize: 11,
            fontWeight: 600, whiteSpace: 'nowrap', pointerEvents: 'none',
          }}
        >
          → {formatTime12(endH, endM)}
        </div>
      )}
    </>
  );
}
