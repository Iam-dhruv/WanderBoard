import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { ROUTES } from '@/config/routes';
import {
  castBucketVote,
  deleteBucketItem,
  listenToBucketList,
  type BucketListSortMode,
} from '@/features/discovery/services/bucketService';
import type { AppUser, BucketListItem, VoteValue } from '@/types';
import { useTripStore } from './useTripStore';
import { useTripMap } from './TripMapContext';
import { useWorkspacePanelStore } from './useWorkspacePanelStore';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '@/config/firebase';
// ── NEW: MiniWeatherCard from the canonical weather feature ──────────────────
import { MiniWeatherCard } from '@/features/weather/MiniWeatherCard';

const FALLBACK_CARD_IMAGE = 'https://images.unsplash.com/photo-1526772662000-3f88f10405ff?auto=format&fit=crop&w=800&q=80';

function fetchPlacePhotoUrl(
  service: google.maps.places.PlacesService,
  placeId: string,
): Promise<string | null> {
  return new Promise((resolve) => {
    service.getDetails(
      { placeId, fields: ['photos'] },
      (place, status) => {
        if (
          status !== window.google.maps.places.PlacesServiceStatus.OK
          || !place?.photos?.length
        ) {
          resolve(null);
          return;
        }

        try {
          const url = place.photos[0].getUrl({ maxWidth: 1000, maxHeight: 700 });
          resolve(url || null);
        } catch {
          resolve(null);
        }
      },
    );
  });
}

