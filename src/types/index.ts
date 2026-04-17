// ─── Core domain types ────────────────────────────────────────────────────────
// All Firestore documents map to these interfaces.
// Never widen these types at call sites — keep Role as a union, not string.

export type Role = 'owner' | 'member';

export interface Trip {
  id: string;
  name: string;
  destination: string;
  startDate: string;         // ISO date string "YYYY-MM-DD"
  endDate: string;
  inviteCode: string;        // 6-char alphanumeric, uppercase
  ownerId: string;           // Firebase Auth uid
  memberIds: string[];       // Denormalized for Firestore "array-contains" queries
  createdAt: number;         // Unix ms — Date.now()
}

export interface TripMember {
  userId: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  role: Role;
  joinedAt: number;
}

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

// ─── Bucket list types ───────────────────────────────────────────────────────

export type VoteValue = -1 | 0 | 1;

export interface BucketListLocation {
  lat: number;
  lng: number;
}

export interface BucketListWeather {
  temperature: number;
  condition: string;
  conditionCode: number;
  sunrise: number;
  sunset: number;
  isGoldenHour: boolean;
  isContingency: boolean;
  updatedAt: number;
}

export type BucketListPriority = 'low' | 'medium' | 'high';

export interface BucketListUserData {
  customTitle?: string;
  notes?: string;
  proposedTime?: string;
  activityType?: string;
  priority?: BucketListPriority;
  tags?: string[];
  durationMinutes?: number;
}

export interface BucketListItem {
  id: string;
  tripId: string;
  placeId: string;
  name: string;
  rating: number;
  address: string;
  photoUrl: string;
  location?: BucketListLocation;
  addedById: string;
  addedByName: string;
  addedByPhotoUrl: string | null;
  createdAt: number;
  order: number;
  weather?: BucketListWeather;
  userData?: BucketListUserData;
  upvotes: number;
  downvotes: number;
  score: number;
  votesByUser: Record<string, VoteValue>;
}

export interface BucketListComment {
  id: string;
  itemId: string;
  userId: string;
  userName: string;
  userPhotoUrl: string | null;
  message: string;
  createdAt: number;
}

export type TimelineSourceType = 'bucket' | 'custom';

export interface TimelineEvent {
  id: string;
  tripId: string;
  title: string;
  description: string;
  location: string;
  date: string;              // "YYYY-MM-DD" — within trip.startDate..endDate
  startTime: string;         // "HH:MM" 24-hour
  durationMinutes: number;
  color: string;             // hex, auto-assigned
  tags: string[];            // e.g. ['outdoor', 'photography']
  sourceType: 'bucket' | 'custom';
  bucketItemId: string | null; // set when sourced from bucket list
  createdBy: string;           // uid of creator (always the owner)
  createdAt: number;           // Unix ms
}

// ─── Result wrapper ────────────────────────────────────────────────────────────
// All service functions return Result<T> — never throw to the UI layer.
// Use isOk() / isErr() helpers to narrow before accessing .data / .error.

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export const ok = <T>(data: T): Result<T> => ({ ok: true, data });
export const err = (error: string): Result<never> => ({ ok: false, error });
