import { useEffect, useMemo, useState } from 'react';
import { useWeatherStore } from './useWeatherStore';
import type { SolarData } from './types';
import { DayWeatherSummary } from './DayWeatherSummary';

interface WeatherDashboardProps {
  lat:  number;
  lon:  number;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export function WeatherDashboard({ lat, lon, startDate, endDate }: WeatherDashboardProps) {
  const { weather, solar, weatherLoading, weatherError, solarError, loadEnvironmentalData } = useWeatherStore();
  const tripDays = useMemo(() => getDatesInRange(startDate, endDate), [startDate, endDate]);
  const [selectedDate, setSelectedDate] = useState(startDate);

  useEffect(() => {
    if (!tripDays.length) return;
    if (!tripDays.includes(selectedDate)) {
      setSelectedDate(tripDays[0]);
    }
  }, [tripDays, selectedDate]);

  useEffect(() => {
    if (!tripDays.length) return;
    loadEnvironmentalData({ lat, lon, date: selectedDate });
  }, [lat, lon, selectedDate, tripDays.length, loadEnvironmentalData]);

  if (!tripDays.length) {
    return (
      <div
        className="rounded-[16px] border-[1.5px] border-dashed py-6 text-center"
        style={{ borderColor: 'var(--wb-line)', background: '#fff' }}
      >
        <p className="text-sm" style={{ color: 'var(--wb-ink-soft)' }}>
          Trip dates are unavailable for this trip.
        </p>
      </div>
    );
  }

  if (weatherLoading) {
    return (
      <div className="rounded-[16px] border px-5 py-5" style={{ background: '#fff', borderColor: 'var(--wb-line)', boxShadow: 'var(--wb-shadow-sm)' }}>
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--wb-ink-soft)' }}>
          <LoadingSpinner />
          Fetching the latest forecast…
        </div>
      </div>
    );
  }

  const hasError   = weatherError || solarError;
  const rainAlert  = weather && weather.precipitationProbability > 20;
  const selectedDayIndex = Math.max(0, tripDays.indexOf(selectedDate));

