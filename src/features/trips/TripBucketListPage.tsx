import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { ROUTES } from '@/config/routes';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  addBucketComment,
  castBucketVote,
  deleteBucketItem,
  listenToBucketComments,
  listenToBucketList,
  updateBucketItemOrder,
  type BucketListSortMode,
} from '@/features/discovery/services/bucketService';
import type { AppUser, BucketListComment, BucketListItem, VoteValue } from '@/types';
import { useTripStore } from './useTripStore';
import { useTripMap } from './TripMapContext';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '@/config/firebase';
// ── NEW: MiniWeatherCard from the canonical weather feature ──────────────────
import { MiniWeatherCard } from '@/features/weather/MiniWeatherCard';

const FALLBACK_CARD_IMAGE = 'https://images.unsplash.com/photo-1526772662000-3f88f10405ff?auto=format&fit=crop&w=800&q=80';

export function TripBucketListPage() {
  const { activeTrip } = useTripStore();
  const { user } = useAuth();
  const { setMapMarkers, setRenderInfoWindow, setSelectedMarkerId, setHoveredMarkerId } = useTripMap();
  const [items, setItems] = useState<BucketListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<BucketListSortMode>('score');
  const [scheduledBucketIds, setScheduledBucketIds] = useState<Set<string>>(new Set());
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

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
  }, [items, activeTrip, scheduledBucketIds, setMapMarkers, setRenderInfoWindow, setSelectedMarkerId, setHoveredMarkerId]);

  // NOTE: refreshBucketItemWeather removed — MiniWeatherCard handles its own fetching
  // from the canonical weather feature, so no duplicate API calls via the legacy service.

  if (!activeTrip) {
    return null;
  }

  const isOwner = activeTrip.ownerId === user?.uid;
  const isManualSort = sortMode === 'order';

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id || !activeTrip) {
      return;
    }

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);

    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    const nextItems = arrayMove<BucketListItem>(items, oldIndex, newIndex);
    const movedItem = nextItems[newIndex];
    const prevOrder = nextItems[newIndex - 1]?.order;
    const nextOrder = nextItems[newIndex + 1]?.order;
    const newOrder = calculateOrder(prevOrder, nextOrder);

    setItems(nextItems.map((item: BucketListItem) => (
      item.id === movedItem.id ? { ...item, order: newOrder } : item
    )));

    await updateBucketItemOrder(activeTrip.id, movedItem.id, newOrder);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white border border-gray-100 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Bucket list</p>
            <h2 className="text-2xl font-semibold text-gray-900">Vote and rank the must-do spots</h2>
            <p className="text-sm text-gray-500">
              Added time comes from the server clock, so ordering stays consistent for every traveler.
            </p>
          </div>
          <Link
            to={ROUTES.tripDiscovery(activeTrip.id)}
            className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
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
          <SortChip
            label="Manual order"
            isActive={sortMode === 'order'}
            onClick={() => setSortMode('order')}
          />
        </div>
        {isManualSort && (
          <p className="mt-2 text-xs text-gray-500">Drag cards using the handle to reorder the list.</p>
        )}
      </section>

      {loading && (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-sm text-gray-500 shadow-sm">
          Loading bucket list...
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}
      {!loading && items.length === 0 && !error && (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
          No items yet. Add places from the Discovery tab to get started.
        </div>
      )}

      {isManualSort ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {items.map((item) => (
                <SortableBucketCard
                  key={item.id}
                  item={item}
                  tripId={activeTrip.id}
                  tripStartDate={activeTrip.startDate}
                  tripEndDate={activeTrip.endDate}
                  isOwner={isOwner}
                  currentUser={user}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
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
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SortChip({ label, isActive, onClick }: { label: string; isActive: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-full px-3 py-1 text-xs font-medium transition-colors',
        isActive ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

function calculateOrder(previous?: number, next?: number) {
  if (typeof previous === 'number' && typeof next === 'number') {
    return (previous + next) / 2;
  }
  if (typeof previous === 'number') {
    return previous + 1;
  }
  if (typeof next === 'number') {
    return next - 1;
  }
  return Date.now();
}

function SortableBucketCard(props: {
  item: BucketListItem;
  tripId: string;
  tripStartDate: string;
  tripEndDate: string;
  isOwner: boolean;
  currentUser: AppUser | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.item.id,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <BucketListCard
        {...props}
        showDragHandle
        dragHandleProps={listeners}
        dragHandleAttributes={attributes}
      />
    </div>
  );
}

function BucketListCard({
  item,
  tripId,
  tripStartDate,
  tripEndDate,
  isOwner,
  currentUser,
  showDragHandle = false,
  dragHandleProps,
  dragHandleAttributes,
}: {
  item: BucketListItem;
  tripId: string;
  tripStartDate: string;
  tripEndDate: string;
  isOwner: boolean;
  currentUser: AppUser | null;
  showDragHandle?: boolean;
  dragHandleProps?: Record<string, unknown>;
  dragHandleAttributes?: DraggableAttributes;
}) {
  const [hasImageError, setHasImageError] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [voteLoading, setVoteLoading] = useState<'up' | 'down' | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showComments, setShowComments] = useState(false);

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
    <article className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="grid gap-4 p-4 md:grid-cols-[200px,1fr]">
        <img
          src={hasImageError || !item.photoUrl ? FALLBACK_CARD_IMAGE : item.photoUrl}
          alt={item.name}
          onError={() => setHasImageError(true)}
          className="h-40 w-full rounded-xl object-cover bg-gray-100"
        />

        <div className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-start gap-2">
              {showDragHandle && (
                <button
                  type="button"
                  className="mt-1 rounded-md border border-gray-200 px-2 py-1 text-[10px] font-semibold text-gray-500 hover:bg-gray-50"
                  aria-label="Drag to reorder"
                  {...dragHandleAttributes}
                  {...dragHandleProps}
                >
                  |||
                </button>
              )}
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-gray-900">{item.name}</h3>
                <p className="text-sm text-gray-500">{item.address}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
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
            <button
              type="button"
              onClick={() => setShowComments((prev) => !prev)}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
            >
              {showComments ? 'Hide comments' : 'Show comments'}
            </button>
          </div>

          {voteError && <p className="text-xs text-rose-600">{voteError}</p>}
          {deleteError && <p className="text-xs text-rose-600">{deleteError}</p>}

          {showComments && (
            <BucketItemComments tripId={tripId} itemId={item.id} currentUser={currentUser} />
          )}
        </div>
      </div>
    </article>
  );
}

function BucketItemComments({
  tripId,
  itemId,
  currentUser,
}: {
  tripId: string;
  itemId: string;
  currentUser: AppUser | null;
}) {
  const [comments, setComments] = useState<BucketListComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const unsubscribe = listenToBucketComments(
      tripId,
      itemId,
      (nextComments) => {
        setComments(nextComments);
        setLoading(false);
      },
      (errMessage) => {
        setError(errMessage);
        setLoading(false);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [tripId, itemId]);

  const displayName = useMemo(
    () => currentUser?.displayName ?? currentUser?.email ?? 'Traveler',
    [currentUser],
  );

  const handleSubmit = async () => {
    if (!currentUser || submitting) {
      if (!currentUser) {
        setError('Sign in to comment.');
      }
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await addBucketComment(tripId, itemId, {
      userId: currentUser.uid,
      userName: displayName,
      userPhotoUrl: currentUser.photoURL ?? null,
      message,
    });

    if (result.ok) {
      setMessage('');
    } else {
      setError(result.error);
    }

    setSubmitting(false);
  };

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-800">Comments</h4>
        <span className="text-xs text-gray-500">{comments.length}</span>
      </div>

      {loading && <p className="text-xs text-gray-500">Loading comments...</p>}
      {!loading && comments.length === 0 && (
        <p className="text-xs text-gray-500">No comments yet. Start the discussion.</p>
      )}

      <div className="space-y-3">
        {comments.map((comment) => (
          <div key={comment.id} className="flex gap-3">
            <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-semibold">
              {getInitials(comment.userName)}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <span className="font-semibold text-gray-800">{comment.userName}</span>
                <span>{formatDate(comment.createdAt)}</span>
              </div>
              <p className="text-sm text-gray-700 mt-1">{comment.message}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={2}
          placeholder="Add a comment..."
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
        <div className="flex items-center justify-between">
          {error ? <span className="text-xs text-rose-600">{error}</span> : <span />}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !message.trim()}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {submitting ? 'Posting...' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  );
}

function LegacyWeatherFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-2 py-1">
      <p className="text-[10px] uppercase tracking-[0.08em] text-gray-500">{label}</p>
      <p className="mt-0.5 text-xs font-semibold text-gray-700">{value}</p>
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

function getInitials(name: string) {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}