export function TripBucketListPage() {
  const { activeTrip } = useTripStore();
  const { user } = useAuth();
  const { mapRef, isLoaded, setMapMarkers, setRenderInfoWindow, setSelectedMarkerId, setHoveredMarkerId } = useTripMap();
  const [items, setItems] = useState<BucketListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<BucketListSortMode>('score');
  const [scheduledBucketIds, setScheduledBucketIds] = useState<Set<string>>(new Set());
  const [photoUrlOverrides, setPhotoUrlOverrides] = useState<Record<string, string>>({});
  const photoLookupPendingRef = useRef<Set<string>>(new Set());
  const openPanels = useWorkspacePanelStore((s) => s.openPanels);
  const hasDiscoveryPanel = useMemo(
    () => openPanels.some((panel) => panel.key === 'discovery'),
    [openPanels],
  );

  // Track which bucket items have been scheduled in the timeline
  useEffect(() => {
    if (!activeTrip) return;
    const q = query(collection(db, 'trips', activeTrip.id, 'timeline'));
    return onSnapshot(q, (snap) => {
      const ids = new Set(
        snap.docs
          .map((d) => d.data().bucketItemId as string | null)
          .filter((id): id is string => Boolean(id)),
      );
      setScheduledBucketIds(ids);
    });
  }, [activeTrip]);

  useEffect(() => {
    if (!activeTrip) return;

    setLoading(true);
    setError(null);

    const unsubscribe = listenToBucketList(
      activeTrip.id,
      sortMode,
      (nextItems) => {
        setItems(nextItems);
        setLoading(false);
      },
      (message) => {
        setError(message);
        setLoading(false);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [activeTrip, sortMode]);

  useEffect(() => {
    // Priority order for map content: discovery > bucket-list > planning.
    // If discovery is open, bucket-list does not override markers.
    if (hasDiscoveryPanel) return;

    if (!activeTrip) {
      setMapMarkers([]);
      setRenderInfoWindow(null);
      setSelectedMarkerId(null);
      setHoveredMarkerId(null);
      return;
    }

    const markers = items
      .filter((item) => item.location)
      .map((item) => {
        const isScheduled = scheduledBucketIds.has(item.id);
        return {
          id:       item.id,
          position: { lat: item.location!.lat, lng: item.location!.lng },
          title:    isScheduled ? `${item.name} ✓` : item.name,
          color:    isScheduled ? '#6B8F3E' : '#2563eb', // wb-moss when scheduled
        };
      });

    setMapMarkers(markers);

    const renderer = (id: string): ReactNode => {
      const item = items.find((candidate) => candidate.id === id);
      if (!item) {
        return null;
      }

      return (
        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-900">{item.name}</p>
          <p className="text-xs text-gray-500">{item.address}</p>
          <p className="text-xs text-gray-400">Added by {item.addedByName}</p>
        </div>
      );
    };

    setRenderInfoWindow(renderer);

    return () => {
      setMapMarkers([]);
      setRenderInfoWindow(null);
      setSelectedMarkerId(null);
      setHoveredMarkerId(null);
    };
  }, [items, activeTrip, scheduledBucketIds, setMapMarkers, setRenderInfoWindow, setSelectedMarkerId, setHoveredMarkerId, hasDiscoveryPanel]);

  useEffect(() => {
    if (!isLoaded || !mapRef.current || !window.google?.maps?.places) return;

    const candidates = items.filter((item) => (
      !item.photoUrl
      && Boolean(item.placeId)
      && !photoUrlOverrides[item.id]
      && !photoLookupPendingRef.current.has(item.id)
    ));

    if (!candidates.length) return;

    const service = new window.google.maps.places.PlacesService(mapRef.current);
    let cancelled = false;

    void (async () => {
      for (const item of candidates) {
        if (cancelled) return;

        photoLookupPendingRef.current.add(item.id);
        const photoUrl = await fetchPlacePhotoUrl(service, item.placeId);
        photoLookupPendingRef.current.delete(item.id);

        if (cancelled || !photoUrl) continue;
        setPhotoUrlOverrides((prev) => (
          prev[item.id] ? prev : { ...prev, [item.id]: photoUrl }
        ));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [items, isLoaded, mapRef, photoUrlOverrides]);

  // NOTE: refreshBucketItemWeather removed — MiniWeatherCard handles its own fetching
  // from the canonical weather feature, so no duplicate API calls via the legacy service.

  if (!activeTrip) {
    return null;
  }

  const isOwner = activeTrip.ownerId === user?.uid;

  return (
    <div className="h-full overflow-y-auto p-4 space-y-6">
      <section
        className="rounded-[16px] border p-5"
        style={{ background: '#fff', borderColor: 'var(--wb-line)', boxShadow: 'var(--wb-shadow-sm)' }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--wb-ocean)' }}>Bucket list</p>
            <h2 className="font-fraunces text-[22px] font-bold leading-tight tracking-tight" style={{ color: 'var(--wb-ink)' }}>Vote and rank the must-do spots</h2>
            <p className="text-sm" style={{ color: 'var(--wb-ink-soft)' }}>
              Added time comes from the server clock, so ordering stays consistent for every traveler.
            </p>
          </div>
          <Link
            to={ROUTES.tripDiscovery(activeTrip.id)}
            className="wb-btn wb-btn-primary wb-btn-sm"
          >
            Add from discovery
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <SortChip
            label="Top voted"
            isActive={sortMode === 'score'}
            onClick={() => setSortMode('score')}
          />
          <SortChip
            label="Recently added"
            isActive={sortMode === 'recent'}
            onClick={() => setSortMode('recent')}
          />
        </div>
      </section>

      {loading && (
        <div
          className="rounded-[16px] border p-8 text-sm"
          style={{ borderColor: 'var(--wb-line)', background: '#fff', color: 'var(--wb-ink-soft)', boxShadow: 'var(--wb-shadow-sm)' }}
        >
          Loading bucket list...
        </div>
      )}
      {error && (
        <div className="rounded-[16px] border p-4 text-sm" style={{ borderColor: 'var(--wb-sunset)', background: '#FEF2EE', color: 'var(--wb-sunset)' }}>
          {error}
        </div>
      )}
      {!loading && items.length === 0 && !error && (
        <div className="rounded-[16px] border border-dashed p-10 text-center text-sm" style={{ borderColor: 'var(--wb-line)', background: '#fff', color: 'var(--wb-ink-soft)' }}>
          No items yet. Add places from the Discovery tab to get started.
        </div>
      )}

      <div className="space-y-4">
        {items.map((item) => (
          <BucketListCard
            key={item.id}
            item={item}
            tripId={activeTrip.id}
            tripStartDate={activeTrip.startDate}
            tripEndDate={activeTrip.endDate}
            isOwner={isOwner}
            currentUser={user}
            photoUrlOverride={photoUrlOverrides[item.id]}
          />
        ))}
      </div>
    </div>
  );
}

function SortChip({ label, isActive, onClick }: { label: string; isActive: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
      style={
        isActive
          ? { background: 'var(--wb-primary-soft)', color: 'var(--wb-primary)' }
          : { background: 'var(--wb-paper-2)', color: 'var(--wb-ink-soft)' }
      }
    >
      {label}
    </button>
  );
}

function BucketListCard({
  item,
  tripId,
  tripStartDate,
  tripEndDate,
  isOwner,
  currentUser,
  photoUrlOverride,
}: {
  item: BucketListItem;
  tripId: string;
  tripStartDate: string;
  tripEndDate: string;
  isOwner: boolean;
  currentUser: AppUser | null;
  photoUrlOverride?: string;
}) {
  const [hasImageError, setHasImageError] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [voteLoading, setVoteLoading] = useState<'up' | 'down' | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const currentUserId = currentUser?.uid ?? null;
  const currentVote: VoteValue = currentUserId ? (item.votesByUser[currentUserId] ?? 0) : 0;
  const canDelete = Boolean(currentUserId && (isOwner || item.addedById === currentUserId));
  const proposedLabel = getProposedLabel(item.userData?.proposedDate, item.userData?.proposedTime);
  const weatherTarget = resolveBucketWeatherDate({
    proposedDate: item.userData?.proposedDate,
    proposedTime: item.userData?.proposedTime,
    tripStartDate,
    tripEndDate,
  });
  const resolvedPhotoUrl = item.photoUrl || photoUrlOverride || FALLBACK_CARD_IMAGE;

  useEffect(() => {
    setHasImageError(false);
  }, [item.photoUrl, photoUrlOverride]);

  const handleVote = async (direction: 'up' | 'down') => {
    if (!currentUserId || voteLoading) {
      if (!currentUserId) {
        setVoteError('Sign in to vote on bucket list items.');
      }
      return;
    }

    setVoteLoading(direction);
    setVoteError(null);

    const result = await castBucketVote(tripId, item.id, currentUserId, direction);
    if (!result.ok) {
      setVoteError(result.error);
    }

    setVoteLoading(null);
  };

  const handleDelete = async () => {
    if (!canDelete || deleteLoading) {
      return;
    }

    setDeleteLoading(true);
    setDeleteError(null);

    const result = await deleteBucketItem(tripId, item.id);
    if (!result.ok) {
      setDeleteError(result.error);
    }

    setDeleteLoading(false);
  };

  return (
    <article
      className="overflow-hidden rounded-[16px] border bg-white"
      style={{ borderColor: 'var(--wb-line)', boxShadow: 'var(--wb-shadow-sm)' }}
    >
      <div className="grid gap-4 p-4 md:grid-cols-[200px,1fr]">
        <img
          src={hasImageError ? FALLBACK_CARD_IMAGE : resolvedPhotoUrl}
          alt={item.name}
          onError={() => setHasImageError(true)}
          className="h-40 w-full rounded-xl object-cover"
          style={{ background: 'var(--wb-paper-2)' }}
        />

        <div className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-start gap-2">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--wb-ink)' }}>{item.name}</h3>
                <p className="text-sm" style={{ color: 'var(--wb-ink-soft)' }}>{item.address}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: 'var(--wb-ink-soft)' }}>
              <span className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-700">
                Rating {item.rating.toFixed(1)}
              </span>
              {proposedLabel && (
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
                  Proposed for {proposedLabel}
                </span>
              )}
              <span>Added by {item.addedByName}</span>
              <span>{formatDate(item.createdAt)}</span>
            </div>
          </div>

          {/* ── Weather section ─────────────────────────────────────────────────
              Priority:
              1. If item has coordinates → fetch live weather for target visit day
              2. Else, if Firestore weather exists → render legacy snapshot      */}
          {item.location ? (
            /* ── MiniWeatherCard: use saved coordinates (fallback to place name) */
            <MiniWeatherCard
              lat={item.location.lat}
              lon={item.location.lng}
              placeName={item.address}
              tripDate={weatherTarget.date}
              forecastLabel={weatherTarget.label}
            />
          ) : item.weather ? (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.1em] text-gray-500">Weather summary</p>
                  <p className="text-sm font-semibold text-gray-900">{Math.round(item.weather.temperature)}°C</p>
                </div>
                <span className="flex items-center gap-1 text-xs text-gray-600">
                  <span className="h-2 w-2 rounded-full bg-sky-400" aria-hidden />
                  {item.weather.condition}
                </span>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                <LegacyWeatherFact label="Sunrise" value={formatTime(item.weather.sunrise)} />
                <LegacyWeatherFact label="Sunset" value={formatTime(item.weather.sunset)} />
                <LegacyWeatherFact label="Condition code" value={String(item.weather.conditionCode)} />
                <LegacyWeatherFact label="Updated" value={formatTime(item.weather.updatedAt)} />
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                {item.weather.isGoldenHour && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                    Golden hour now
                  </span>
                )}
                {item.weather.isContingency && (
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                    Contingency flag
                  </span>
                )}
              </div>
              <div className="mt-2 text-[11px] text-gray-500">
                Snapshot captured on {formatDate(item.weather.updatedAt)} at {formatTime(item.weather.updatedAt)}
              </div>
            </div>
          ) : null}

          {item.userData && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
              {item.userData.activityType && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">
                  {item.userData.activityType}
                </span>
              )}
              {typeof item.userData.durationMinutes === 'number' && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
                  {item.userData.durationMinutes} min
                </span>
              )}
            </div>
          )}

          {item.userData?.notes && (
            <p className="text-sm text-gray-600">{item.userData.notes}</p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-full bg-gray-50 px-3 py-1">
              <button
                type="button"
                onClick={() => handleVote('up')}
                disabled={voteLoading !== null}
                className={`text-sm font-semibold transition-colors ${currentVote === 1 ? 'text-emerald-600' : 'text-gray-500 hover:text-gray-800'}`}
              >
                ▲
              </button>
              <span className="text-sm font-semibold text-gray-900">{item.score}</span>
              <button
                type="button"
                onClick={() => handleVote('down')}
                disabled={voteLoading !== null}
                className={`text-sm font-semibold transition-colors ${currentVote === -1 ? 'text-rose-600' : 'text-gray-500 hover:text-gray-800'}`}
              >
                ▼
              </button>
            </div>
            <span className="text-xs text-gray-500">{item.upvotes} up • {item.downvotes} down</span>
            {canDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteLoading}
                className="text-xs font-medium text-rose-600 hover:text-rose-700"
              >
                {deleteLoading ? 'Removing...' : 'Remove'}
              </button>
            )}
          </div>

          {voteError && <p className="text-xs text-rose-600">{voteError}</p>}
          {deleteError && <p className="text-xs text-rose-600">{deleteError}</p>}
        </div>
      </div>
    </article>
  );
}

function LegacyWeatherFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white px-2 py-1" style={{ borderColor: 'var(--wb-line)' }}>
      <p className="text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--wb-ink-soft)' }}>{label}</p>
      <p className="mt-0.5 text-xs font-semibold" style={{ color: 'var(--wb-ink)' }}>{value}</p>
    </div>
  );
}

function resolveBucketWeatherDate({
  proposedDate,
  proposedTime,
  tripStartDate,
  tripEndDate,
}: {
  proposedDate?: string;
  proposedTime?: string;
  tripStartDate: string;
  tripEndDate: string;
}): { date: string; label: string } {
  const normalizedProposedDate = normalizeIsoDate(proposedDate);
  if (normalizedProposedDate) {
    return { date: normalizedProposedDate, label: `Forecast for ${formatIsoDate(normalizedProposedDate)}` };
  }

  const proposedDateFromTime = getDateFromProposedTime(proposedTime);
  if (proposedDateFromTime) {
    return { date: proposedDateFromTime, label: `Forecast for ${formatIsoDate(proposedDateFromTime)}` };
  }

  const today = toIsoLocalDate(new Date());
  const tripIsOngoingAfterStart = today > tripStartDate && today <= tripEndDate;

  if (tripIsOngoingAfterStart) {
    return { date: today, label: 'Forecast for today' };
  }

  return { date: tripStartDate, label: 'Forecast for trip start' };
}

function getProposedLabel(proposedDate?: string, proposedTime?: string): string | null {
  const normalizedProposedDate = normalizeIsoDate(proposedDate);
  if (normalizedProposedDate) {
    return formatIsoDate(normalizedProposedDate);
  }

  if (proposedTime) {
    return formatDateTime(proposedTime);
  }

  return null;
}

function normalizeIsoDate(value?: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function getDateFromProposedTime(value?: string): string | null {
  if (!value) return null;

  const directDateMatch = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (directDateMatch) return directDateMatch[1];

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return toIsoLocalDate(new Date(parsed));
}

function toIsoLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatIsoDate(value: string): string {
  const parsed = Date.parse(`${value}T00:00:00`);
  if (Number.isNaN(parsed)) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(new Date(parsed));
}

// ─── Formatting helpers ────────────────────────────────────────────────────────

function formatDate(value: number) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(value));
}

function formatTime(value: number) {
  if (!value) return 'N/A';
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

function formatDateTime(value: string) {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(new Date(parsed));
}

