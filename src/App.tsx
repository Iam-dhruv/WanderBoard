import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { DashboardPage } from '@/features/trips/DashboardPage';
import { TripWorkspacePage } from '@/features/trips/TripWorkspacePage';
import { TripBucketListPage } from '@/features/trips/TripBucketListPage';
import { TripPlanningPage } from '@/features/trips/TripPlanningPage';
import { TripDiscoveryPage } from '@/features/trips/TripDiscoveryPage';
import { TripWeatherPage } from '@/features/trips/TripWeatherPage';
import { ExpensesPage } from '@/features/expenses/ExpensesPage';
import { TimelinePage } from '@/features/timeline/TimelinePage';
import { ROUTES } from '@/config/routes';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path={ROUTES.LOGIN} element={<LoginPage />} />
          <Route path={ROUTES.REGISTER} element={<RegisterPage />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />

            <Route path={ROUTES.TRIP} element={<TripWorkspacePage />}>
              <Route index element={<Navigate to="planning" replace />} />

              <Route path="planning" element={<TripPlanningPage />} />
              <Route path="bucket-list" element={<TripBucketListPage />} />
              <Route path="discovery" element={<TripDiscoveryPage />} />
              <Route path="weather" element={<TripWeatherPage />} />

              {/* ✅ Timeline (new feature) */}
              <Route path="timeline" element={<TimelinePage />} />

              {/* ✅ Keep actual Expenses feature (NOT placeholder) */}
              <Route path="expenses" element={<ExpensesPage />} />

              <Route path="*" element={<Navigate to="planning" replace />} />
            </Route>
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}