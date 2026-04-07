import { useEffect } from 'react';
import { useWeatherStore } from './useWeatherStore';

// ─── Props ─────────────────────────────────────────────────────────────────────

interface WeatherDashboardProps {
  lat:  number;
  lon:  number;
  date: string; // YYYY-MM-DD
}

// ─── Main component ────────────────────────────────────────────────────────────

export function WeatherDashboard({ lat, lon, date }: WeatherDashboardProps) {
  const {
    weather,
    solar,
    weatherLoading,
    weatherError,
    solarError,
    loadEnvironmentalData,
  } = useWeatherStore();

  useEffect(() => {
    loadEnvironmentalData({ lat, lon, date });
  }, [lat, lon, date]);

  if (weatherLoading) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white px-5 py-6">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <LoadingSpinner />
          Fetching environmental data…
        </div>
      </div>
    );
  }

  const hasError = weatherError || solarError;
  const rainAlert = weather && weather.precipitationProbability > 20;

  return (
    <div className="space-y-3">

      {/* ── Rain alert banner ───────────────────────────────────────────────── */}
      {rainAlert && (
        <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
          <span className="mt-0.5 text-red-500 text-lg">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-red-700">Rain Predicted: Outdoor Hazard</p>
            <p className="text-xs text-red-500 mt-0.5">
              {weather.precipitationProbability}% precipitation probability on {date}. Consider rescheduling outdoor activities.
            </p>
          </div>
        </div>
      )}

      {/* ── Error states ─────────────────────────────────────────────────────── */}
      {weatherError && (
        <ErrorBanner message={weatherError} label="Weather unavailable" />
      )}
      {solarError && !weatherError && (
        <ErrorBanner message={solarError} label="Solar data unavailable" />
      )}

      {/* ── Main dashboard card ──────────────────────────────────────────────── */}
      {(weather || solar) && (
        <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">

          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">
              🌍 Environmental Dashboard
            </h3>
            <span className="text-xs text-gray-400">{date}</span>
          </div>
          {weather?.location && (
              <p className="text-xs text-gray-400 mt-1">
                📍 {weather.location}
              </p>
            )}
          <div className="p-5 space-y-5">

            {/* ── Weather row ────────────────────────────────────────────────── */}
            {weather && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <WeatherStat
                  icon="🌡️"
                  label="Temperature"
                  value={`${weather.temperature}°C`}
                  sub={`Feels ${weather.feelsLike}°C`}
                />
                <WeatherStat
                  icon={rainAlert ? '🌧️' : '🌤️'}
                  label="Rain chance"
                  value={`${weather.precipitationProbability}%`}
                  sub={capitalise(weather.description)}
                  highlight={rainAlert ? 'red' : undefined}
                />
                <WeatherStat
                  icon="💧"
                  label="Humidity"
                  value={`${weather.humidity}%`}
                />
                <WeatherStat
                  icon="💨"
                  label="Wind"
                  value={`${weather.windSpeed} m/s`}
                />
              </div>
            )}

            {/* ── Solar / golden hour row ─────────────────────────────────────── */}
            {solar && (
              <>
                <div className="border-t border-gray-50 pt-4">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
                    ☀️ Sun & Golden Hours
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Sunrise */}
                    <SolarCard
                      emoji="🌅"
                      label="Sunrise"
                      time={solar.sunrise}
                      goldenLabel="Morning golden hour"
                      goldenRange={`${solar.goldenHourMorningStart} – ${solar.goldenHourMorningEnd}`}
                      color="amber"
                    />
                    {/* Sunset */}
                    <SolarCard
                      emoji="🌇"
                      label="Sunset"
                      time={solar.sunset}
                      goldenLabel="Evening golden hour"
                      goldenRange={`${solar.goldenHourEveningStart} – ${solar.goldenHourEveningEnd}`}
                      color="orange"
                    />
                  </div>
                </div>

                {/* Golden hour pill timeline */}
                <GoldenHourTimeline solar={solar} />
              </>
            )}
          </div>
        </div>
      )}

      {/* ── No data fallback ─────────────────────────────────────────────────── */}
      {!weather && !solar && !hasError && !weatherLoading && (
        <div className="rounded-xl border border-dashed border-gray-200 py-8 text-center">
          <p className="text-sm text-gray-400">No environmental data available.</p>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function WeatherStat({
  icon, label, value, sub, highlight,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  highlight?: 'red';
}) {
  return (
    <div className={`rounded-lg px-3 py-3 ${
      highlight === 'red'
        ? 'bg-red-50 border border-red-100'
        : 'bg-gray-50'
    }`}>
      <p className="text-base leading-none">{icon}</p>
      <p className={`text-lg font-semibold mt-2 leading-none ${
        highlight === 'red' ? 'text-red-700' : 'text-gray-900'
      }`}>
        {value}
      </p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

function SolarCard({
  emoji, label, time, goldenLabel, goldenRange, color,
}: {
  emoji: string;
  label: string;
  time: string;
  goldenLabel: string;
  goldenRange: string;
  color: 'amber' | 'orange';
}) {
  const bg    = color === 'amber' ? 'bg-amber-50  border-amber-100'  : 'bg-orange-50  border-orange-100';
  const text  = color === 'amber' ? 'text-amber-800'                 : 'text-orange-800';
  const badge = color === 'amber' ? 'bg-amber-100 text-amber-700'    : 'bg-orange-100 text-orange-700';

  return (
    <div className={`rounded-lg border px-3 py-3 ${bg}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <span>{emoji}</span>
        <span className={`text-xs font-medium ${text}`}>{label}</span>
      </div>
      <p className={`text-xl font-bold ${text}`}>{time}</p>
      <div className={`mt-2 rounded-md px-2 py-1 ${badge}`}>
        <p className="text-xs font-medium">{goldenLabel}</p>
        <p className="text-xs font-mono mt-0.5">{goldenRange}</p>
      </div>
    </div>
  );
}

/** Visual mini-timeline bar showing the day split by solar events */
function GoldenHourTimeline({ solar }: { solar: NonNullable<ReturnType<typeof useWeatherStore>['solar']> }) {
  // Convert HH:MM to fractional hour (0–24)
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
      <p className="text-xs text-gray-400 mb-2">Day timeline</p>
      <div className="relative h-3 rounded-full bg-gray-100 overflow-hidden">
        {/* Daylight band */}
        <div
          className="absolute top-0 h-full bg-sky-100"
          style={{ left: `${sr}%`, width: `${ss - sr}%` }}
        />
        {/* Morning golden hour */}
        <div
          className="absolute top-0 h-full bg-amber-300/70"
          style={{ left: `${srStart}%`, width: `${srEnd - srStart}%` }}
        />
        {/* Evening golden hour */}
        <div
          className="absolute top-0 h-full bg-orange-300/70"
          style={{ left: `${ssStart}%`, width: `${ssEnd - ssStart}%` }}
        />
        {/* Sunrise marker */}
        <div
          className="absolute top-0 w-0.5 h-full bg-amber-500"
          style={{ left: `${sr}%` }}
        />
        {/* Sunset marker */}
        <div
          className="absolute top-0 w-0.5 h-full bg-orange-500"
          style={{ left: `${ss}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>00:00</span>
        <span className="text-amber-600">🌅 {solar.sunrise}</span>
        <span className="text-orange-600">🌇 {solar.sunset}</span>
        <span>24:00</span>
      </div>
    </div>
  );
}

function ErrorBanner({ message, label }: { message: string; label: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
      <span className="text-gray-400 mt-0.5">ℹ️</span>
      <div>
        <p className="text-xs font-medium text-gray-600">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{message}</p>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-gray-400"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function capitalise(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
