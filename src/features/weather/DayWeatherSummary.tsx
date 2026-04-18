import { useEffect, useState } from 'react';
import { fetchWeatherData } from './weatherService';
import type { WeatherData } from './types';

// ─── Types ─────────────────────────────────────────────────────────────────────

type DayWeatherState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; data: WeatherData };

// ─── Props ─────────────────────────────────────────────────────────────────────

interface DayWeatherSummaryProps {
  /** YYYY-MM-DD — the specific day to fetch the forecast for */
  date: string;
  /** Destination latitude (resolved by the parent via geocodingService) */
  lat: number;
  /** Destination longitude */
  lon: number;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function DayWeatherSummary({ date, lat, lon }: DayWeatherSummaryProps) {
  const [state, setState] = useState<DayWeatherState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });

    fetchWeatherData({ lat, lon, date }).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setState({ status: 'ready', data: result.data });
      } else {
        setState({ status: 'error' });
      }
    });

    return () => { cancelled = true; };
  }, [lat, lon, date]);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (state.status === 'loading') {
    return (
      <div className="flex items-center justify-center h-8">
        <svg
          className="animate-spin h-3 w-3 text-gray-300"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────────
  if (state.status === 'error') {
    return (
      <div className="text-[10px] text-gray-400 text-center py-1">No weather data</div>
    );
  }

  // ── Ready ─────────────────────────────────────────────────────────────────────
  const { data } = state;
  const isRainy = data.precipitationProbability > 20;

  return (
    <div
      className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium ${
        isRainy
          ? 'bg-red-50 border border-red-100 text-red-700'
          : 'bg-sky-50 border border-sky-100 text-sky-700'
      }`}
      title={`${data.description} · ${data.precipitationProbability}% rain`}
    >
      {/* Weather icon */}
      <span aria-hidden className="text-xs">
        {isRainy ? '🌧' : data.temperature > 30 ? '☀️' : '⛅'}
      </span>

      {/* Temperature */}
      <span>{data.temperature}°C</span>

      {/* Rain probability */}
      <span className="opacity-75">· {data.precipitationProbability}%</span>

      {/* Rain hazard dot */}
      {isRainy && (
        <span
          className="ml-0.5 h-1.5 w-1.5 rounded-full bg-red-500 flex-shrink-0"
          title="Rain predicted — outdoor hazard"
          aria-label="Rain hazard"
        />
      )}
    </div>
  );
}
