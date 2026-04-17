import { memo, useEffect, useState } from 'react';
import { addToBucket } from '@/features/discovery/services/bucketService';
import type { Place } from '@/features/discovery/types';

const FALLBACK_CARD_IMAGE = 'https://images.unsplash.com/photo-1526772662000-3f88f10405ff?auto=format&fit=crop&w=800&q=80';

interface DiscoveryCardProps {
  tripId: string;
  place: Place;
  onAdded?: (place: Place) => void;
  isAlreadyAdded?: boolean;
}

function DiscoveryCardBase({ tripId, place, onAdded, isAlreadyAdded = false }: DiscoveryCardProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [isAdded, setIsAdded] = useState(isAlreadyAdded);
  const [hasImageError, setHasImageError] = useState(false);

  useEffect(() => {
    if (isAlreadyAdded) {
      setIsAdded(true);
    }
  }, [isAlreadyAdded]);

  const handleAdd = async () => {
    if (isAdded || isAdding) {
      return;
    }

    setIsAdding(true);

    try {
      await addToBucket(tripId, place);
      setIsAdded(true);
      onAdded?.(place);
    } catch {
      setIsAdded(false);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <img
        src={hasImageError ? FALLBACK_CARD_IMAGE : place.photoUrl}
        alt={place.name}
        onError={() => setHasImageError(true)}
        className="h-40 w-full object-cover bg-gray-100"
      />
      <div className="space-y-3 p-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 line-clamp-1">{place.name}</h3>
          <p className="mt-1 text-xs text-gray-500 line-clamp-2">{place.address}</p>
        </div>

        <div className="flex items-center justify-between">
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
            Rating {place.rating.toFixed(1)}
          </span>
          <button
            type="button"
            onClick={handleAdd}
            disabled={isAdding || isAdded}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {isAdded ? 'Added' : isAdding ? 'Adding...' : 'Add'}
          </button>
        </div>
      </div>
    </article>
  );
}

export const DiscoveryCard = memo(DiscoveryCardBase);
