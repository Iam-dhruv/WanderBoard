// ─── Route path constants ─────────────────────────────────────────────────────
// Import ROUTES everywhere instead of using magic strings.
// Keeps refactors safe — one change here updates the whole app.

export const ROUTES = {
  LOGIN:      '/login',
  REGISTER:   '/register',
  DASHBOARD:  '/dashboard',
  TRIP:       '/trip/:tripId',
  // Helper to build a concrete trip URL — avoids manual string interpolation
  trip: (tripId: string) => `/trip/${tripId}`,
} as const;
