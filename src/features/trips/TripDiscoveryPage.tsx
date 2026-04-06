import { useEffect, useState } from 'react';
import { useTripStore } from './useTripStore';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';

export function TripDiscoveryPage() {
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
    <div className="h-full w-full">
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
  );
}
