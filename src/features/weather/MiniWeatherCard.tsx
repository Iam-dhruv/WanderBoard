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
  /** YYYY-MM-DD — the trip start date used for the forecast lookup */
  tripDate: string;
  /** Optional label describing which day this forecast corresponds to. */
  forecastLabel?: string;
  /** Optional direct coordinates. When present, geocoding is skipped. */
  lat?: number;
  lon?: number;
  /** Optional place name fallback when coordinates are not available. */
  placeName?: string;
  /** Optional activity type used to evaluate weather suitability. */
  activityType?: string;
  /** Optional callback for parent components that need weather suitability flags. */
  onSuitabilityChange?: (suitability: WeatherSuitability | null) => void;
}

export interface WeatherSuitability {
  level: 'clear' | 'caution' | 'alert';
  message: string;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function MiniWeatherCard({
  placeName,
  tripDate,
  forecastLabel,
  lat,
  lon,
  activityType,
  onSuitabilityChange,
}: MiniWeatherCardProps) {
  const [state, setState] = useState<MiniWeatherState>({ status: 'idle' });
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setIsExpanded(false);
  }, [lat, lon, placeName, tripDate]);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });

    async function resolve() {
      let targetLat = lat;
      let targetLon = lon;

      // Fallback: if coordinates are unavailable, geocode the place name.
      if (typeof targetLat !== 'number' || typeof targetLon !== 'number') {
        if (!placeName || placeName.length < 3) {
          setState({ status: 'error', message: 'Invalid place' });
          return;
        }

        const geoResult = await getCoordinatesFromCity(placeName);
        if (cancelled) return;

        if (!geoResult.ok) {
          setState({ status: 'error', message: geoResult.error });
          return;
        }

        targetLat = geoResult.data.lat;
        targetLon = geoResult.data.lon;
      }

      if (cancelled) return;

      // Step 2: fetch weather for those coordinates
      const weatherResult = await fetchWeatherData({
        lat: targetLat,
        lon: targetLon,
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
  }, [lat, lon, placeName, tripDate]);

  const suitability = state.status === 'ready'
    ? evaluateWeatherSuitability(state.data, activityType)
    : null;

  useEffect(() => {
    if (!onSuitabilityChange) return;
    onSuitabilityChange(suitability);
  }, [onSuitabilityChange, suitability?.level, suitability?.message]);

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
        <p className="font-medium text-gray-500">Weather unavailable</p>
        <p className="mt-0.5 line-clamp-2">{state.message}</p>
      </div>
    );
  }

  // ── Ready ────────────────────────────────────────────────────────────────────
  const { data } = state;
  const isRainy = data.precipitationProbability > 20;
  const rainSeverity = getRainSeverity(data.precipitationProbability);
  const windBand = getWindBand(data.windSpeed);

  return (
    <div className={`rounded-xl border px-3 py-2.5 ${
      isRainy ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-gray-50'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500">
            {forecastLabel ?? `Forecast for ${tripDate}`}
          </p>
          <p className={`text-base font-semibold ${isRainy ? 'text-red-800' : 'text-gray-900'}`}>
            {data.temperature}°C
            <span className="ml-1 text-xs font-medium text-gray-500">Feels like {data.feelsLike}°C</span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              isRainy ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            {rainSeverity}
          </span>
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="text-[11px] font-semibold text-gray-500 hover:text-gray-700"
            aria-expanded={isExpanded}
          >
            {isExpanded ? 'Hide details' : 'Show details'}
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-600">
        <span
          className={`h-2 w-2 rounded-full ${isRainy ? 'bg-red-400' : 'bg-sky-400'}`}
          aria-hidden
        />
        <span>{capitalise(data.description)}</span>
        {isRainy && <span className="text-red-700">Outdoor activity may be impacted.</span>}
      </div>

      {activityType && suitability && suitability.level !== 'clear' && (
        <div
          className={`mt-2 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${
            suitability.level === 'alert'
              ? 'border-red-200 bg-red-100 text-red-700'
              : 'border-amber-200 bg-amber-100 text-amber-700'
          }`}
        >
          ⚠ {suitability.message}
        </div>
      )}

      {isExpanded && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
            <WeatherFact label="Rain chance" value={`${data.precipitationProbability}%`} tone={isRainy ? 'danger' : 'neutral'} />
            <WeatherFact label="Humidity" value={`${data.humidity}%`} tone={data.humidity >= 75 ? 'warn' : 'neutral'} />
            <WeatherFact label="Wind" value={`${data.windSpeed} m/s`} tone={windBand === 'Breezy+' ? 'warn' : 'neutral'} />
            <WeatherFact label="Wind level" value={windBand} tone={windBand === 'Breezy+' ? 'warn' : 'neutral'} />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
            {data.location && <span>Forecast area: {data.location}</span>}
            <span>Updated {formatLocalTime(data.fetchedAt)}</span>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function WeatherFact({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'neutral' | 'warn' | 'danger';
}) {
  const toneClass =
    tone === 'danger'
      ? 'border-red-200 bg-red-100/70 text-red-700'
      : tone === 'warn'
        ? 'border-amber-200 bg-amber-100/70 text-amber-700'
        : 'border-gray-200 bg-white text-gray-600';

  return (
    <div className={`rounded-lg border px-2 py-1 ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-[0.08em] opacity-80">{label}</p>
      <p className="text-xs font-semibold mt-0.5">{value}</p>
    </div>
  );
}

function capitalise(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getRainSeverity(probability: number): string {
  if (probability >= 60) return 'High rain risk';
  if (probability >= 30) return 'Moderate rain risk';
  return 'Low rain risk';
}

function evaluateWeatherSuitability(data: WeatherData, activityType?: string): WeatherSuitability {
  const rain = data.precipitationProbability;
  const wind = data.windSpeed;
  const temp = data.temperature;
  const activityLabel = activityType?.trim() || 'activity';
  const isOutdoor = isLikelyOutdoorActivity(activityType);

  if (rain >= 85 || wind >= 14) {
    return {
      level: 'alert',
      message: `${activityLabel}: High weather risk`,
    };
  }

  if (isOutdoor) {
    if (rain >= 55 || wind >= 10 || temp >= 38 || temp <= 0) {
      return {
        level: 'alert',
        message: `${activityLabel}: Conditions not suitable`,
      };
    }

    if (rain >= 35 || wind >= 7 || temp >= 33 || temp <= 5) {
      return {
        level: 'caution',
        message: `${activityLabel}: Proceed with caution`,
      };
    }
  }

  if (rain >= 70 || wind >= 12 || temp >= 40 || temp <= -2) {
    return {
      level: 'caution',
      message: `${activityLabel}: Weather may affect plans`,
    };
  }

  return {
    level: 'clear',
    message: `Conditions look suitable for ${activityLabel}.`,
  };
}

function isLikelyOutdoorActivity(activityType?: string): boolean {
  if (!activityType) return true;
  const value = activityType.trim().toLowerCase();
  if (!value) return true;
  return /(outdoor|hike|trek|trail|walk|ride|bike|cycling|camp|viewpoint|waterfall|beach|adventure|photo|photography|nature|park|rafting|kayak|ski|sightseeing)/.test(value);
}

function getWindBand(windSpeed: number): string {
  if (windSpeed >= 8) return 'Breezy+';
  if (windSpeed >= 4) return 'Light breeze';
  return 'Calm';
}

function formatLocalTime(timestamp: number): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));
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
