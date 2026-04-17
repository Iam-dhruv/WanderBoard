import type { Place } from '@/features/discovery/types';

const FALLBACK_PHOTO_URL = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=800&q=80';

type PlacesServiceStatus = 'OK' | 'ZERO_RESULTS' | string;

interface PlacePhoto {
  getUrl(options?: { maxWidth?: number; maxHeight?: number }): string;
}

interface PlaceResult {
  name?: string;
  rating?: number;
  formatted_address?: string;
  vicinity?: string;
  photos?: PlacePhoto[];
  place_id?: string;
}

interface PlacesService {
  textSearch(
    request: { query: string },
    callback: (results: PlaceResult[] | null, status: PlacesServiceStatus) => void,
  ): void;
}

interface PlacesNamespace {
  PlacesService: new (attrContainer: HTMLDivElement) => PlacesService;
  PlacesServiceStatus: {
    OK: PlacesServiceStatus;
    ZERO_RESULTS: PlacesServiceStatus;
  };
}

interface GoogleMaps {
  places: PlacesNamespace;
}

interface GoogleLike {
  maps: GoogleMaps;
}

declare global {
  interface Window {
    google?: GoogleLike;
  }
}

function resolvePlacesApi(): PlacesNamespace {
  const places = window.google?.maps?.places;
  if (!places) {
    throw new Error('Google Places API is unavailable. Ensure the Maps JavaScript script is loaded.');
  }

  return places;
}

function getPhotoUrl(place: PlaceResult): string {
  const primaryPhoto = place.photos?.[0];
  if (!primaryPhoto) {
    return FALLBACK_PHOTO_URL;
  }

  try {
    return primaryPhoto.getUrl({ maxWidth: 800, maxHeight: 600 });
  } catch {
    return FALLBACK_PHOTO_URL;
  }
}

function mapPlaceResult(result: PlaceResult): Place | null {
  if (!result.name || !result.place_id) {
    return null;
  }

  return {
    name: result.name,
    rating: typeof result.rating === 'number' ? result.rating : 0,
    address: result.formatted_address ?? result.vicinity ?? 'Address unavailable',
    photoUrl: getPhotoUrl(result),
    placeId: result.place_id,
  };
}

export async function searchPlaces(query: string): Promise<Place[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const places = resolvePlacesApi();
  const service = new places.PlacesService(document.createElement('div'));

  return new Promise<Place[]>((resolve, reject) => {
    service.textSearch({ query: trimmedQuery }, (results, status) => {
      if (status === places.PlacesServiceStatus.ZERO_RESULTS || !results) {
        resolve([]);
        return;
      }

      if (status !== places.PlacesServiceStatus.OK) {
        reject(new Error(`Places search failed with status: ${status}`));
        return;
      }

      const mapped = results
        .map(mapPlaceResult)
        .filter((place): place is Place => place !== null);

      resolve(mapped);
    });
  });
}
