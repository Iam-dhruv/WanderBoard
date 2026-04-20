// ─── TripAccordionView.tsx ────────────────────────────────────────────────────
// Full-trip overview: vertical list of days, each collapsible.
// Collapsed: shows day label + event count.
// Expanded: horizontally scrollable row of time-ordered EventChip cards.
// Only one day can be expanded at a time (single-accordion).

import { useState } from 'react';
import type { TimelineEvent } from '@/types';
import { MiniWeatherCard, type WeatherSuitability } from '@/features/weather/MiniWeatherCard';

interface TimelineBucketMeta {
  id: string;
  address?: string;
  location?: { lat: number; lng: number };
  userData?: {
    proposedDate?: string;
    proposedTime?: string;
    activityType?: string;
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface TripAccordionViewProps {
  days: string[];
  events: TimelineEvent[];
  expandedDay: string | null;
  onToggleDay: (day: string) => void;
  bucketMetaById: Map<string, TimelineBucketMeta>;
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

function normalizeIsoDate(value?: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function getDateFromProposedTime(value?: string): string | null {
  if (!value) return null;
  const directDateMatch = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (directDateMatch) return directDateMatch[1];
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  const date = new Date(parsed);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatIsoDate(value: string): string {
  const parsed = Date.parse(`${value}T00:00:00`);
  if (Number.isNaN(parsed)) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(new Date(parsed));
}

function formatDateTime(value: string): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(new Date(parsed));
}

function getProposedLabel(proposedDate?: string, proposedTime?: string): string | null {
  const normalizedProposedDate = normalizeIsoDate(proposedDate);
  if (normalizedProposedDate) return formatIsoDate(normalizedProposedDate);

  const proposedDateFromTime = getDateFromProposedTime(proposedTime);
  if (proposedDateFromTime) return formatIsoDate(proposedDateFromTime);

  if (proposedTime) return formatDateTime(proposedTime);

  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TripAccordionView({
  days,
  events,
  expandedDay,
  onToggleDay,
  bucketMetaById,
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
                    <EventChip
                      key={ev.id}
                      event={ev}
                      timeRange={formatTimeRange(ev)}
                      bucketMeta={ev.bucketItemId ? bucketMetaById.get(ev.bucketItemId) : undefined}
                    />
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

function EventChip({
  event,
  timeRange,
  bucketMeta,
}: {
  event: TimelineEvent;
  timeRange: string;
  bucketMeta?: TimelineBucketMeta;
}) {
  const [suitability, setSuitability] = useState<WeatherSuitability | null>(null);
  const proposedLabel = getProposedLabel(
    bucketMeta?.userData?.proposedDate,
    bucketMeta?.userData?.proposedTime,
  );
  const weatherDate = normalizeIsoDate(event.date) ?? event.date;
  const weatherLabel = `Forecast for ${formatIsoDate(weatherDate)}`;
  const activityType = bucketMeta?.userData?.activityType;
  const showWeather = event.sourceType === 'bucket' && Boolean(
    bucketMeta?.location || bucketMeta?.address || event.location,
  );

  const badgeColor =
    suitability?.level === 'alert'
      ? { fg: '#B42318', bg: '#FEE4E2', bd: '#FECDCA' }
      : suitability?.level === 'caution'
        ? { fg: '#B54708', bg: '#FFFAEB', bd: '#FEC84B' }
        : null;

  return (
    <div
      style={{
        flexShrink: 0,
        width: 330,
        borderRadius: 12,
        border: '1px solid var(--wb-line)',
        background: 'white',
        overflow: 'hidden',
        boxShadow: 'var(--wb-shadow-sm)',
      }}
    >
      <div style={{ background: event.color, color: 'white', padding: '9px 11px' }}>
        <p style={{ fontSize: 9, fontWeight: 600, opacity: 0.82, marginBottom: 3, letterSpacing: '0.04em' }}>
          {timeRange}
        </p>
        <p style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.25 }}>
          {event.title}
        </p>
        {event.location && (
          <p style={{ fontSize: 10, opacity: 0.78, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {event.location}
          </p>
        )}
      </div>

      <div style={{ padding: 10 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          <span
            style={{
              fontSize: 9,
              color: 'var(--wb-ink-soft)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontWeight: 700,
              background: 'var(--wb-paper-2)',
              borderRadius: 999,
              padding: '2px 8px',
            }}
          >
            {event.sourceType === 'bucket' ? 'bucket' : 'custom'}
          </span>

          {proposedLabel && (
            <span
              style={{
                fontSize: 10,
                color: '#067647',
                background: '#ECFDF3',
                border: '1px solid #A6F4C5',
                borderRadius: 999,
                padding: '2px 8px',
                fontWeight: 600,
              }}
            >
              Proposed for {proposedLabel}
            </span>
          )}

          {activityType && (
            <span
              style={{
                fontSize: 10,
                color: '#344054',
                background: '#F2F4F7',
                border: '1px solid #EAECF0',
                borderRadius: 999,
                padding: '2px 8px',
                fontWeight: 600,
              }}
            >
              {activityType}
            </span>
          )}

          {badgeColor && (
            <span
              style={{
                fontSize: 10,
                color: badgeColor.fg,
                background: badgeColor.bg,
                border: `1px solid ${badgeColor.bd}`,
                borderRadius: 999,
                padding: '2px 8px',
                fontWeight: 700,
              }}
            >
              ⚠ Weather risk
            </span>
          )}
        </div>

        {showWeather ? (
          <MiniWeatherCard
            lat={bucketMeta?.location?.lat}
            lon={bucketMeta?.location?.lng}
            placeName={bucketMeta?.address ?? event.location}
            tripDate={weatherDate}
            forecastLabel={weatherLabel}
            activityType={activityType}
            onSuitabilityChange={(next) => {
              setSuitability((prev) => {
                if (!prev && !next) return prev;
                if (!prev || !next) return next;
                if (prev.level === next.level && prev.message === next.message) return prev;
                return next;
              });
            }}
          />
        ) : (
          <div
            style={{
              border: '1px dashed var(--wb-line)',
              borderRadius: 10,
              padding: '8px 10px',
              fontSize: 11,
              color: 'var(--wb-ink-soft)',
              background: 'var(--wb-paper)',
            }}
          >
            .
          </div>
        )}
      </div>

      {suitability && suitability.level !== 'clear' && (
        <p
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: '0 10px 10px',
            color: suitability.level === 'alert' ? '#B42318' : '#B54708',
          }}
        >
          {suitability.message}
        </p>
      )}
    </div>
  );
}
