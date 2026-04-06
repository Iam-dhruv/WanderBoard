import {
  collection,
  doc,
  getDoc,
  getDocs,
  arrayUnion,
  query,
  where,
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
const inviteDoc    = (code: string) => doc(db, 'tripInvites', code);

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
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const tripRef = doc(tripsCol());
      const inviteCode = generateInviteCode();

      const trip: Omit<Trip, 'id'> = {
        name:        input.name.trim(),
        destination: input.destination.trim(),
        startDate:   input.startDate,
        endDate:     input.endDate,
        inviteCode,
        ownerId:     input.ownerId,
        memberIds:   [input.ownerId],
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

      try {
        await runTransaction(db, async (tx) => {
          const inviteRef = inviteDoc(inviteCode);
          const inviteSnap = await tx.get(inviteRef);

          if (inviteSnap.exists()) {
            throw new Error('INVITE_CODE_COLLISION');
          }

          tx.set(tripRef, trip);
          tx.set(memberDoc(tripRef.id, input.ownerId), ownerMember);
          tx.set(inviteRef, {
            tripId: tripRef.id,
            ownerId: input.ownerId,
            createdAt: Date.now(),
          });
        });

        return ok({ id: tripRef.id, ...trip });
      } catch (e: any) {
        if (e?.message === 'INVITE_CODE_COLLISION') {
          continue;
        }
        throw e;
      }
    }

    return err('Could not generate a unique invite code. Please try again.');
  } catch (e: any) {
    console.error('[createTrip]', e);
    const code = e?.code ? ` (${e.code})` : '';
    return err(`Failed to create trip. Please try again${code}.`);
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
    let resolvedTripId: string | null = null;

    const inviteSnap = await getDoc(inviteDoc(code));
    if (inviteSnap.exists()) {
      const { tripId } = inviteSnap.data() as { tripId: string };
      resolvedTripId = tripId;
    } else {
      // Fallback for trips created before tripInvites mapping existed.
      const q = query(tripsCol(), where('inviteCode', '==', code));
      const snap = await getDocs(q);
      if (!snap.empty) {
        resolvedTripId = snap.docs[0].id;
      }
    }

    if (!resolvedTripId) {
      return err('No trip found with that invite code. Check the code and try again.');
    }

    const newMember: TripMember = {
      userId:      input.userId,
      displayName: input.displayName,
      email:       input.email,
      photoURL:    input.photoURL,
      role:        'member',
      joinedAt:    Date.now(),
    };

    const joinedTrip = await runTransaction(db, async (tx) => {
      const tripRef = tripDoc(resolvedTripId as string);
      const tripSnap = await tx.get(tripRef);

      if (!tripSnap.exists()) {
        throw new Error('TRIP_NOT_FOUND');
      }

      const trip = { id: tripSnap.id, ...tripSnap.data() } as Trip;

      if (trip.memberIds.includes(input.userId)) {
        throw new Error('ALREADY_MEMBER');
      }

      tx.update(tripRef, { memberIds: arrayUnion(input.userId) });
      tx.set(memberDoc(trip.id, input.userId), newMember);

      return { ...trip, memberIds: [...trip.memberIds, input.userId] };
    });

    return ok(joinedTrip);
  } catch (e: any) {
    if (e?.message === 'ALREADY_MEMBER') {
      return err('You are already a member of this trip.');
    }
    if (e?.message === 'TRIP_NOT_FOUND') {
      return err('Trip not found. Ask the owner to share a new invite code.');
    }
    console.error('[joinTrip]', e);
    const code = e?.code ? ` (${e.code})` : '';
    return err(`Failed to join trip. Please try again${code}.`);
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
