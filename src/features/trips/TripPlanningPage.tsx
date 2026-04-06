import { useEffect, useState } from 'react';
import { useTripStore } from './useTripStore';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';

export function TripPlanningPage() {
  const { activeTrip } = useTripStore();
  const [tripLocation, setTripLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '',
    libraries: ['maps', 'places'],
  });

  useEffect(() => {
    if (!activeTrip || !isLoaded) return;

    setTripLocation(null);
    setMapError(null);

    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: activeTrip.destination }, (results, status) => {
      if (status === 'OK' && results?.[0]?.geometry?.location) {
        setTripLocation({
          lat: results[0].geometry.location.lat(),
          lng: results[0].geometry.location.lng(),
        });
      } else {
        setTripLocation(null);
        setMapError('Unable to locate this destination.');
      }
    });
  }, [activeTrip, isLoaded]);

  if (!activeTrip) {
    return null;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white border border-gray-100 p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Planning</p>
        <h2 className="mt-2 text-2xl font-semibold text-gray-900">Plan your trip together</h2>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          This is the starting point for trip coordination. The bucket list, discovery, expenses,
          and contingency features live in the other tabs once they are built.
        </p>
      </section>

      <section className="rounded-2xl bg-white border border-gray-100 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Destination map</p>
            <h3 className="mt-2 text-lg font-semibold text-gray-900">{activeTrip.destination}</h3>
          </div>
          <span className="text-xs text-gray-500">{activeTrip.startDate} → {activeTrip.endDate}</span>
        </div>

        <div className="h-80 rounded-2xl overflow-hidden border border-gray-100 bg-slate-50">
          {!isLoaded && (
            <div className="flex h-full items-center justify-center text-sm text-gray-500">Loading map…</div>
          )}
          {loadError && (
            <div className="flex h-full items-center justify-center text-sm text-red-500">Map failed to load.</div>
          )}
          {isLoaded && mapError && (
            <div className="flex h-full items-center justify-center text-sm text-gray-500">{mapError}</div>
          )}
          {isLoaded && !mapError && !tripLocation && (
            <div className="flex h-full items-center justify-center text-sm text-gray-500">Finding destination…</div>
          )}
          {isLoaded && tripLocation && (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={tripLocation}
              zoom={10}
            >
              <Marker position={tripLocation} />
            </GoogleMap>
          )}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <InfoCard label="Destination" value={activeTrip.destination} />
        <InfoCard label="Travel dates" value={`${activeTrip.startDate} → ${activeTrip.endDate}`} />
        <InfoCard label="Invite code" value={activeTrip.inviteCode} mono />
        <InfoCard label="Status" value="Workspace ready" />
      </section>
    </div>
  );
}

function InfoCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`mt-2 text-sm font-medium text-gray-900 ${mono ? 'font-mono tracking-widest' : ''}`}>
        {value}
      </p>
    </div>
  );
}