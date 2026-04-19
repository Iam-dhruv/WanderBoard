import { DiscoveryCard } from '@/features/discovery/components/DiscoveryCard';
import type { Place } from '@/features/discovery/types';

interface DiscoveryListProps {
  tripId: string;
  places: Place[];
  isLoading: boolean;
  hasSearched: boolean;
  tripStartDate?: string;
  tripEndDate?: string;
  selectedPlaceId?: string | null;
  hoveredPlaceId?: string | null;
  onHoverChange?: (placeId: string | null) => void;
  onCardClick?: (placeId: string) => void;
}

export function DiscoveryList({
  tripId, places, isLoading, hasSearched, tripStartDate, tripEndDate,
  selectedPlaceId, hoveredPlaceId, onHoverChange, onCardClick,
}: DiscoveryListProps) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-500 shadow-sm">
        Loading places...
      </div>
    );
  }

  if (hasSearched && places.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">
        No results found. Try a different search term.
      </div>
    );
  }

  if (places.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {places.map((place) => (
        <DiscoveryCard
          key={place.placeId}
          tripId={tripId}
          place={place}
          tripStartDate={tripStartDate}
          tripEndDate={tripEndDate}
          isSelected={selectedPlaceId === place.placeId}
          isHovered={hoveredPlaceId === place.placeId}
          onHoverChange={(hovered) => onHoverChange?.(hovered ? place.placeId : null)}
          onCardClick={() => onCardClick?.(place.placeId)}
        />
      ))}
    </div>
  );
}
