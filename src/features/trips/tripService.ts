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
import { normalizeTripCurrency } from '@/lib/currency';
import { ok, err, type Result, type Trip, type TripMember, type TripDestinationCity } from '@/types';

// ─── Firestore collection helpers ─────────────────────────────────────────────

const tripsCol     = () => collection(db, 'trips');
const tripDoc      = (id: string) => doc(db, 'trips', id);
const membersCol   = (tripId: string) => collection(db, 'trips', tripId, 'members');
const memberDoc    = (tripId: string, uid: string) => doc(db, 'trips', tripId, 'members', uid);
const inviteDoc    = (code: string) => doc(db, 'tripInvites', code);

function normalizeCityName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

function parseDestinationCities(destination: string): string[] {
  return destination
    .split(';')
    .map(normalizeCityName)
    .filter(Boolean);
}

function normalizeDestinationCity(raw: unknown): TripDestinationCity | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  const name = typeof rec.name === 'string' ? normalizeCityName(rec.name) : '';
  if (!name) return null;

  const loc = rec.location as { lat?: unknown; lng?: unknown } | undefined;
  const location = loc && typeof loc.lat === 'number' && typeof loc.lng === 'number'
    ? { lat: loc.lat, lng: loc.lng }
    : undefined;

  return {
    name,
    placeId: typeof rec.placeId === 'string' ? rec.placeId : undefined,
    location,
  };
}

function toFirestoreDestinationCity(city: TripDestinationCity): TripDestinationCity {
  const normalized: TripDestinationCity = { name: normalizeCityName(city.name) };
  if (city.placeId) {
    normalized.placeId = city.placeId;
  }
  if (city.location && Number.isFinite(city.location.lat) && Number.isFinite(city.location.lng)) {
    normalized.location = { lat: city.location.lat, lng: city.location.lng };
  }
  return normalized;
}

function toFirestoreTripPayload(input: Omit<Trip, 'id'>): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: input.name,
    destination: input.destination,
    currency: input.currency,
    startDate: input.startDate,
    endDate: input.endDate,
    inviteCode: input.inviteCode,
    ownerId: input.ownerId,
    memberIds: input.memberIds,
    createdAt: input.createdAt,
  };

  if (input.destinationCities && input.destinationCities.length > 0) {
    payload.destinationCities = input.destinationCities.map(toFirestoreDestinationCity);
  }
  if (input.selectedDestinationCity) {
    payload.selectedDestinationCity = normalizeCityName(input.selectedDestinationCity);
  }
  if (input.destinationLocation) {
    payload.destinationLocation = {
      lat: input.destinationLocation.lat,
      lng: input.destinationLocation.lng,
    };
  }
  if (input.destinationPlaceId) {
    payload.destinationPlaceId = input.destinationPlaceId;
  }
  if (input.destinationPlaceName) {
    payload.destinationPlaceName = input.destinationPlaceName;
  }

  return payload;
}

function mergeDestinationCities(trip: {
  destination: string;
  destinationCities?: TripDestinationCity[];
  destinationLocation?: { lat: number; lng: number };
  destinationPlaceId?: string;
}): TripDestinationCity[] {
  const names = parseDestinationCities(trip.destination);
  const byName = new Map<string, TripDestinationCity>();

  for (const city of trip.destinationCities ?? []) {
    const key = normalizeCityName(city.name).toLowerCase();
    if (!key) continue;
    byName.set(key, { ...city, name: normalizeCityName(city.name) });
  }

  for (const [index, name] of names.entries()) {
    const key = name.toLowerCase();
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, { name });
      continue;
    }

    // Backfill primary city metadata for legacy trips.
    if (index === 0) {
      if (!existing.location && trip.destinationLocation) {
        existing.location = { ...trip.destinationLocation };
      }
      if (!existing.placeId && trip.destinationPlaceId) {
        existing.placeId = trip.destinationPlaceId;
      }
    }
  }

  if (names.length > 0) {
    return names.map((name, index) => {
      const key = name.toLowerCase();
      const city = byName.get(key) ?? { name };
      if (index === 0) {
        return {
          ...city,
          location: city.location ?? trip.destinationLocation,
          placeId: city.placeId ?? trip.destinationPlaceId,
        };
      }
      return city;
    });
  }

  return Array.from(byName.values());
}

// ─── Create trip ──────────────────────────────────────────────────────────────

export interface CreateTripInput {
  name: string;
  destination: string;
  destinationCities?: TripDestinationCity[];
  selectedDestinationCity?: string;
  destinationLocation?: { lat: number; lng: number };
  destinationPlaceId?: string;
  destinationPlaceName?: string;
  currency: string;
  startDate: string;
  endDate: string;
  ownerId: string;
  ownerDisplayName: string;
  ownerEmail: string;
  ownerPhotoURL: string | null;
}

