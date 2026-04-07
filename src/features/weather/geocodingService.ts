import { ok, err, type Result } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Coordinates {
  lat: number;
  lon: number;
  /** Resolved city name returned by the API (may differ from query) */
  resolvedName: string;
}

// ─── In-memory cache ──────────────────────────────────────────────────────────
// Keyed by normalised destination string. Lives for the browser session —
// avoids re-geocoding the same city when navigating between trips.

const cache = new Map<string, Coordinates>();

function cacheKey(destination: string): string {
  return destination.trim().toLowerCase();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Resolve a destination string (e.g. "Goa", "Reykjavik, Iceland") to
 * geographic coordinates using the OpenWeatherMap Geocoding API.
 *
 * Returns a cached result if the same destination was already resolved
 * during this session.
 */
export async function getCoordinatesFromCity(
  destination: string
): Promise<Result<Coordinates>> {
  const apiKey = import.meta.env.VITE_WEATHER_API_KEY as string | undefined;

  if (!apiKey) {
    return err(
      'Missing VITE_WEATHER_API_KEY. Weather and geocoding are unavailable.'
    );
  }

  const key = cacheKey(destination);
  if (cache.has(key)) {
    return ok(cache.get(key)!);
  }

  try {
    const url = new URL('https://api.openweathermap.org/geo/1.0/direct');
    url.searchParams.set('q', destination.trim());
    url.searchParams.set('limit', '1');
    url.searchParams.set('appid', apiKey);

    const res = await fetch(url.toString());

    if (!res.ok) {
      return err(`Geocoding API error: HTTP ${res.status}`);
    }

    const json = await res.json() as Array<{
      lat: number;
      lon: number;
      name: string;
      country: string;
    }>;

    if (!Array.isArray(json) || json.length === 0) {
      return err(
        `Could not find coordinates for "${destination}". ` +
        'Try a more specific name, e.g. "Goa, India".'
      );
    }

    const { lat, lon, name, country } = json[0];
    const coords: Coordinates = {
      lat,
      lon,
      resolvedName: `${name}, ${country}`,
    };

    cache.set(key, coords);
    return ok(coords);
  } catch (e: any) {
    console.error('[getCoordinatesFromCity]', e);
    return err('Failed to resolve location. Check your network connection.');
  }
}
