// ─── Weather domain types ────────────────────────────────────────────────────

export interface WeatherData {
  temperature: number;         // °C
  feelsLike: number;           // °C
  description: string;         // e.g. "light rain"
  icon: string;                // OWM icon code
  humidity: number;            // %
  windSpeed: number;           // m/s
  precipitationProbability: number; // 0–100 %
  fetchedAt: number;           // Unix ms
  location?: string;             // e.g. "New Delhi"
}

export interface SolarData {
  sunrise: string;             // HH:MM (local time)
  sunriseIso: string;          // ISO 8601
  sunset: string;              // HH:MM (local time)
  sunsetIso: string;           // ISO 8601
  goldenHourMorningStart: string; // HH:MM
  goldenHourMorningEnd: string;   // HH:MM
  goldenHourEveningStart: string; // HH:MM
  goldenHourEveningEnd: string;   // HH:MM
  date: string;                // YYYY-MM-DD
}

export interface WeatherCoords {
  lat: number;
  lon: number;
  date: string; // YYYY-MM-DD
}
