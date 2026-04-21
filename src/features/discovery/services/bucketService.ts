import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  deleteField,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { Place } from '@/features/discovery/types';
import {
  err,
  ok,
  type BucketListComment,
  type BucketListItem,
  type BucketListLocation,
  type BucketListUserData,
  type BucketListWeather,
  type Result,
  type VoteValue,
} from '@/types';
import {
  getCachedWeatherSnapshot,
  getWeatherSnapshot,
  isWeatherStale,
  setCachedWeatherSnapshot,
} from './weatherService';

export type BucketListSortMode = 'score' | 'recent';

export interface BucketListAddedBy {
  userId: string;
  displayName: string;
  photoURL: string | null;
}

const bucketListCol = (tripId: string) => collection(db, 'trips', tripId, 'bucketList');
const bucketItemDoc = (tripId: string, itemId: string) => doc(db, 'trips', tripId, 'bucketList', itemId);
const bucketCommentsCol = (tripId: string, itemId: string) => collection(db, 'trips', tripId, 'bucketList', itemId, 'comments');

function toMillis(value: unknown): number {
  if (value instanceof Timestamp) {
    return value.toMillis();
  }
  if (typeof value === 'number') {
    return value;
  }
  return Date.now();
}

function toBucketListItem(tripId: string, id: string, data: Record<string, any>): BucketListItem {
  const votesByUser = (data.votesByUser ?? {}) as Record<string, VoteValue>;
  const location = data.location as BucketListLocation | undefined;
  const weather = data.weather as BucketListWeather | undefined;
  const userData = data.userData as BucketListUserData | undefined;
  const createdAt = toMillis(data.createdAt);
  const order = typeof data.order === 'number' ? data.order : createdAt;

  return {
    id,
    tripId,
    placeId: data.placeId ?? id,
    name: data.name ?? 'Untitled place',
    rating: typeof data.rating === 'number' ? data.rating : 0,
    address: data.address ?? 'Address unavailable',
    photoUrl: data.photoUrl ?? '',
    location: location && typeof location.lat === 'number' && typeof location.lng === 'number'
      ? location
      : undefined,
    addedById: data.addedById ?? '',
    addedByName: data.addedByName ?? 'Traveler',
    addedByPhotoUrl: data.addedByPhotoUrl ?? null,
    createdAt,
    order,
    weather: weather && typeof weather.temperature === 'number' ? weather : undefined,
    userData: userData && typeof userData === 'object' ? userData : undefined,
    upvotes: typeof data.upvotes === 'number' ? data.upvotes : 0,
    downvotes: typeof data.downvotes === 'number' ? data.downvotes : 0,
    score: typeof data.score === 'number' ? data.score : 0,
    votesByUser,
  };
}

function toBucketListComment(itemId: string, id: string, data: Record<string, any>): BucketListComment {
  return {
    id,
    itemId,
    userId: data.userId ?? '',
    userName: data.userName ?? 'Traveler',
    userPhotoUrl: data.userPhotoUrl ?? null,
    message: data.message ?? '',
    createdAt: toMillis(data.createdAt),
  };
}

