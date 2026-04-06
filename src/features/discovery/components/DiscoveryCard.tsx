import type { Place } from '@/features/discovery/types';

interface DiscoveryCardProps {
  place: Place;
}

export function DiscoveryCard({ place }: DiscoveryCardProps) {
  return (
    <article className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <img
        src={place.photoUrl}
        alt={place.name}
        className="h-40 w-full object-cover bg-gray-100"
      />
      <div className="space-y-2 p-4">
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-1">{place.name}</h3>
        <p className="text-xs font-medium text-amber-700">Rating: {place.rating.toFixed(1)}</p>
        <p className="text-xs text-gray-500 line-clamp-2">{place.address}</p>
      </div>
    </article>
  );
}
