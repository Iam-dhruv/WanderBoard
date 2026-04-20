// ─── Route path constants ─────────────────────────────────────────────────────
// Import ROUTES everywhere instead of using magic strings.
// Keeps refactors safe — one change here updates the whole app.

export const ROUTES = {
  LOGIN:      '/login',
  REGISTER:   '/register',
  DASHBOARD:  '/dashboard',
  TRIP:       '/trip/:tripId',
  TRIP_PLANNING:    '/trip/:tripId/planning',
  TRIP_BUCKET_LIST: '/trip/:tripId/bucket-list',
  TRIP_DISCOVERY:   '/trip/:tripId/discovery',
  TRIP_WEATHER:     '/trip/:tripId/weather',
  TRIP_TIMELINE:    '/trip/:tripId/timeline',
  TRIP_EXPENSES:    '/trip/:tripId/expenses',
  // Helper to build a concrete trip URL — avoids manual string interpolation
  trip:              (tripId: string) => `/trip/${tripId}`,
  tripPlanning:      (tripId: string) => `/trip/${tripId}/planning`,
  tripBucketList:    (tripId: string) => `/trip/${tripId}/bucket-list`,
  tripDiscovery:     (tripId: string) => `/trip/${tripId}/discovery`,
  tripWeather:       (tripId: string) => `/trip/${tripId}/weather`,
  tripTimeline:      (tripId: string) => `/trip/${tripId}/timeline`,
  tripExpenses:      (tripId: string) => `/trip/${tripId}/expenses`,
} as const;
