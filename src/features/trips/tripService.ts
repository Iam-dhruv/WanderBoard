import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  arrayUnion,
  query,
  where,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { generateInviteCode, isValidInviteCode, normalizeInviteCode } from '@/lib/generateInviteCode';
import { ok, err, type Result, type Trip, type TripMember } from '@/types';

// ─── Firestore collection helpers ─────────────────────────────────────────────

const tripsCol     = () => collection(db, 'trips');
const tripDoc      = (id: string) => doc(db, 'trips', id);
const membersCol   = (tripId: string) => collection(db, 'trips', tripId, 'members');
const memberDoc    = (tripId: string, uid: string) => doc(db, 'trips', tripId, 'members', uid);

// ─── Create trip ──────────────────────────────────────────────────────────────

export interface CreateTripInput {
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  ownerId: string;
  ownerDisplayName: string;
  ownerEmail: string;
  ownerPhotoURL: string | null;
}

export async function createTrip(input: CreateTripInput): Promise<Result<Trip>> {
  try {
    const tripRef  = doc(tripsCol());          // auto-generated ID
    const inviteCode = generateInviteCode();

    const trip: Omit<Trip, 'id'> = {
      name:        input.name.trim(),
      destination: input.destination.trim(),
      startDate:   input.startDate,
      endDate:     input.endDate,
      inviteCode,
      ownerId:     input.ownerId,
      memberIds:   [input.ownerId],            // owner is always first member
      createdAt:   Date.now(),
    };

    const ownerMember: TripMember = {
      userId:      input.ownerId,
      displayName: input.ownerDisplayName,
      email:       input.ownerEmail,
      photoURL:    input.ownerPhotoURL,
      role:        'owner',
      joinedAt:    Date.now(),
    };

    // Atomic write: create trip doc + owner member sub-doc together
    await runTransaction(db, async (tx) => {
      tx.set(tripRef, trip);
      tx.set(memberDoc(tripRef.id, input.ownerId), ownerMember);
    });

    return ok({ id: tripRef.id, ...trip });
  } catch (e: any) {
    console.error('[createTrip]', e);
    return err('Failed to create trip. Please try again.');
  }
}

// ─── Join trip via invite code ─────────────────────────────────────────────────
// Security rules enforce that:
//  1. The user is authenticated
//  2. The code matches the trip document
//  3. The user is not already a member
// This service layer does the same checks for fast UX feedback,
// but the rules are the authoritative gate.

export interface JoinTripInput {
  rawCode: string;
  userId: string;
  displayName: string;
  email: string;
  photoURL: string | null;
}

export async function joinTrip(input: JoinTripInput): Promise<Result<Trip>> {
  const code = normalizeInviteCode(input.rawCode);

  if (!isValidInviteCode(code)) {
    return err('Invalid invite code format. Codes are 6 characters (letters and numbers).');
  }

  try {
    // Find the trip with this invite code
    const q = query(tripsCol(), where('inviteCode', '==', code));
    const snap = await getDocs(q);

    if (snap.empty) {
      return err('No trip found with that invite code. Check the code and try again.');
    }

    const tripSnap = snap.docs[0];
    const trip = { id: tripSnap.id, ...tripSnap.data() } as Trip;

    if (trip.memberIds.includes(input.userId)) {
      return err('You are already a member of this trip.');
    }

    const newMember: TripMember = {
      userId:      input.userId,
      displayName: input.displayName,
      email:       input.email,
      photoURL:    input.photoURL,
      role:        'member',
      joinedAt:    Date.now(),
    };

    // Atomic: add to memberIds array + create member sub-doc
    await runTransaction(db, async (tx) => {
      tx.update(tripDoc(trip.id), { memberIds: arrayUnion(input.userId) });
      tx.set(memberDoc(trip.id, input.userId), newMember);
    });

    return ok({ ...trip, memberIds: [...trip.memberIds, input.userId] });
  } catch (e: any) {
    console.error('[joinTrip]', e);
    return err('Failed to join trip. Please try again.');
  }
}

// ─── Get all trips for a user ──────────────────────────────────────────────────

export async function getUserTrips(userId: string): Promise<Result<Trip[]>> {
  try {
    const q = query(tripsCol(), where('memberIds', 'array-contains', userId));
    const snap = await getDocs(q);
    const trips = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Trip));
    return ok(trips);
  } catch (e: any) {
    console.error('[getUserTrips]', e);
    return err('Failed to load trips.');
  }
}

// ─── Get members of a trip ────────────────────────────────────────────────────

export async function getTripMembers(tripId: string): Promise<Result<TripMember[]>> {
  try {
    const snap = await getDocs(membersCol(tripId));
    const members = snap.docs.map((d) => d.data() as TripMember);
    return ok(members);
  } catch (e: any) {
    console.error('[getTripMembers]', e);
    return err('Failed to load trip members.');
  }
}

// ─── Get single trip ──────────────────────────────────────────────────────────

export async function getTrip(tripId: string): Promise<Result<Trip>> {
  try {
    const snap = await getDoc(tripDoc(tripId));
    if (!snap.exists()) return err('Trip not found.');
    return ok({ id: snap.id, ...snap.data() } as Trip);
  } catch (e: any) {
    console.error('[getTrip]', e);
    return err('Failed to load trip.');
  }
}
