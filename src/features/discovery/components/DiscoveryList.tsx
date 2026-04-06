import { DiscoveryCard } from '@/features/discovery/components/DiscoveryCard';
import type { Place } from '@/features/discovery/types';

interface DiscoveryListProps {
  places: Place[];
  loading: boolean;
}

export function DiscoveryList({ places, loading }: DiscoveryListProps) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-500 shadow-sm">
        Loading places...
      </div>
    );
  }

  if (!loading && places.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">
        No places found. Try another search.
      </div>
    );
  }

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {places.map((place) => (
        <DiscoveryCard key={place.placeId} place={place} />
      ))}
    </section>
  );
}