function toTrip(id: string, data: Record<string, unknown>): Trip {
  const destinationLocation = data.destinationLocation as { lat?: number; lng?: number } | undefined;
  const normalizedLocation = destinationLocation && typeof destinationLocation.lat === 'number' && typeof destinationLocation.lng === 'number'
    ? { lat: destinationLocation.lat, lng: destinationLocation.lng }
    : undefined;
  const destinationCitiesRaw = Array.isArray(data.destinationCities) ? data.destinationCities : undefined;
  const destinationCities = destinationCitiesRaw
    ? destinationCitiesRaw.map(normalizeDestinationCity).filter((city): city is TripDestinationCity => city !== null)
    : undefined;
  const destination = String(data.destination ?? '');
  const mergedDestinationCities = mergeDestinationCities({
    destination,
    destinationCities,
    destinationLocation: normalizedLocation,
    destinationPlaceId: typeof data.destinationPlaceId === 'string' ? data.destinationPlaceId : undefined,
  });
  const selectedDestinationCityRaw = typeof data.selectedDestinationCity === 'string'
    ? normalizeCityName(data.selectedDestinationCity)
    : '';
  const selectedDestinationCity = mergedDestinationCities.some(
    (city) => city.name.toLowerCase() === selectedDestinationCityRaw.toLowerCase(),
  ) ? selectedDestinationCityRaw : mergedDestinationCities[0]?.name;

  return {
    id,
    name: String(data.name ?? ''),
    destination,
    destinationCities: mergedDestinationCities,
    selectedDestinationCity,
    destinationLocation: normalizedLocation,
    destinationPlaceId: typeof data.destinationPlaceId === 'string' ? data.destinationPlaceId : undefined,
    destinationPlaceName: typeof data.destinationPlaceName === 'string' ? data.destinationPlaceName : undefined,
    currency: normalizeTripCurrency(typeof data.currency === 'string' ? data.currency : undefined),
    startDate: String(data.startDate ?? ''),
    endDate: String(data.endDate ?? ''),
    inviteCode: String(data.inviteCode ?? ''),
    ownerId: String(data.ownerId ?? ''),
    memberIds: Array.isArray(data.memberIds) ? data.memberIds.map((value) => String(value)) : [],
    createdAt: Number(data.createdAt ?? Date.now()),
  };
}

export async function createTrip(input: CreateTripInput): Promise<Result<Trip>> {
  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const tripRef = doc(tripsCol());
      const inviteCode = generateInviteCode();

      const trip: Omit<Trip, 'id'> = {
        name:        input.name.trim(),
        destination: input.destination.trim(),
        destinationCities: input.destinationCities,
        selectedDestinationCity: input.selectedDestinationCity,
        destinationLocation: input.destinationLocation,
        destinationPlaceId: input.destinationPlaceId,
        destinationPlaceName: input.destinationPlaceName,
        currency:    normalizeTripCurrency(input.currency),
        startDate:   input.startDate,
        endDate:     input.endDate,
        inviteCode,
        ownerId:     input.ownerId,
        memberIds:   [input.ownerId],
        createdAt:   Date.now(),
      };
      const tripPayload = toFirestoreTripPayload(trip);

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

          tx.set(tripRef, tripPayload);
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

      const trip = toTrip(tripSnap.id, tripSnap.data());

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
    const trips = snap.docs.map((d) => toTrip(d.id, d.data()));
    return ok(trips);
  } catch (e: any) {
    console.error('[getUserTrips]', e);
    if (e?.code === 'permission-denied') {
      return err('Failed to load trips: permission denied. Deploy the latest Firestore rules and confirm your user profile exists.');
    }
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
    return ok(toTrip(snap.id, snap.data()));
  } catch (e: any) {
    console.error('[getTrip]', e);
    return err('Failed to load trip.');
  }
}

export async function appendTripDestinationCity(
  tripId: string,
  city: TripDestinationCity,
): Promise<Result<Trip>> {
  const name = normalizeCityName(city.name);
  if (!name) return err('City name is required.');

  try {
    const updatedTrip = await runTransaction(db, async (tx) => {
      const ref = tripDoc(tripId);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('TRIP_NOT_FOUND');

      const trip = toTrip(snap.id, snap.data());
      const base = mergeDestinationCities(trip);
      const key = name.toLowerCase();
      const index = base.findIndex((c) => normalizeCityName(c.name).toLowerCase() === key);

      const incoming: TripDestinationCity = {
        name,
        placeId: city.placeId,
        location: city.location,
      };

      if (index === -1) {
        base.push(incoming);
      } else {
        const existing = base[index];
        base[index] = {
          name: existing.name,
          placeId: existing.placeId ?? incoming.placeId,
          location: existing.location ?? incoming.location,
        };
      }

      const destination = base.map((c) => c.name).join('; ');
      const selectedDestinationCity = trip.selectedDestinationCity || base[0]?.name;
      const firestoreCities = base.map(toFirestoreDestinationCity);
      tx.update(ref, {
        destination,
        destinationCities: firestoreCities,
        selectedDestinationCity,
      });

      return {
        ...trip,
        destination,
        destinationCities: base,
        selectedDestinationCity,
      };
    });

    return ok(updatedTrip);
  } catch (e: any) {
    if (e?.message === 'TRIP_NOT_FOUND') return err('Trip not found.');
    console.error('[appendTripDestinationCity]', e);
    return err('Failed to add city to trip.');
  }
}

export async function setSelectedDestinationCity(
  tripId: string,
  cityName: string,
): Promise<Result<Trip>> {
  const name = normalizeCityName(cityName);
  if (!name) return err('City name is required.');

  try {
    const updatedTrip = await runTransaction(db, async (tx) => {
      const ref = tripDoc(tripId);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('TRIP_NOT_FOUND');

      const trip = toTrip(snap.id, snap.data());
      const cities = mergeDestinationCities(trip);
      const hasCity = cities.some((city) => normalizeCityName(city.name).toLowerCase() === name.toLowerCase());
      if (!hasCity) {
        throw new Error('CITY_NOT_FOUND');
      }

      tx.update(ref, { selectedDestinationCity: name });

      return {
        ...trip,
        destinationCities: cities,
        selectedDestinationCity: name,
      };
    });

    return ok(updatedTrip);
  } catch (e: any) {
    if (e?.message === 'TRIP_NOT_FOUND') return err('Trip not found.');
    if (e?.message === 'CITY_NOT_FOUND') return err('Selected city is not part of this trip.');
    console.error('[setSelectedDestinationCity]', e);
    return err('Failed to update selected city.');
  }
}
