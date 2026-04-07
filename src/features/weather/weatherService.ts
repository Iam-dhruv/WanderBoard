import type { WeatherCoords, WeatherData, SolarData } from './types';
import { ok, err, type Result } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format a Date object to "HH:MM" in the local timezone of the browser. */
function toHHMM(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Add minutes to a Date and return a new Date.
 * Used for golden-hour window calculation (±30 min around sunrise/sunset).
 */
function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

// ─── Weather data (OpenWeatherMap free One-Call-compatible endpoint) ───────────
// Uses the /forecast endpoint (free tier) to get precipitation probability
// for the requested date. Falls back to /weather for current conditions.

export async function fetchWeatherData(
  coords: WeatherCoords
): Promise<Result<WeatherData>> {
  const apiKey = import.meta.env.VITE_WEATHER_API_KEY as string | undefined;

  if (!apiKey) {
    return err(
      'Missing VITE_WEATHER_API_KEY. Add it to .env.local to enable weather data.'
    );
  }

  try {
    // /forecast gives 3-hourly forecasts for 5 days (free tier)
    const url = new URL('https://api.openweathermap.org/data/2.5/forecast');
    url.searchParams.set('lat', String(coords.lat));
    url.searchParams.set('lon', String(coords.lon));
    url.searchParams.set('appid', apiKey);
    url.searchParams.set('units', 'metric');

    const res = await fetch(url.toString());

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg: string = (body as any)?.message ?? `HTTP ${res.status}`;
      return err(`Weather API error: ${msg}`);
    }

    const json = await res.json() as {
      list: Array<{
        dt: number;
        main: { temp: number; feels_like: number; humidity: number };
        weather: Array<{ description: string; icon: string }>;
        wind: { speed: number };
        pop: number; // precipitation probability 0–1
        dt_txt: string;
      }>;
    };

    if (!json.list?.length) {
      return err('No forecast data returned for this location.');
    }

    // Find the forecast entry closest to noon on the requested date
    const targetDate = coords.date; // YYYY-MM-DD
    const dateEntries = json.list.filter((e) => e.dt_txt.startsWith(targetDate));
    const entry = dateEntries.length
      ? dateEntries.reduce((prev, curr) => {
          // prefer the entry closest to 12:00
          const prevDelta = Math.abs(new Date(prev.dt_txt).getHours() - 12);
          const currDelta = Math.abs(new Date(curr.dt_txt).getHours() - 12);
          return currDelta < prevDelta ? curr : prev;
        })
      : json.list[0]; // fallback to nearest available

    return ok({
      temperature:              Math.round(entry.main.temp),
      feelsLike:                Math.round(entry.main.feels_like),
      description:              entry.weather[0]?.description ?? 'Unknown',
      icon:                     entry.weather[0]?.icon ?? '01d',
      humidity:                 entry.main.humidity,
      windSpeed:                Math.round(entry.wind.speed * 10) / 10,
      precipitationProbability: Math.round((entry.pop ?? 0) * 100),
      fetchedAt:                Date.now(),
      location:                 json.city?.name ?? 'Unknown location',
    });
  } catch (e: any) {
    console.error('[fetchWeatherData]', e);
    return err('Failed to fetch weather data. Check your network connection.');
  }
}

// ─── Solar data (sunrise-sunset.org — no API key required) ────────────────────

export async function fetchSolarData(
  coords: WeatherCoords
): Promise<Result<SolarData>> {
  try {
    const url = new URL('https://api.sunrise-sunset.org/json');
    url.searchParams.set('lat', String(coords.lat));
    url.searchParams.set('lng', String(coords.lon));
    url.searchParams.set('date', coords.date);
    url.searchParams.set('formatted', '0'); // ISO 8601 UTC responses

    const res = await fetch(url.toString());

    if (!res.ok) {
      return err(`Solar API error: HTTP ${res.status}`);
    }

    const json = await res.json() as {
      status: string;
      results: {
        sunrise: string;
        sunset: string;
      };
    };

    if (json.status !== 'OK') {
      return err('Solar API returned an error. Verify the coordinates are valid.');
    }

    const sunrise = new Date(json.results.sunrise);
    const sunset  = new Date(json.results.sunset);

    // Golden hour: ±30 minutes around sunrise and sunset
    const ghMorningStart = addMinutes(sunrise, -10);
    const ghMorningEnd   = addMinutes(sunrise, 40);
    const ghEveningStart = addMinutes(sunset,  -40);
    const ghEveningEnd   = addMinutes(sunset,   10);

    return ok({
      sunrise:                toHHMM(sunrise),
      sunriseIso:             sunrise.toISOString(),
      sunset:                 toHHMM(sunset),
      sunsetIso:              sunset.toISOString(),
      goldenHourMorningStart: toHHMM(ghMorningStart),
      goldenHourMorningEnd:   toHHMM(ghMorningEnd),
      goldenHourEveningStart: toHHMM(ghEveningStart),
      goldenHourEveningEnd:   toHHMM(ghEveningEnd),
      date:                   coords.date,
    });
  } catch (e: any) {
    console.error('[fetchSolarData]', e);
    return err('Failed to fetch solar data. Check your network connection.');
  }
}

// ─── Combined fetch ────────────────────────────────────────────────────────────
// Fires both requests in parallel for efficiency.

export async function fetchEnvironmentalData(coords: WeatherCoords): Promise<{
  weather: Result<WeatherData>;
  solar:   Result<SolarData>;
}> {
  const [weather, solar] = await Promise.all([
    fetchWeatherData(coords),
    fetchSolarData(coords),
  ]);
  return { weather, solar };
}
