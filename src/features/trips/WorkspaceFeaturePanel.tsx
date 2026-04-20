import { TripPlanningPage } from './TripPlanningPage';
import { TimelinePage } from '@/features/timeline/TimelinePage';
import { TripBucketListPage } from './TripBucketListPage';
import { TripDiscoveryPage } from './TripDiscoveryPage';
import { TripWeatherPage } from './TripWeatherPage';
import { ExpensesPage } from '@/features/expenses/ExpensesPage';
import type { WorkspacePanelKey } from './useWorkspacePanelStore';

export function WorkspaceFeaturePanel({ panelKey }: { panelKey: WorkspacePanelKey }) {
  if (panelKey === 'planning') return <TripPlanningPage />;
  if (panelKey === 'timeline') return <TimelinePage />;
  if (panelKey === 'bucket-list') return <TripBucketListPage />;
  if (panelKey === 'discovery') return <TripDiscoveryPage />;
  if (panelKey === 'weather') return <TripWeatherPage />;
  if (panelKey === 'expenses') return <ExpensesPage />;
  return null;
}
