import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { ROUTES } from '@/config/routes';

// ─── ProtectedRoute ───────────────────────────────────────────────────────────
// Wraps routes that require authentication.
//
// Usage in App.tsx:
//   <Route element={<ProtectedRoute />}>
//     <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
//     <Route path={ROUTES.TRIP}      element={<TripWorkspacePage />} />
//   </Route>
//
// While Firebase resolves the auth state (loading = true), renders a blank
// screen rather than flashing the login page. This avoids a jarring redirect
// for users who are already signed in.

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    // Keep the screen blank — the auth check is fast (~100ms)
    return null;
  }

  if (!user) {
    // Pass the attempted location so LoginPage can redirect back after login
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  return <Outlet />;
}
