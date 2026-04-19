import type { TimelineEvent } from '@/types';

interface SlotRowProps {
  event: TimelineEvent;
  isOwner?: boolean;
}

export function SlotRow({ event }: SlotRowProps) {
  const hasConflict = event.tags?.includes('outdoor') && event.tags?.includes('weather-flag');

  return (
    <div className="wb-slot">
      <div
        className="wb-mono text-xs font-semibold"
        style={{ color: 'var(--wb-ink-soft)' }}
      >
        {event.startTime ?? '--:--'}
      </div>
      <div
        className={[
          'flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-[1.5px] relative',
          hasConflict
            ? 'border-wb-sunset'
            : 'border-wb-line',
        ].join(' ')}
        style={{
          background: hasConflict
            ? 'linear-gradient(90deg, rgba(232,93,47,0.08), transparent 50%)'
            : 'var(--wb-paper-2)',
        }}
      >
        {/* Conflict sticker */}
        {hasConflict && (
          <span
            className="absolute -top-2 -left-2 w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px] font-bold text-white border-[1.5px] border-wb-ink"
            style={{ background: 'var(--wb-sunset)' }}
          >
            ⚠
          </span>
        )}

        {/* Activity thumbnail */}
        <div
          className="w-11 h-11 rounded-lg flex-shrink-0 flex items-center justify-center text-lg"
          style={{ background: event.color ?? 'var(--wb-paper-3)', border: '1px solid rgba(0,0,0,0.06)' }}
        >
          {getEventEmoji(event)}
        </div>

        {/* Meta */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold truncate" style={{ color: 'var(--wb-ink)' }}>{event.title}</div>
          <div className="flex gap-2 mt-0.5 flex-wrap">
            {event.location && (
              <span className="text-[11px]" style={{ color: 'var(--wb-ink-soft)' }}>📍 {event.location}</span>
            )}
            {event.tags?.map((tag) => (
              <span key={tag} className="text-[11px]" style={{ color: 'var(--wb-ink-soft)' }}>{tag}</span>
            ))}
            {event.durationMinutes && (
              <span className="text-[11px]" style={{ color: 'var(--wb-ink-soft)' }}>{event.durationMinutes}min</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function EmptySlotRow({ time, label }: { time?: string; label?: string }) {
  return (
    <div className="wb-slot">
      <div className="wb-mono text-xs font-semibold" style={{ color: 'var(--wb-ink-soft)' }}>
        {time ?? ''}
      </div>
      <div
        className="flex items-center justify-center px-3 py-2.5 rounded-xl border-[1.5px] border-dashed text-sm font-medium"
        style={{ borderColor: 'var(--wb-line)', color: 'var(--wb-ink-soft)' }}
      >
        {label ?? '+ Drop an activity here'}
      </div>
    </div>
  );
}

function getEventEmoji(event: TimelineEvent): string {
  const tags = event.tags ?? [];
  if (tags.includes('outdoor') || tags.includes('scenic')) return '🏔';
  if (tags.includes('food'))    return '🍽';
  if (tags.includes('chill'))   return '🔥';
  if (tags.includes('logistics')) return '🚗';
  if (event.sourceType === 'bucket') return '📍';
  return '📅';
}
