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

// ─── Result wrapper ────────────────────────────────────────────────────────────
// All service functions return Result<T> — never throw to the UI layer.
// Use isOk() / isErr() helpers to narrow before accessing .data / .error.

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export const ok = <T>(data: T): Result<T> => ({ ok: true, data });
export const err = (error: string): Result<never> => ({ ok: false, error });
