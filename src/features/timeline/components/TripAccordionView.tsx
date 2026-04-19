// ─── TripAccordionView.tsx ────────────────────────────────────────────────────
// Full-trip overview: vertical list of days, each collapsible.
// Collapsed: shows day label + event count.
// Expanded: horizontally scrollable row of time-ordered EventChip cards.
// Only one day can be expanded at a time (single-accordion).

import type { TimelineEvent } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TripAccordionViewProps {
  days: string[];
  events: TimelineEvent[];
  expandedDay: string | null;
  onToggleDay: (day: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function formatDay(dateStr: string): { weekday: string; dateLabel: string } {
  const d = new Date(dateStr + 'T12:00:00');
  return {
    weekday:   d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    dateLabel: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  };
}

function formatTimeRange(event: TimelineEvent): string {
  const [sh, sm] = event.startTime.split(':').map(Number);
  const endMin = sh * 60 + sm + event.durationMinutes;
  const endH   = Math.floor(endMin / 60) % 24;
  const endM   = endMin % 60;
  return `${event.startTime} – ${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TripAccordionView({
  days,
  events,
  expandedDay,
  onToggleDay,
}: TripAccordionViewProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', height: '100%' }}>
      {days.map((day) => {
        const dayEvents = events
          .filter((ev) => ev.date === day)
          .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
        const isExpanded = expandedDay === day;
        const { weekday, dateLabel } = formatDay(day);

        return (
          <div key={day} style={{ borderBottom: '1px solid var(--wb-line)', flexShrink: 0 }}>

            {/* ── Day header ────────────────────────────────────────────── */}
            <button
              onClick={() => onToggleDay(day)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', padding: '11px 16px',
                background: isExpanded ? 'var(--wb-paper-2)' : 'var(--wb-paper)',
                border: 'none', cursor: 'pointer', textAlign: 'left',
                transition: 'background var(--wb-fast)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
                  color: 'var(--wb-ink-soft)', opacity: 0.65, minWidth: 30,
                }}>
                  {weekday}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--wb-ink)' }}>
                  {dateLabel}
                </span>
                {dayEvents.length > 0 && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: 'var(--wb-ocean)',
                    background: 'rgba(14,107,168,0.09)',
                    padding: '1px 8px', borderRadius: 20,
                  }}>
                    {dayEvents.length}
                  </span>
                )}
                {dayEvents.length === 0 && (
                  <span style={{ fontSize: 11, color: 'var(--wb-ink-soft)', opacity: 0.5 }}>
                    No events
                  </span>
                )}
              </div>

              {/* Expand/collapse chevron */}
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="var(--wb-ink-soft)" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round"
                style={{
                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform var(--wb-base)',
                  flexShrink: 0,
                }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* ── Expanded: horizontal event chips ──────────────────────── */}
            {isExpanded && (
              <div style={{
                overflowX: 'auto', padding: '10px 16px 14px',
                display: 'flex', gap: 8, alignItems: 'flex-start',
                background: 'white', minHeight: 80,
              }}>
                {dayEvents.length === 0 ? (
                  <p style={{
                    fontSize: 12, color: 'var(--wb-ink-soft)',
                    alignSelf: 'center', fontStyle: 'italic',
                  }}>
                    Drag events from the bucket list to schedule this day.
                  </p>
                ) : (
                  dayEvents.map((ev) => (
                    <EventChip key={ev.id} event={ev} timeRange={formatTimeRange(ev)} />
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── EventChip ────────────────────────────────────────────────────────────────

function EventChip({ event, timeRange }: { event: TimelineEvent; timeRange: string }) {
  return (
    <div
      style={{
        flexShrink: 0, width: 156, borderRadius: 10,
        background: event.color, padding: '9px 11px',
        color: 'white', boxShadow: 'var(--wb-shadow-sm)',
      }}
    >
      <p style={{ fontSize: 9, fontWeight: 600, opacity: 0.75, marginBottom: 3, letterSpacing: '0.04em' }}>
        {timeRange}
      </p>
      <p style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.25 }}>
        {event.title}
      </p>
      {event.location && (
        <p style={{ fontSize: 10, opacity: 0.7, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {event.location}
        </p>
      )}
      <p style={{ fontSize: 9, opacity: 0.55, marginTop: 5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {event.sourceType === 'bucket' ? 'bucket' : 'custom'}
      </p>
    </div>
  );
}
