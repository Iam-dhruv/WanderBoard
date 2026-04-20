import { WeatherDashboard } from '@/features/weather';
import { useTripStore } from './useTripStore';
import { useTripGeo } from './TripWorkspacePage';

export function TripWeatherPage() {
  const { activeTrip } = useTripStore();
  const { geo } = useTripGeo();

  if (!activeTrip) return null;

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--wb-paper)' }}>
      <div
        className="px-6 pt-5 pb-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--wb-line)' }}
      >
        <p className="text-[11px] font-bold tracking-[0.2em] uppercase mb-0.5" style={{ color: 'var(--wb-ocean)' }}>
          Forecast
        </p>
        <h2 className="font-fraunces text-[22px] font-bold leading-tight tracking-tight" style={{ color: 'var(--wb-ink)' }}>
          Trip weather outlook
        </h2>
        <p className="text-xs mt-1" style={{ color: 'var(--wb-ink-soft)' }}>
          {activeTrip.destination}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {(geo.status === 'idle' || geo.status === 'loading') && (
          <div
            className="rounded-[16px] border-[1.5px] border-dashed py-6 text-center text-sm"
            style={{ borderColor: 'var(--wb-line)', color: 'var(--wb-ink-soft)', background: '#fff' }}
          >
            Resolving destination coordinates…
          </div>
        )}

        {geo.status === 'error' && (
          <div
            className="rounded-[16px] border-[1.5px] border-dashed py-6 px-4 text-center text-sm"
            style={{ borderColor: '#f3b7a8', color: 'var(--wb-sunset)', background: '#fff7f4' }}
          >
            {geo.message}
          </div>
        )}

        {geo.status === 'ready' && (
          <WeatherDashboard
            lat={geo.coords.lat}
            lon={geo.coords.lon}
            startDate={activeTrip.startDate}
            endDate={activeTrip.endDate}
          />
        )}
      </div>
    </div>
  );
}
