import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { DashboardPage } from '@/features/trips/DashboardPage';
import { TripWorkspacePage } from '@/features/trips/TripWorkspacePage';
import { ROUTES } from '@/config/routes';

export default function App() {
  return (
    // AuthProvider must wrap the router so all route components can call useAuth()
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes — redirect to dashboard if already signed in */}
          <Route path={ROUTES.LOGIN}    element={<LoginPage />} />
          <Route path={ROUTES.REGISTER} element={<RegisterPage />} />

          {/* Protected routes — ProtectedRoute redirects to /login if not authed */}
          <Route element={<ProtectedRoute />}>
            <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
            <Route path={ROUTES.TRIP}      element={<TripWorkspacePage />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
