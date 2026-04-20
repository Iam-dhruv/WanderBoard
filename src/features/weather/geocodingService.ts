import { ok, err, type Result } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Coordinates {
  lat: number;
  lon: number;
  /** Resolved city name returned by the API (may differ from query) */
  resolvedName: string;
}

export interface GeocodingHints {
  placeId?: string;
  expectedCountry?: string;
  expectedState?: string;
}

// ─── In-memory cache ──────────────────────────────────────────────────────────
// Keyed by normalised destination string. Lives for the browser session —
// avoids re-geocoding the same city when navigating between trips.

const cache = new Map<string, Coordinates>();

function cacheKey(destination: string, hints?: GeocodingHints): string {
  return [
    destination.trim().toLowerCase(),
    hints?.placeId?.trim().toLowerCase() ?? '',
    normalizeCountryCode(hints?.expectedCountry),
    normalizeState(hints?.expectedState),
  ].join('|');
}

function normalizeAlpha(value: string | undefined): string {
  return (value ?? '').trim().toUpperCase().replace(/[^A-Z]/g, '');
}

function normalizeCountryCode(value: string | undefined): string {
  const raw = normalizeAlpha(value);
  if (!raw) return '';

  const aliases: Record<string, string> = {
    USA: 'US',
    UNITEDSTATES: 'US',
    US: 'US',
    CANADA: 'CA',
    CA: 'CA',
    UNITEDKINGDOM: 'GB',
    UK: 'GB',
    GREATBRITAIN: 'GB',
    GB: 'GB',
  };

  if (aliases[raw]) return aliases[raw];
  if (raw.length === 2) return raw;
  return raw;
}

function normalizeState(value: string | undefined): string {
  const raw = normalizeAlpha(value);
  if (!raw) return '';
  const aliases: Record<string, string> = {
    CALIFORNIA: 'CA',
    CA: 'CA',
  };
  return aliases[raw] ?? raw;
}

function extractPrimaryDestination(destination: string): string {
  return destination.split(';')[0]?.trim() ?? destination.trim();
}

function parseDestination(destination: string): GeocodingHints {
  const primary = extractPrimaryDestination(destination);
  const tokens = primary.split(',').map((token) => token.trim()).filter(Boolean);

  if (tokens.length < 2) return {};

  const expectedCountry = normalizeCountryCode(tokens[tokens.length - 1]);
  const expectedState = tokens.length >= 3 ? normalizeState(tokens[tokens.length - 2]) : '';

  return {
    expectedCountry: expectedCountry || undefined,
    expectedState: expectedState || undefined,
  };
}

interface OpenWeatherGeocodeResult {
  lat: number;
  lon: number;
  name: string;
  state?: string;
  country: string;
}

interface GooglePlaceGeocodeResponse {
  status: string;
  results?: Array<{
    formatted_address: string;
    geometry?: { location?: { lat: number; lng: number } };
  }>;
}

function pickBestCandidate(
  candidates: OpenWeatherGeocodeResult[],
  expectedCountry?: string,
  expectedState?: string,
): Result<OpenWeatherGeocodeResult> {
  if (candidates.length === 0) {
    return err('No matching geocoding candidates were returned.');
  }

  const country = normalizeCountryCode(expectedCountry);
  const state = normalizeState(expectedState);

  let next = candidates;
  if (country) {
    const countryMatches = next.filter((candidate) => normalizeCountryCode(candidate.country) === country);
    if (countryMatches.length === 0) {
      return err('Geocoding mismatch: resolved location did not match the expected country.');
    }
    next = countryMatches;
  }

  if (state) {
    const stateMatches = next.filter((candidate) => normalizeState(candidate.state) === state);
    if (stateMatches.length > 0) {
      next = stateMatches;
    } else {
      const hasStateData = next.some((candidate) => Boolean(candidate.state));
      if (hasStateData) {
        return err('Geocoding mismatch: resolved location did not match the expected state/region.');
      }
    }
  }

  return ok(next[0]);
}

async function geocodeFromPlaceId(placeId: string): Promise<Result<Coordinates>> {
  const mapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  if (!mapsKey) {
    return err('Missing VITE_GOOGLE_MAPS_API_KEY for placeId geocoding fallback.');
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('place_id', placeId);
    url.searchParams.set('key', mapsKey);

    const res = await fetch(url.toString());
    if (!res.ok) {
      return err(`Google Geocoding API error: HTTP ${res.status}`);
    }

    const json = await res.json() as GooglePlaceGeocodeResponse;
    if (json.status !== 'OK' || !json.results?.length) {
      return err(`Google Geocoding API returned status: ${json.status}`);
    }

    const first = json.results[0];
    const location = first.geometry?.location;
    if (!location) {
      return err('Google Geocoding API response did not include coordinates.');
    }

    return ok({
      lat: location.lat,
      lon: location.lng,
      resolvedName: first.formatted_address,
    });
  } catch (e: any) {
    console.error('[geocodeFromPlaceId]', e);
    return err('Failed to resolve placeId location.');
  }
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
  destination: string,
  hints?: GeocodingHints,
): Promise<Result<Coordinates>> {
  const apiKey = import.meta.env.VITE_WEATHER_API_KEY as string | undefined;

  if (!apiKey) {
    return err(
      'Missing VITE_WEATHER_API_KEY. Weather and geocoding are unavailable.'
    );
  }

  const parsed = parseDestination(destination);
  const expectedCountry = normalizeCountryCode(hints?.expectedCountry ?? parsed.expectedCountry);
  const expectedState = normalizeState(hints?.expectedState ?? parsed.expectedState);

  const mergedHints: GeocodingHints = {
    placeId: hints?.placeId,
    expectedCountry: expectedCountry || undefined,
    expectedState: expectedState || undefined,
  };

  const key = cacheKey(destination, mergedHints);
  if (cache.has(key)) {
    return ok(cache.get(key)!);
  }

  try {
    if (mergedHints.placeId) {
      const placeResult = await geocodeFromPlaceId(mergedHints.placeId);
      if (placeResult.ok) {
        cache.set(key, placeResult.data);
        return placeResult;
      }
      // PlaceId fallback failed; continue with text geocoding for backward compatibility.
      console.warn('[getCoordinatesFromCity] placeId geocode failed, falling back to text query:', placeResult.error);
    }

    const url = new URL('https://api.openweathermap.org/geo/1.0/direct');
    url.searchParams.set('q', extractPrimaryDestination(destination));
    url.searchParams.set('limit', '5');
    url.searchParams.set('appid', apiKey);

    const res = await fetch(url.toString());

    if (!res.ok) {
      return err(`Geocoding API error: HTTP ${res.status}`);
    }

    const json = await res.json() as OpenWeatherGeocodeResult[];

    if (!Array.isArray(json) || json.length === 0) {
      return err(
        `Could not find coordinates for "${destination}". ` +
        'Try a more specific name, e.g. "Goa, India".'
      );
    }

    const candidate = pickBestCandidate(
      json,
      mergedHints.expectedCountry,
      mergedHints.expectedState,
    );
    if (!candidate.ok) {
      return err(
        `${candidate.error} ` +
        `Please use a more specific destination (e.g. "City, State, Country").`
      );
    }

    const { lat, lon, name, state, country } = candidate.data;
    const coords: Coordinates = {
      lat,
      lon,
      resolvedName: state ? `${name}, ${state}, ${country}` : `${name}, ${country}`,
    };

    cache.set(key, coords);
    return ok(coords);
  } catch (e: any) {
    console.error('[getCoordinatesFromCity]', e);
    return err('Failed to resolve location. Check your network connection.');
  }
}
