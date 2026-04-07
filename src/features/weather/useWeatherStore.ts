import { create } from 'zustand';
import type { WeatherData, SolarData, WeatherCoords } from './types';
import { fetchEnvironmentalData } from './weatherService';

// ─── Weather store ─────────────────────────────────────────────────────────────

interface WeatherState {
  weather:        WeatherData | null;
  solar:          SolarData   | null;
  coords:         WeatherCoords | null;
  weatherLoading: boolean;
  weatherError:   string | null;
  solarError:     string | null;

  /** Fetch weather + solar data for given coordinates and date. */
  loadEnvironmentalData: (coords: WeatherCoords) => Promise<void>;

  /** Clear all weather state (e.g. when leaving a trip workspace). */
  reset: () => void;
}

const initialState = {
  weather:        null,
  solar:          null,
  coords:         null,
  weatherLoading: false,
  weatherError:   null,
  solarError:     null,
};

export const useWeatherStore = create<WeatherState>((set) => ({
  ...initialState,

  loadEnvironmentalData: async (coords) => {
    // Avoid re-fetching if coords + date haven't changed
    set((s) => {
      const same =
        s.coords?.lat  === coords.lat &&
        s.coords?.lon  === coords.lon &&
        s.coords?.date === coords.date;
      if (same && (s.weather || s.solar)) return {}; // no-op
      return { weatherLoading: true, weatherError: null, solarError: null, coords };
    });

    const { weather, solar } = await fetchEnvironmentalData(coords);

    set({
      weather:        weather.ok ? weather.data : null,
      solar:          solar.ok   ? solar.data   : null,
      weatherLoading: false,
      weatherError:   weather.ok ? null : weather.error,
      solarError:     solar.ok   ? null : solar.error,
    });
  },

  reset: () => set(initialState),
}));