  return (
    <div className="space-y-3">

      {/* Rain alert */}
      {rainAlert && (
        <div
          className="flex items-start gap-3 rounded-[12px] px-4 py-3 border"
          style={{ background: 'rgba(232,93,47,0.08)', borderColor: 'rgba(232,93,47,0.2)' }}
        >
          <span className="mt-0.5 text-base" style={{ color: 'var(--wb-sunset)' }}>⚠</span>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--wb-sunset)' }}>Rain advisory</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--wb-sunset)', opacity: 0.8 }}>
              {weather.precipitationProbability}% rain chance on {formatDayFull(selectedDate)}. Consider indoor alternatives.
            </p>
          </div>
        </div>
      )}

      {/* Error states */}
      {weatherError && <ErrorBanner message={weatherError} label="Forecast unavailable" />}
      {solarError && !weatherError && <ErrorBanner message={solarError} label="Sun data unavailable" />}

      {/* Main card */}
      {(weather || solar) && (
        <div
          className="rounded-[16px] border overflow-hidden"
          style={{ background: '#fff', borderColor: 'var(--wb-line)', boxShadow: 'var(--wb-shadow-sm)' }}
        >
          {/* Header */}
          <div
            className="px-5 py-4 flex items-center justify-between"
            style={{ borderBottom: '1px solid var(--wb-line)' }}
          >
            <h3 className="text-sm font-semibold" style={{ color: 'var(--wb-ink)' }}>
              Weather Dashboard
            </h3>
            <span className="text-xs" style={{ color: 'var(--wb-ink-soft)' }}>
              Day {selectedDayIndex + 1} of {tripDays.length}
            </span>
          </div>

          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--wb-line)', background: 'var(--wb-paper)' }}>
            <p
              className="text-[10px] font-bold uppercase tracking-[0.16em] mb-2"
              style={{ color: 'var(--wb-ink-soft)' }}
            >
              Trip forecast
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {tripDays.map((tripDay) => {
                const active = tripDay === selectedDate;
                return (
                  <button
                    key={tripDay}
                    type="button"
                    onClick={() => setSelectedDate(tripDay)}
                    className="rounded-[10px] p-2 min-w-[118px] text-left transition-colors"
                    style={{
                      border: active ? '1.5px solid var(--wb-ocean)' : '1px solid var(--wb-line)',
                      background: active ? 'rgba(14,107,168,0.07)' : '#fff',
                    }}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: active ? 'var(--wb-ocean)' : 'var(--wb-ink-soft)' }}>
                      {formatWeekday(tripDay)}
                    </p>
                    <p className="text-xs font-semibold mb-1" style={{ color: 'var(--wb-ink)' }}>
                      {formatDayShort(tripDay)}
                    </p>
                    <DayWeatherSummary date={tripDay} lat={lat} lon={lon} />
                  </button>
                );
              })}
            </div>
          </div>

          {weather?.location && (
            <p className="px-5 pt-2 text-xs" style={{ color: 'var(--wb-ink-soft)' }}>📍 {weather.location}</p>
          )}

          <div className="p-5 space-y-5">
            {/* Weather stats */}
            {weather && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <WeatherStat icon="🌡️" label="Temperature" value={`${weather.temperature}°C`} sub={`Feels ${weather.feelsLike}°C`} />
                <WeatherStat icon={rainAlert ? '🌧️' : '🌤️'} label="Rain chance" value={`${weather.precipitationProbability}%`} sub={capitalise(weather.description)} highlight={rainAlert ? 'rain' : undefined} />
                <WeatherStat icon="💧" label="Humidity"    value={`${weather.humidity}%`} />
                <WeatherStat icon="💨" label="Wind"        value={`${weather.windSpeed} m/s`} />
              </div>
            )}

            {/* Solar / golden hour */}
            {solar && (
              <>
                <div style={{ borderTop: '1px solid var(--wb-line)', paddingTop: 16 }}>
                  <p className="text-xs font-bold uppercase tracking-[0.15em] mb-3" style={{ color: 'var(--wb-ink-soft)' }}>
                    ☀️ Sun & Golden Hours
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <SolarCard emoji="🌅" label="Sunrise" time={solar.sunrise} goldenLabel="Morning golden hour" goldenRange={`${solar.goldenHourMorningStart} - ${solar.goldenHourMorningEnd}`} color="amber" />
                    <SolarCard emoji="🌇" label="Sunset"  time={solar.sunset}  goldenLabel="Evening golden hour"  goldenRange={`${solar.goldenHourEveningStart} - ${solar.goldenHourEveningEnd}`}  color="orange" />
                  </div>
                </div>
                <GoldenHourTimeline solar={solar} />
              </>
            )}
          </div>
        </div>
      )}

      {/* No data fallback */}
      {!weather && !solar && !hasError && !weatherLoading && (
        <div
          className="rounded-[16px] border-[1.5px] border-dashed py-8 text-center"
          style={{ borderColor: 'var(--wb-line)' }}
        >
          <p className="text-sm" style={{ color: 'var(--wb-ink-soft)' }}>No environmental data available.</p>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function WeatherStat({ icon, label, value, sub, highlight }: {
  icon: string; label: string; value: string; sub?: string; highlight?: 'rain';
}) {
  return (
    <div
      className="rounded-xl px-3 py-3"
      style={{
        background: highlight === 'rain' ? 'rgba(232,93,47,0.07)' : 'var(--wb-paper-2)',
        border: highlight === 'rain' ? '1px solid rgba(232,93,47,0.2)' : undefined,
      }}
    >
      <p className="text-base leading-none">{icon}</p>
      <p
        className="text-lg font-semibold mt-2 leading-none font-fraunces"
        style={{ color: highlight === 'rain' ? 'var(--wb-sunset)' : 'var(--wb-ink)' }}
      >
        {value}
      </p>
      <p className="text-xs mt-1" style={{ color: 'var(--wb-ink-soft)' }}>{label}</p>
      {sub && <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--wb-ink-soft)', opacity: 0.7 }}>{sub}</p>}
    </div>
  );
}

function SolarCard({ emoji, label, time, goldenLabel, goldenRange, color }: {
  emoji: string; label: string; time: string; goldenLabel: string; goldenRange: string; color: 'amber' | 'orange';
}) {
  const bg   = color === 'amber' ? 'rgba(245,165,36,0.1)'  : 'rgba(255,106,91,0.1)';
  const bdr  = color === 'amber' ? 'rgba(245,165,36,0.25)' : 'rgba(255,106,91,0.25)';
  const clr  = color === 'amber' ? 'var(--wb-sun)'         : 'var(--wb-coral)';

  return (
    <div className="rounded-xl px-3 py-3 border" style={{ background: bg, borderColor: bdr }}>
      <div className="flex items-center gap-1.5 mb-1">
        <span>{emoji}</span>
        <span className="text-xs font-semibold" style={{ color: clr }}>{label}</span>
      </div>
      <p className="text-xl font-bold font-fraunces" style={{ color: clr }}>{time}</p>
      <div className="mt-2 rounded-lg px-2 py-1" style={{ background: 'rgba(0,0,0,0.05)' }}>
        <p className="text-xs font-medium" style={{ color: 'var(--wb-ink-soft)' }}>{goldenLabel}</p>
        <p className="text-xs font-jetbrains mt-0.5" style={{ color: 'var(--wb-ink)' }}>{goldenRange}</p>
      </div>
    </div>
  );
}

function GoldenHourTimeline({ solar }: { solar: SolarData }) {
  function toFrac(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    return ((h + m / 60) / 24) * 100;
  }
  const srStart = toFrac(solar.goldenHourMorningStart);
  const srEnd   = toFrac(solar.goldenHourMorningEnd);
  const ssStart = toFrac(solar.goldenHourEveningStart);
  const ssEnd   = toFrac(solar.goldenHourEveningEnd);
  const sr      = toFrac(solar.sunrise);
  const ss      = toFrac(solar.sunset);

  return (
    <div>
      <p className="text-xs mb-2" style={{ color: 'var(--wb-ink-soft)' }}>Day timeline</p>
      <div className="relative h-3 rounded-full overflow-hidden" style={{ background: 'var(--wb-paper-2)' }}>
        <div className="absolute top-0 h-full bg-sky-100" style={{ left: `${sr}%`, width: `${ss - sr}%` }} />
        <div className="absolute top-0 h-full" style={{ left: `${srStart}%`, width: `${srEnd - srStart}%`, background: 'rgba(245,165,36,0.5)' }} />
        <div className="absolute top-0 h-full" style={{ left: `${ssStart}%`, width: `${ssEnd - ssStart}%`, background: 'rgba(255,106,91,0.5)' }} />
        <div className="absolute top-0 w-0.5 h-full" style={{ left: `${sr}%`, background: 'var(--wb-sun)' }} />
        <div className="absolute top-0 w-0.5 h-full" style={{ left: `${ss}%`, background: 'var(--wb-coral)' }} />
      </div>
      <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--wb-ink-soft)' }}>
        <span>00:00</span>
        <span style={{ color: 'var(--wb-sun)' }}>🌅 {solar.sunrise}</span>
        <span style={{ color: 'var(--wb-coral)' }}>🌇 {solar.sunset}</span>
        <span>24:00</span>
      </div>
    </div>
  );
}

function ErrorBanner({ message, label }: { message: string; label: string }) {
  return (
    <div
      className="flex items-start gap-2.5 rounded-xl px-4 py-3 border"
      style={{ background: 'var(--wb-paper-2)', borderColor: 'var(--wb-line)' }}
    >
      <span style={{ color: 'var(--wb-ink-soft)', marginTop: 2 }}>ℹ️</span>
      <div>
        <p className="text-xs font-semibold" style={{ color: 'var(--wb-ink)' }}>{label}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--wb-ink-soft)' }}>{message}</p>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg className="animate-spin h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--wb-ink-soft)' }}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
      <path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" opacity="0.75" />
    </svg>
  );
}

function capitalise(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getDatesInRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime()) || cursor > end) return dates;

  while (cursor <= end) {
    dates.push(toIsoLocalDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function toIsoLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatWeekday(value: string): string {
  const parsed = Date.parse(`${value}T00:00:00`);
  if (Number.isNaN(parsed)) return value;
  return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date(parsed));
}

function formatDayShort(value: string): string {
  const parsed = Date.parse(`${value}T00:00:00`);
  if (Number.isNaN(parsed)) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(parsed));
}

function formatDayFull(value: string): string {
  const parsed = Date.parse(`${value}T00:00:00`);
  if (Number.isNaN(parsed)) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(new Date(parsed));
}
