import { useEffect, useState } from 'react';
import { getCoordinatesFromCity } from './geocodingService';
import { fetchWeatherData } from './weatherService';
import type { WeatherData } from './types';

// ─── Types ─────────────────────────────────────────────────────────────────────

type MiniWeatherState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: WeatherData };

// ─── Props ─────────────────────────────────────────────────────────────────────

interface MiniWeatherCardProps {
  /** Place name used for geocoding (e.g. "Taj Mahal", "Café de Flore, Paris") */
  placeName: string;
  /** YYYY-MM-DD — the trip start date used for the forecast lookup */
  tripDate: string;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function MiniWeatherCard({ placeName, tripDate }: MiniWeatherCardProps) {
  const [state, setState] = useState<MiniWeatherState>({ status: 'idle' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });

    async function resolve() {
      // Step 1: geocode place name → lat/lon
      const geoResult = await getCoordinatesFromCity(placeName);
      if (!placeName || placeName.length < 3) {
        setState({ status: 'error', message: 'Invalid place' });
        return;
      }      
      
      if (cancelled) return;

      if (!geoResult.ok) {
        setState({ status: 'error', message: geoResult.error });
        return;
      }

      // Step 2: fetch weather for those coordinates
      const weatherResult = await fetchWeatherData({
        lat: geoResult.data.lat,
        lon: geoResult.data.lon,
        date: tripDate,
      });
      if (cancelled) return;

      if (!weatherResult.ok) {
        setState({ status: 'error', message: weatherResult.error });
        return;
      }

      setState({ status: 'ready', data: weatherResult.data });
    }

    void resolve();
    return () => { cancelled = true; };
  }, [placeName, tripDate]);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (state.status === 'idle' || state.status === 'loading') {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white px-3 py-2 flex items-center gap-2 text-xs text-gray-400">
        <MiniSpinner />
        Fetching weather…
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (state.status === 'error') {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white px-3 py-2 text-xs text-gray-400">
        Weather unavailable
      </div>
    );
  }

  // ── Ready ────────────────────────────────────────────────────────────────────
  const { data } = state;
  const isRainy = data.precipitationProbability > 20;

  return (
    <div className={`rounded-xl border px-3 py-2.5 ${
      isRainy ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-gray-50'
    }`}>
      <div className="flex flex-wrap items-center gap-3">
        {/* Temperature */}
        <span className={`text-sm font-semibold ${isRainy ? 'text-red-800' : 'text-gray-900'}`}>
          {data.temperature}°C
        </span>

        {/* Condition dot + label */}
        <span className="flex items-center gap-1 text-xs text-gray-600">
          <span
            className={`h-2 w-2 rounded-full ${isRainy ? 'bg-red-400' : 'bg-sky-400'}`}
            aria-hidden
          />
          {capitalise(data.description)}
        </span>

        {/* Rain probability */}
        <span className={`text-xs font-medium ${isRainy ? 'text-red-700' : 'text-gray-500'}`}>
          🌧 {data.precipitationProbability}%
        </span>

        {/* Outdoor hazard badge */}
        {isRainy && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
            ⚠️ Outdoor Hazard
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function capitalise(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function MiniSpinner() {
  return (
    <svg
      className="animate-spin h-3 w-3 text-gray-400 flex-shrink-0"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}
