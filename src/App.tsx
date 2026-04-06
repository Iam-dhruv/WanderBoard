import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { DashboardPage } from '@/features/trips/DashboardPage';
import { TripWorkspacePage } from '@/features/trips/TripWorkspacePage';
import { TripPlanningPage } from '@/features/trips/TripPlanningPage';
import { TripFeaturePlaceholderPage } from '@/features/trips/TripFeaturePlaceholderPage';
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
            <Route path={ROUTES.TRIP} element={<TripWorkspacePage />}>
              <Route index element={<Navigate to="planning" replace />} />
              <Route path="planning" element={<TripPlanningPage />} />
              <Route
                path="bucket-list"
                element={(
                  <TripFeaturePlaceholderPage
                    title="Bucket list"
                    description="Shared activity suggestions and voting will live here once the bucket list owner finishes the feature."
                  />
                )}
              />
              <Route
                path="discovery"
                element={(
                  <TripFeaturePlaceholderPage
                    title="Discovery"
                    description="Map-based activity discovery and search will be added in this tab."
                  />
                )}
              />
              <Route
                path="expenses"
                element={(
                  <TripFeaturePlaceholderPage
                    title="Expenses"
                    description="Expense splitting and settlement will be wired into this tab."
                  />
                )}
              />
              <Route
                path="contingency"
                element={(
                  <TripFeaturePlaceholderPage
                    title="Contingency"
                    description="Weather-based warnings and trip contingency planning will live here."
                  />
                )}
              />
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
