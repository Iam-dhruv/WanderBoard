import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { DiscoveryList } from '@/features/discovery/components/DiscoveryList';
import type { Place } from '@/features/discovery/types';
import { useTripStore } from '@/features/trips/useTripStore';

const MAP_LIBRARIES: ('places' | 'geometry')[] = ['places', 'geometry'];
const FALLBACK_PHOTO_URL = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=800&q=80';
const SEARCH_DEBOUNCE_MS = 400;
const MIN_RADIUS_METERS = 500;
const MAX_RADIUS_METERS = 50000;

function mapNearbyResult(result: google.maps.places.PlaceResult): Place | null {
  if (!result.place_id || !result.name) {
    return null;
  }

  const photo = result.photos?.[0];
  let photoUrl = FALLBACK_PHOTO_URL;

  if (photo) {
    try {
      photoUrl = photo.getUrl({ maxWidth: 800, maxHeight: 600 });
    } catch {
      photoUrl = FALLBACK_PHOTO_URL;
    }
  }

  return {
    placeId: result.place_id,
    name: result.name,
    rating: typeof result.rating === 'number' ? result.rating : 0,
    address: result.vicinity ?? result.formatted_address ?? 'Address unavailable',
    photoUrl,
    location: result.geometry?.location
      ? {
          lat: result.geometry.location.lat(),
          lng: result.geometry.location.lng(),
        }
      : undefined,
  };
}

export function DiscoveryPage() {
  const { activeTrip } = useTripStore();
  const [tripLocation, setTripLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [idleTick, setIdleTick] = useState(0);
  const mapRef = useRef<google.maps.Map | null>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '',
    libraries: MAP_LIBRARIES,
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
        return;
      }

      setTripLocation(null);
      setMapError('Unable to locate this destination.');
    });
  }, [activeTrip, isLoaded]);

  const normalizedQuery = useMemo(() => searchQuery.trim(), [searchQuery]);

  const executeNearbySearch = useCallback(() => {
    const map = mapRef.current;
    if (!map || !window.google?.maps?.places || !window.google?.maps?.geometry) {
      return;
    }

    const center = map.getCenter();
    const bounds = map.getBounds();
    if (!center || !bounds) {
      return;
    }

    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const viewportDiameter = window.google.maps.geometry.spherical.computeDistanceBetween(ne, sw);
    const radius = Math.max(
      MIN_RADIUS_METERS,
      Math.min(MAX_RADIUS_METERS, Math.round(viewportDiameter / 2)),
    );

    const requestId = ++requestIdRef.current;
    setLoading(true);
    setSearchError(null);

    const service = new window.google.maps.places.PlacesService(map);
    service.nearbySearch(
      {
        location: center,
        radius,
        keyword: normalizedQuery || undefined,
      },
      (results, status) => {
        if (requestId !== requestIdRef.current) {
          return;
        }

        setHasSearched(true);

        if (status === window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS || !results) {
          setPlaces([]);
          setLoading(false);
          return;
        }

        if (status !== window.google.maps.places.PlacesServiceStatus.OK) {
          setPlaces([]);
          setSearchError(`Places search failed with status: ${status}`);
          setLoading(false);
          return;
        }

        const mappedPlaces = results
          .map(mapNearbyResult)
          .filter((place): place is Place => place !== null);

        setPlaces(mappedPlaces);
        setLoading(false);
      },
    );
  }, [normalizedQuery]);

  useEffect(() => {
    if (!tripLocation || !mapRef.current || !isLoaded) {
      return;
    }

    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = window.setTimeout(() => {
      executeNearbySearch();
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, [tripLocation, idleTick, isLoaded, normalizedQuery, executeNearbySearch]);

  useEffect(() => () => {
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
    }
  }, []);

  if (!activeTrip) {
    return null;
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-50">
      {!isLoaded && (
        <div className="flex h-full items-center justify-center text-sm text-gray-500">Loading map...</div>
      )}
      {loadError && (
        <div className="flex h-full items-center justify-center text-sm text-red-500">Map failed to load.</div>
      )}
      {isLoaded && mapError && (
        <div className="flex h-full items-center justify-center text-sm text-gray-500">{mapError}</div>
      )}
      {isLoaded && !mapError && !tripLocation && (
        <div className="flex h-full items-center justify-center text-sm text-gray-500">Finding destination...</div>
      )}

      {isLoaded && tripLocation && (
        <>
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={tripLocation}
            zoom={13}
            onLoad={(map) => {
              mapRef.current = map;
            }}
            onUnmount={() => {
              mapRef.current = null;
            }}
            onIdle={() => {
              setIdleTick((value) => value + 1);
            }}
            options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: true }}
          >
            <Marker position={tripLocation} />
            {places.map((place) =>
              place.location ? (
                <Marker
                  key={`marker-${place.placeId}`}
                  position={place.location}
                  title={place.name}
                />
              ) : null,
            )}
          </GoogleMap>

          <div className="absolute inset-y-4 left-4 z-10 w-[min(92vw,28rem)] rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-xl backdrop-blur-sm">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Discovery</p>
              <h2 className="text-lg font-semibold text-gray-900">Nearby places</h2>
            </div>

            <div className="mt-4">
              <label htmlFor="discovery-search-input" className="block text-sm font-medium text-gray-700">
                Search nearby
              </label>
              <div className="mt-2 flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
                <input
                  id="discovery-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="cafes, viewpoints, museums..."
                  className="w-full border-0 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
                />
              </div>
              {searchError && (
                <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-700">
                  {searchError}
                </div>
              )}
            </div>

            <div className="mt-4 h-[calc(100%-11.5rem)] overflow-y-auto pr-1">
              <DiscoveryList
                tripId={activeTrip.id}
                places={places}
                isLoading={loading}
                hasSearched={hasSearched}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
