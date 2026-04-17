import type { BucketListLocation, BucketListWeather } from '@/types';

const WEATHER_CACHE_TTL_MS = 45 * 60 * 1000;
const PRECIP_PROB_THRESHOLD = 40;
const EXTREME_HEAT_THRESHOLD = 38;

const WEATHER_CODE_LABELS: Record<number, string> = {
  0: 'Clear',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  56: 'Freezing drizzle',
  57: 'Heavy freezing drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  67: 'Heavy freezing rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Light showers',
  81: 'Showers',
  82: 'Heavy showers',
  85: 'Light snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Severe thunderstorm',
};

const CONTINGENCY_CODES = new Set<number>([
  3, 45, 48,
  51, 53, 55, 56, 57,
  61, 63, 65, 66, 67,
  71, 73, 75, 77,
  80, 81, 82, 85, 86,
  95, 96, 99,
]);

interface OpenMeteoResponse {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
  };
  hourly?: {
    time?: string[];
    precipitation_probability?: number[];
    weather_code?: number[];
    temperature_2m?: number[];
  };
  daily?: {
    sunrise?: string[];
    sunset?: string[];
  };
}

function buildCacheKey(location: BucketListLocation) {
  const lat = location.lat.toFixed(3);
  const lng = location.lng.toFixed(3);
  return `weather:${lat}:${lng}`;
}

function parseTimeToMs(value?: string) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function isGoldenHour(now: number, sunrise: number, sunset: number) {
  if (!sunrise || !sunset) return false;
  const goldenAfterSunrise = now >= sunrise && now <= sunrise + 60 * 60 * 1000;
  const goldenBeforeSunset = now >= sunset - 60 * 60 * 1000 && now <= sunset;
  return goldenAfterSunrise || goldenBeforeSunset;
}

function getNearestHourIndex(times: string[] | undefined, targetMs: number) {
  if (!times || times.length === 0) return -1;
  let bestIndex = 0;
  let bestDiff = Number.POSITIVE_INFINITY;

  times.forEach((time, index) => {
    const ms = parseTimeToMs(time);
    const diff = Math.abs(ms - targetMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function getConditionLabel(code: number) {
  return WEATHER_CODE_LABELS[code] ?? 'Unknown';
}

export function isWeatherStale(updatedAt: number) {
  return Date.now() - updatedAt > WEATHER_CACHE_TTL_MS;
}

export function getCachedWeatherSnapshot(location: BucketListLocation): BucketListWeather | null {
  try {
    const raw = window.localStorage.getItem(buildCacheKey(location));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BucketListWeather;
    if (!parsed || typeof parsed.updatedAt !== 'number') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function setCachedWeatherSnapshot(location: BucketListLocation, snapshot: BucketListWeather) {
  try {
    window.localStorage.setItem(buildCacheKey(location), JSON.stringify(snapshot));
  } catch {
    // Ignore cache write errors
  }
}

export async function getWeatherSnapshot(
  location: BucketListLocation,
  proposedTime?: string,
): Promise<BucketListWeather> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', location.lat.toString());
  url.searchParams.set('longitude', location.lng.toString());
  url.searchParams.set('current', 'temperature_2m,weather_code');
  url.searchParams.set('hourly', 'precipitation_probability,weather_code,temperature_2m');
  url.searchParams.set('daily', 'sunrise,sunset');
  url.searchParams.set('forecast_days', '2');
  url.searchParams.set('timezone', 'auto');

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error('WEATHER_FETCH_FAILED');
  }

  const payload = (await response.json()) as OpenMeteoResponse;
  const now = Date.now();

  const currentTemp = payload.current?.temperature_2m ?? 0;
  const currentCode = payload.current?.weather_code ?? 0;
  const sunrise = parseTimeToMs(payload.daily?.sunrise?.[0]);
  const sunset = parseTimeToMs(payload.daily?.sunset?.[0]);

  const targetMs = proposedTime ? parseTimeToMs(proposedTime) : now;
  const hourIndex = getNearestHourIndex(payload.hourly?.time, targetMs);
  const hourlyCode = hourIndex >= 0 && payload.hourly?.weather_code
    ? payload.hourly.weather_code[hourIndex]
    : undefined;
  const hourlyPrecip = hourIndex >= 0 && payload.hourly?.precipitation_probability
    ? payload.hourly.precipitation_probability[hourIndex]
    : undefined;
  const hourlyTemp = hourIndex >= 0 && payload.hourly?.temperature_2m
    ? payload.hourly.temperature_2m[hourIndex]
    : undefined;

  const conditionCode = typeof hourlyCode === 'number' ? hourlyCode : currentCode;
  const condition = getConditionLabel(conditionCode);

  const isContingency = (
    CONTINGENCY_CODES.has(conditionCode)
    || (typeof hourlyPrecip === 'number' && hourlyPrecip >= PRECIP_PROB_THRESHOLD)
    || (typeof hourlyTemp === 'number' && hourlyTemp >= EXTREME_HEAT_THRESHOLD)
  );

  return {
    temperature: currentTemp,
    condition,
    conditionCode,
    sunrise,
    sunset,
    isGoldenHour: isGoldenHour(now, sunrise, sunset),
    isContingency,
    updatedAt: now,
  };
}
