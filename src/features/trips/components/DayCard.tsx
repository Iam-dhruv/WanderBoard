import type { ReactNode } from 'react';

const DAY_BADGE_COLORS = [
  'var(--wb-ink)',
  'var(--wb-sunset)',
  'var(--wb-ocean)',
  'var(--wb-moss)',
  'var(--wb-plum)',
  'var(--wb-coral)',
];

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

interface DayCardProps {
  dateStr: string;     // YYYY-MM-DD
  dayIndex: number;    // 0-based index for color cycling
  title?: string;
  subtitle?: string;
  weatherLabel?: string;
  children: ReactNode;
}

export function DayCard({ dateStr, dayIndex, title, subtitle, weatherLabel, children }: DayCardProps) {
  const date = new Date(dateStr + 'T00:00:00');
  const dayNum = date.getDate();
  const weekday = WEEKDAYS[date.getDay()];
  const badgeColor = DAY_BADGE_COLORS[dayIndex % DAY_BADGE_COLORS.length];

  return (
    <div
      className="rounded-[16px] p-4 mb-3.5"
      style={{ background: '#fff', border: '1px solid var(--wb-line)', boxShadow: 'var(--wb-shadow-sm)' }}
    >
      {/* Day header */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-11 h-11 rounded-xl flex flex-col items-center justify-center flex-shrink-0 leading-none"
          style={{ background: badgeColor, color: '#fff' }}
        >
          <span className="font-fraunces font-bold text-[18px]">{dayNum}</span>
          <span className="text-[9px] tracking-[0.15em] uppercase opacity-80 mt-px">{weekday}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h4
            className="font-fraunces text-[20px] font-bold leading-tight tracking-tight"
            style={{ color: 'var(--wb-ink)' }}
          >
            {title ?? dateStr}
          </h4>
          {subtitle && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--wb-ink-soft)' }}>{subtitle}</p>
          )}
        </div>
        {weatherLabel && (
          <div className="flex items-center gap-1 text-xs font-semibold flex-shrink-0" style={{ color: 'var(--wb-ink-soft)' }}>
            {weatherLabel}
          </div>
        )}
      </div>

      {/* Slot rows */}
      <div>{children}</div>
    </div>
  );
}