function normalizeUserData(userData?: BucketListUserData): BucketListUserData | undefined {
  if (!userData) return undefined;

  const normalized: BucketListUserData = {};

  if (userData.customTitle?.trim()) {
    normalized.customTitle = userData.customTitle.trim();
  }

  if (userData.notes?.trim()) {
    normalized.notes = userData.notes.trim();
  }

  if (userData.proposedDate?.trim()) {
    const proposedDate = userData.proposedDate.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(proposedDate)) {
      normalized.proposedDate = proposedDate;
    }
  }

  if (userData.proposedTime?.trim()) {
    normalized.proposedTime = userData.proposedTime.trim();
  }

  if (userData.activityType?.trim()) {
    normalized.activityType = userData.activityType.trim();
  }

  if (userData.priority) {
    normalized.priority = userData.priority;
  }

  if (userData.tags && userData.tags.length > 0) {
    normalized.tags = userData.tags.map((tag) => tag.trim()).filter(Boolean);
  }

  if (typeof userData.durationMinutes === 'number' && userData.durationMinutes > 0) {
    // Round up to nearest 15-minute boundary; cap at 8 hours
    const quantised = Math.ceil(userData.durationMinutes / 15) * 15;
    normalized.durationMinutes = Math.min(480, quantised);
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export async function addToBucket(
  tripId: string,
  place: Place,
  addedBy: BucketListAddedBy,
  userData?: BucketListUserData,
): Promise<Result<void>> {
  const normalizedTripId = tripId.trim();
  if (!normalizedTripId) {
    return err('Trip ID is required to add a place.');
  }

  if (!place.placeId) {
    return err('Place ID is missing. Try a different result.');
  }

  try {
    const order = Date.now();
    const location = place.location
      ? { lat: place.location.lat, lng: place.location.lng }
      : undefined;
    const trimmedUserData = normalizeUserData(userData);

    const payload: Record<string, unknown> = {
      name: place.name,
      rating: place.rating,
      address: place.address,
      photoUrl: place.photoUrl,
      placeId: place.placeId,
      addedById: addedBy.userId,
      addedByName: addedBy.displayName,
      addedByPhotoUrl: addedBy.photoURL,
      createdAt: serverTimestamp(),
      order,
      upvotes: 0,
      downvotes: 0,
      score: 0,
      votesByUser: {},
    };

    if (location) {
      payload.location = location;
    }

    if (trimmedUserData) {
      payload.userData = trimmedUserData;
    }

    const ref = await addDoc(bucketListCol(normalizedTripId), payload);

    // Auto-upvote by the creator must happen as an update because create rules
    // require fresh items to start with zeroed vote fields.
    const autoVote = await castBucketVote(normalizedTripId, ref.id, addedBy.userId, 'up');
    if (!autoVote.ok) {
      console.warn('[addToBucket] Auto-upvote failed', autoVote.error);
    }

    return ok(undefined);
  } catch (e: any) {
    console.error('[addToBucket]', e);
    return err('Failed to add this place. Please try again.');
  }
}

export function listenToBucketList(
  tripId: string,
  sortMode: BucketListSortMode,
  onUpdate: (items: BucketListItem[]) => void,
  onError?: (message: string) => void,
): () => void {
  const normalizedTripId = tripId.trim();
  const baseQuery = bucketListCol(normalizedTripId);
  const bucketQuery = sortMode === 'recent'
    ? query(baseQuery, orderBy('createdAt', 'desc'))
    : query(baseQuery, orderBy('score', 'desc'), orderBy('createdAt', 'desc'));

  return onSnapshot(
    bucketQuery,
    (snapshot) => {
      const items = snapshot.docs.map((docSnap) =>
        toBucketListItem(normalizedTripId, docSnap.id, docSnap.data()),
      );
      onUpdate(items);
    },
    (error) => {
      console.error('[listenToBucketList]', error);
      onError?.('Unable to load the bucket list right now.');
    },
  );
}

export async function updateBucketItemWeather(
  tripId: string,
  itemId: string,
  weather: BucketListWeather,
): Promise<Result<void>> {
  const normalizedTripId = tripId.trim();
  if (!normalizedTripId) {
    return err('Trip ID is required.');
  }

  try {
    await updateDoc(bucketItemDoc(normalizedTripId, itemId), { weather });
    return ok(undefined);
  } catch (e: any) {
    console.error('[updateBucketItemWeather]', e);
    return err('Failed to update weather.');
  }
}

export async function refreshBucketItemWeather(
  tripId: string,
  item: BucketListItem,
): Promise<Result<void>> {
  if (!item.location) {
    return ok(undefined);
  }

  if (item.weather && !isWeatherStale(item.weather.updatedAt)) {
    return ok(undefined);
  }

  const cached = getCachedWeatherSnapshot(item.location);
  if (cached && !isWeatherStale(cached.updatedAt)) {
    await updateBucketItemWeather(tripId, item.id, cached);
    return ok(undefined);
  }

  try {
    const snapshot = await getWeatherSnapshot(item.location, item.userData?.proposedTime);
    setCachedWeatherSnapshot(item.location, snapshot);
    await updateBucketItemWeather(tripId, item.id, snapshot);
    return ok(undefined);
  } catch (e: any) {
    console.error('[refreshBucketItemWeather]', e);
    return err('Failed to refresh weather.');
  }
}

export async function castBucketVote(
  tripId: string,
  itemId: string,
  userId: string,
  direction: 'up' | 'down',
): Promise<Result<void>> {
  const normalizedTripId = tripId.trim();

  try {
    await runTransaction(db, async (tx) => {
      const itemRef = bucketItemDoc(normalizedTripId, itemId);
      const snap = await tx.get(itemRef);
      if (!snap.exists()) {
        throw new Error('NOT_FOUND');
      }

      const data = snap.data() as Record<string, any>;
      const votesByUser = (data.votesByUser ?? {}) as Record<string, VoteValue>;
      const currentVote = votesByUser[userId] ?? 0;

      let nextVote: VoteValue = currentVote;
      if (direction === 'up') {
        nextVote = currentVote === 1 ? 0 : 1;
      } else {
        nextVote = currentVote === -1 ? 0 : -1;
      }

      let upvotes = typeof data.upvotes === 'number' ? data.upvotes : 0;
      let downvotes = typeof data.downvotes === 'number' ? data.downvotes : 0;

      if (currentVote === 1) upvotes -= 1;
      if (currentVote === -1) downvotes -= 1;
      if (nextVote === 1) upvotes += 1;
      if (nextVote === -1) downvotes += 1;

      if (upvotes < 0) upvotes = 0;
      if (downvotes < 0) downvotes = 0;

      const updates: Record<string, any> = {
        upvotes,
        downvotes,
        score: upvotes - downvotes,
      };

      if (nextVote === 0) {
        updates[`votesByUser.${userId}`] = deleteField();
      } else {
        updates[`votesByUser.${userId}`] = nextVote;
      }

      tx.update(itemRef, updates);
    });

    return ok(undefined);
  } catch (e: any) {
    if (e?.message === 'NOT_FOUND') {
      return err('This item was removed.');
    }
    console.error('[castBucketVote]', e);
    return err('Failed to update your vote. Please try again.');
  }
}

export async function deleteBucketItem(tripId: string, itemId: string): Promise<Result<void>> {
  const normalizedTripId = tripId.trim();
  if (!normalizedTripId) {
    return err('Trip ID is required.');
  }

  try {
    await deleteDoc(bucketItemDoc(normalizedTripId, itemId));
    return ok(undefined);
  } catch (e: any) {
    console.error('[deleteBucketItem]', e);
    return err('Failed to remove this item.');
  }
}

export async function addBucketComment(
  tripId: string,
  itemId: string,
  comment: { userId: string; userName: string; userPhotoUrl: string | null; message: string },
): Promise<Result<void>> {
  const normalizedTripId = tripId.trim();
  if (!normalizedTripId) {
    return err('Trip ID is required.');
  }

  if (!comment.message.trim()) {
    return err('Comment cannot be empty.');
  }

  if (comment.message.trim().length > 500) {
    return err('Comments must be 500 characters or less.');
  }

  try {
    await addDoc(bucketCommentsCol(normalizedTripId, itemId), {
      userId: comment.userId,
      userName: comment.userName,
      userPhotoUrl: comment.userPhotoUrl,
      message: comment.message.trim(),
      createdAt: serverTimestamp(),
    });
    return ok(undefined);
  } catch (e: any) {
    console.error('[addBucketComment]', e);
    return err('Failed to add comment.');
  }
}

export function listenToBucketComments(
  tripId: string,
  itemId: string,
  onUpdate: (comments: BucketListComment[]) => void,
  onError?: (message: string) => void,
): () => void {
  const normalizedTripId = tripId.trim();
  const commentsQuery = query(bucketCommentsCol(normalizedTripId, itemId), orderBy('createdAt', 'asc'));

  return onSnapshot(
    commentsQuery,
    (snapshot) => {
      const comments = snapshot.docs.map((docSnap) =>
        toBucketListComment(itemId, docSnap.id, docSnap.data()),
      );
      onUpdate(comments);
    },
    (error) => {
      console.error('[listenToBucketComments]', error);
      onError?.('Unable to load comments.');
    },
  );
}
