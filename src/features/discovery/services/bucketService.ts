import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { Place } from '@/features/discovery/types';

export async function addToBucket(tripId: string, place: Place): Promise<void> {
  const normalizedTripId = tripId.trim();
  if (!normalizedTripId) {
    throw new Error('Trip ID is required to add a place.');
  }

  await addDoc(collection(db, 'trips', normalizedTripId, 'bucketList'), {
    name: place.name,
    rating: place.rating,
    address: place.address,
    photoUrl: place.photoUrl,
    placeId: place.placeId,
    createdAt: serverTimestamp(),
  });
}
