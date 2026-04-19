import { memo, useEffect, useMemo, useState } from 'react';
import { addToBucket } from '@/features/discovery/services/bucketService';
import type { Place } from '@/features/discovery/types';
import { useAuth } from '@/features/auth/AuthProvider';
import { err, type BucketListUserData } from '@/types';
import { AddToBucketModal } from '@/features/discovery/components/AddToBucketModal';

const FALLBACK_CARD_IMAGE = 'https://images.unsplash.com/photo-1526772662000-3f88f10405ff?auto=format&fit=crop&w=800&q=80';

interface DiscoveryCardProps {
  tripId: string;
  place: Place;
  onAdded?: (place: Place) => void;
  isAlreadyAdded?: boolean;
  tripStartDate?: string;
  tripEndDate?: string;
  isSelected?: boolean;
  isHovered?: boolean;
  onHoverChange?: (hovered: boolean) => void;
  onCardClick?: () => void;
}

function DiscoveryCardBase({
  tripId, place, onAdded, isAlreadyAdded = false, tripStartDate, tripEndDate,
  isSelected, isHovered, onHoverChange, onCardClick,
}: DiscoveryCardProps) {
  const { user } = useAuth();
  const [isAdding, setIsAdding] = useState(false);
  const [isAdded, setIsAdded] = useState(isAlreadyAdded);
  const [error, setError] = useState<string | null>(null);
  const [hasImageError, setHasImageError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const addedBy = useMemo(() => {
    const displayName = user?.displayName ?? user?.email ?? 'Traveler';
    return user
      ? {
          userId: user.uid,
          displayName,
          photoURL: user.photoURL ?? null,
        }
      : null;
  }, [user]);

  useEffect(() => {
    if (isAlreadyAdded) {
      setIsAdded(true);
    }
  }, [isAlreadyAdded]);

  const handleAdd = async (userData: BucketListUserData) => {
    if (isAdded || isAdding) {
      return err('Item already added.');
    }

    if (!addedBy) {
      const message = 'Please sign in to add places.';
      setError(message);
      return err(message);
    }

    setIsAdding(true);
    setError(null);

    const result = await addToBucket(tripId, place, addedBy, userData);
    if (result.ok) {
      setIsAdded(true);
      onAdded?.(place);
    } else {
      setIsAdded(result.error.includes('already') ? true : false);
      setError(result.error);
    }

    setIsAdding(false);
    return result;
  };

  const handleOpen = () => {
    if (isAdded || isAdding) {
      return;
    }

    if (!addedBy) {
      setError('Please sign in to add places.');
      return;
    }

    setError(null);
    setIsModalOpen(true);
  };

  const active = isSelected || isHovered;

  return (
    <article
      id={`place-card-${place.placeId}`}
      className="overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow duration-150 cursor-pointer"
      style={{ borderColor: isSelected ? 'var(--wb-ocean)' : isHovered ? 'var(--wb-ink-soft)' : '#f3f4f6', boxShadow: active ? 'var(--wb-shadow-md)' : undefined }}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
      onClick={onCardClick}
    >
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
            onClick={handleOpen}
            disabled={isAdding || isAdded}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {isAdded ? 'Added' : isAdding ? 'Adding...' : 'Add'}
          </button>
        </div>
        {error && (
          <p className="text-xs text-rose-600">{error}</p>
        )}
      </div>
      <AddToBucketModal
        isOpen={isModalOpen}
        place={place}
        minDate={tripStartDate}
        maxDate={tripEndDate}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleAdd}
      />
    </article>
  );
}

export const DiscoveryCard = memo(DiscoveryCardBase);
